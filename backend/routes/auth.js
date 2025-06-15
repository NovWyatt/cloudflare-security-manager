const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const { User, AuditLog } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');
const { authenticate, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');
const encryptionService = require('../services/encryptionService');

const router = express.Router();

// Validation rules
const registerValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Password confirmation does not match password');
            }
            return true;
        })
];

const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

const changePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Password confirmation does not match new password');
            }
            return true;
        })
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            message: 'Please check your input and try again',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value
            }))
        });
    }
    next();
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register',
    authLimiter,
    registerValidation,
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { email, password, name } = req.body;

        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            await AuditLog.createEntry({
                action: 'register_failed_email_exists',
                resourceType: 'user',
                description: `Registration attempt with existing email: ${email}`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'failed',
                category: 'authentication'
            });

            throw new AppError('Email address is already registered', 409);
        }

        // Create user
        const user = await User.create({
            email,
            password, // Will be hashed by the model hook
            name,
            role: 'user'
        });

        // Generate verification token
        const verificationToken = user.generateVerificationToken();
        await user.save();

        // Generate auth tokens
        const authToken = user.generateAuthToken();
        const refreshToken = user.generateRefreshToken();

        // Log successful registration
        await AuditLog.createEntry({
            userId: user.id,
            action: 'user_registered',
            resourceType: 'user',
            resourceId: user.id,
            description: `New user registered: ${user.name} (${user.email})`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            category: 'authentication',
            metadata: {
                email: user.email,
                name: user.name
            }
        });

        logger.auth('register', user.id, true, {
            email: user.email,
            name: user.name,
            ip: req.ip
        });

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                is_verified: user.is_verified,
                created_at: user.created_at
            },
            tokens: {
                access_token: authToken,
                refresh_token: refreshToken,
                expires_in: process.env.JWT_EXPIRES_IN || '24h'
            },
            verification: {
                required: !user.is_verified,
                token: verificationToken
            }
        });
    })
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login',
    authLimiter,
    loginValidation,
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { email, password, rememberMe = false } = req.body;

        // Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            await AuditLog.createEntry({
                action: 'login_failed_user_not_found',
                resourceType: 'user',
                description: `Login attempt with non-existent email: ${email}`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'failed',
                category: 'authentication'
            });

            throw new AppError('Invalid email or password', 401);
        }

        // Check if account is locked
        if (user.isLocked()) {
            await AuditLog.createEntry({
                userId: user.id,
                action: 'login_failed_account_locked',
                resourceType: 'user',
                resourceId: user.id,
                description: `Login attempt on locked account: ${email}`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'failed',
                category: 'authentication'
            });

            throw new AppError('Account is temporarily locked due to too many failed login attempts', 423);
        }

        // Check if account is active
        if (!user.is_active) {
            await AuditLog.createEntry({
                userId: user.id,
                action: 'login_failed_account_inactive',
                resourceType: 'user',
                resourceId: user.id,
                description: `Login attempt on inactive account: ${email}`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'failed',
                category: 'authentication'
            });

            throw new AppError('Account is deactivated', 403);
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            // Increment login attempts
            await user.incrementLoginAttempts();

            await AuditLog.createEntry({
                userId: user.id,
                action: 'login_failed_wrong_password',
                resourceType: 'user',
                resourceId: user.id,
                description: `Failed login attempt with wrong password: ${email}`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'failed',
                category: 'authentication',
                metadata: {
                    loginAttempts: user.login_attempts + 1
                }
            });

            throw new AppError('Invalid email or password', 401);
        }

        // Reset login attempts on successful login
        await user.resetLoginAttempts();

        // Generate tokens
        const authToken = user.generateAuthToken();
        const refreshToken = user.generateRefreshToken();

        // Log successful login
        await AuditLog.createEntry({
            userId: user.id,
            action: 'login_successful',
            resourceType: 'user',
            resourceId: user.id,
            description: `User logged in successfully: ${user.name} (${user.email})`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            category: 'authentication',
            metadata: {
                rememberMe,
                lastLogin: user.last_login
            }
        });

        logger.auth('login', user.id, true, {
            email: user.email,
            ip: req.ip,
            rememberMe
        });

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                is_verified: user.is_verified,
                last_login: user.last_login,
                preferences: user.preferences
            },
            tokens: {
                access_token: authToken,
                refresh_token: refreshToken,
                expires_in: process.env.JWT_EXPIRES_IN || '24h'
            }
        });
    })
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh',
    asyncHandler(async (req, res) => {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            throw new AppError('Refresh token is required', 400);
        }

        try {
            // Verify refresh token
            const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);

            if (decoded.type !== 'refresh') {
                throw new AppError('Invalid token type', 401);
            }

            // Find user
            const user = await User.findByPk(decoded.userId);
            if (!user || !user.is_active) {
                throw new AppError('User not found or inactive', 401);
            }

            // Generate new tokens
            const newAuthToken = user.generateAuthToken();
            const newRefreshToken = user.generateRefreshToken();

            logger.auth('token_refresh', user.id, true, {
                ip: req.ip
            });

            res.json({
                message: 'Token refreshed successfully',
                tokens: {
                    access_token: newAuthToken,
                    refresh_token: newRefreshToken,
                    expires_in: process.env.JWT_EXPIRES_IN || '24h'
                }
            });

        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new AppError('Refresh token expired', 401);
            }
            if (error.name === 'JsonWebTokenError') {
                throw new AppError('Invalid refresh token', 401);
            }
            throw error;
        }
    })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout',
    authenticate,
    asyncHandler(async (req, res) => {
        // Log logout event
        await AuditLog.createEntry({
            userId: req.user.id,
            action: 'logout',
            resourceType: 'user',
            resourceId: req.user.id,
            description: `User logged out: ${req.user.name} (${req.user.email})`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            category: 'authentication'
        });

        logger.auth('logout', req.user.id, true, {
            email: req.user.email,
            ip: req.ip
        });

        res.json({
            message: 'Logout successful'
        });
    })
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me',
    authenticate,
    asyncHandler(async (req, res) => {
        // Get fresh user data with stats
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            throw new AppError('User not found', 404);
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                is_active: user.is_active,
                is_verified: user.is_verified,
                last_login: user.last_login,
                preferences: user.preferences,
                api_usage: user.api_usage,
                created_at: user.created_at,
                updated_at: user.updated_at
            }
        });
    })
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile',
    authenticate,
    [
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Name must be between 2 and 100 characters'),
        body('preferences')
            .optional()
            .isObject()
            .withMessage('Preferences must be an object')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { name, preferences } = req.body;
        const user = req.user;

        const oldValues = {
            name: user.name,
            preferences: user.preferences
        };

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (preferences !== undefined) {
            updates.preferences = { ...user.preferences, ...preferences };
        }

        if (Object.keys(updates).length === 0) {
            return res.json({
                message: 'No changes to update',
                user: user.toJSON()
            });
        }

        await user.update(updates);

        // Log profile update
        await AuditLog.createEntry({
            userId: user.id,
            action: 'profile_updated',
            resourceType: 'user',
            resourceId: user.id,
            description: `User profile updated: ${user.email}`,
            oldValues,
            newValues: updates,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            category: 'configuration'
        });

        logger.userActivity(user.id, 'profile_update', {
            changes: Object.keys(updates)
        });

        res.json({
            message: 'Profile updated successfully',
            user: user.toJSON()
        });
    })
);

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.put('/change-password',
    authenticate,
    changePasswordValidation,
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { currentPassword, newPassword } = req.body;
        const user = req.user;

        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            await AuditLog.createEntry({
                userId: user.id,
                action: 'password_change_failed',
                resourceType: 'user',
                resourceId: user.id,
                description: `Failed password change attempt - wrong current password: ${user.email}`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'failed',
                category: 'authentication'
            });

            throw new AppError('Current password is incorrect', 400);
        }

        // Check if new password is different
        const isSamePassword = await user.comparePassword(newPassword);
        if (isSamePassword) {
            throw new AppError('New password must be different from current password', 400);
        }

        // Update password
        await user.update({ password: newPassword });

        // Log successful password change
        await AuditLog.createEntry({
            userId: user.id,
            action: 'password_changed',
            resourceType: 'user',
            resourceId: user.id,
            description: `Password changed successfully: ${user.email}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            category: 'authentication',
            severity: 'medium'
        });

        logger.auth('password_change', user.id, true, {
            email: user.email,
            ip: req.ip
        });

        res.json({
            message: 'Password changed successfully'
        });
    })
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password',
    passwordResetLimiter,
    [
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Please provide a valid email address')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { email } = req.body;

        const user = await User.findByEmail(email);

        // Always return success to prevent email enumeration
        if (!user) {
            await AuditLog.createEntry({
                action: 'password_reset_requested_nonexistent',
                resourceType: 'user',
                description: `Password reset requested for non-existent email: ${email}`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'failed',
                category: 'authentication'
            });

            return res.json({
                message: 'If the email exists, a password reset link has been sent'
            });
        }

        if (!user.is_active) {
            await AuditLog.createEntry({
                userId: user.id,
                action: 'password_reset_requested_inactive',
                resourceType: 'user',
                resourceId: user.id,
                description: `Password reset requested for inactive account: ${email}`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'failed',
                category: 'authentication'
            });

            return res.json({
                message: 'If the email exists, a password reset link has been sent'
            });
        }

        // Generate reset token
        const resetToken = user.generatePasswordResetToken();
        await user.save();

        // Log password reset request
        await AuditLog.createEntry({
            userId: user.id,
            action: 'password_reset_requested',
            resourceType: 'user',
            resourceId: user.id,
            description: `Password reset requested: ${email}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            category: 'authentication',
            metadata: {
                resetTokenGenerated: true
            }
        });

        logger.auth('password_reset_request', user.id, true, {
            email: user.email,
            ip: req.ip
        });

        // In production, send email instead of returning token
        if (process.env.NODE_ENV === 'production') {
            // TODO: Send email with reset link
            res.json({
                message: 'If the email exists, a password reset link has been sent'
            });
        } else {
            // Development mode - return token for testing
            res.json({
                message: 'Password reset token generated',
                reset_token: resetToken,
                expires_in: '1 hour'
            });
        }
    })
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password',
    passwordResetLimiter,
    [
        body('token')
            .notEmpty()
            .withMessage('Reset token is required'),
        body('password')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters long')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
        body('confirmPassword')
            .custom((value, { req }) => {
                if (value !== req.body.password) {
                    throw new Error('Password confirmation does not match password');
                }
                return true;
            })
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { token, password } = req.body;

        // Find user by reset token
        const user = await User.findByResetToken(token);
        if (!user) {
            await AuditLog.createEntry({
                action: 'password_reset_failed_invalid_token',
                resourceType: 'user',
                description: `Password reset attempted with invalid token`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                status: 'failed',
                category: 'authentication'
            });

            throw new AppError('Invalid or expired reset token', 400);
        }

        // Reset password and clear reset token
        await user.update({
            password,
            reset_password_token: null,
            reset_password_expires: null
        });

        // Log successful password reset
        await AuditLog.createEntry({
            userId: user.id,
            action: 'password_reset_completed',
            resourceType: 'user',
            resourceId: user.id,
            description: `Password reset completed successfully: ${user.email}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            category: 'authentication',
            severity: 'medium'
        });

        logger.auth('password_reset_complete', user.id, true, {
            email: user.email,
            ip: req.ip
        });

        res.json({
            message: 'Password reset successfully'
        });
    })
);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
router.post('/verify-email',
    [
        body('token')
            .notEmpty()
            .withMessage('Verification token is required')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { token } = req.body;

        // Find user by verification token
        const user = await User.findByVerificationToken(token);
        if (!user) {
            throw new AppError('Invalid verification token', 400);
        }

        // Verify email
        await user.update({
            is_verified: true,
            verification_token: null
        });

        // Log email verification
        await AuditLog.createEntry({
            userId: user.id,
            action: 'email_verified',
            resourceType: 'user',
            resourceId: user.id,
            description: `Email verified successfully: ${user.email}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            category: 'authentication'
        });

        logger.auth('email_verify', user.id, true, {
            email: user.email,
            ip: req.ip
        });

        res.json({
            message: 'Email verified successfully',
            user: {
                id: user.id,
                email: user.email,
                is_verified: user.is_verified
            }
        });
    })
);

/**
 * @route   GET /api/auth/sessions
 * @desc    Get user sessions (audit log of logins)
 * @access  Private
 */
router.get('/sessions',
    authenticate,
    asyncHandler(async (req, res) => {
        const { page = 1, limit = 20 } = req.query;

        const sessions = await AuditLog.getByUser(req.user.id, {
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit),
            category: 'authentication',
            action: 'login_successful'
        });

        res.json({
            sessions: sessions.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: sessions.count,
                pages: Math.ceil(sessions.count / parseInt(limit))
            }
        });
    })
);

module.exports = router;