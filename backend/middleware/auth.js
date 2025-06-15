const jwt = require('jsonwebtoken');
const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'No token provided or invalid format'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find user
        const user = await User.findByPk(decoded.userId, {
            attributes: { exclude: ['password'] }
        });

        if (!user) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'User not found'
            });
        }

        if (!user.is_active) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'Account is deactivated'
            });
        }

        // Attach user to request
        req.user = user;
        req.userId = user.id;

        next();
    } catch (error) {
        logger.error('Authentication error:', error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Access denied',
                message: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Access denied',
                message: 'Token expired'
            });
        }

        return res.status(500).json({
            error: 'Internal server error',
            message: 'Authentication failed'
        });
    }
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, continues regardless
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findByPk(decoded.userId, {
            attributes: { exclude: ['password'] }
        });

        if (user && user.is_active) {
            req.user = user;
            req.userId = user.id;
        }

        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
};

/**
 * Role-based authorization middleware
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Access denied',
                message: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Insufficient permissions'
            });
        }

        next();
    };
};

/**
 * Zone ownership verification middleware
 */
const verifyZoneOwnership = async (req, res, next) => {
    try {
        const { zoneId } = req.params;
        const userId = req.userId;

        if (!zoneId) {
            return res.status(400).json({
                error: 'Bad request',
                message: 'Zone ID is required'
            });
        }

        // Import Zone model here to avoid circular dependency
        const { Zone } = require('../models');

        const zone = await Zone.findOne({
            where: {
                id: zoneId,
                user_id: userId
            }
        });

        if (!zone) {
            return res.status(404).json({
                error: 'Not found',
                message: 'Zone not found or access denied'
            });
        }

        req.zone = zone;
        next();
    } catch (error) {
        logger.error('Zone ownership verification error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to verify zone ownership'
        });
    }
};

/**
 * Rate limiting per user
 */
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const userRequests = new Map();

    return (req, res, next) => {
        if (!req.userId) {
            return next();
        }

        const userId = req.userId;
        const now = Date.now();
        const userKey = `${userId}`;

        if (!userRequests.has(userKey)) {
            userRequests.set(userKey, []);
        }

        const requests = userRequests.get(userKey);

        // Remove old requests outside the window
        const validRequests = requests.filter(timestamp => now - timestamp < windowMs);

        if (validRequests.length >= maxRequests) {
            return res.status(429).json({
                error: 'Too many requests',
                message: `Maximum ${maxRequests} requests per ${windowMs / 1000} seconds exceeded`,
                retryAfter: Math.ceil(windowMs / 1000)
            });
        }

        validRequests.push(now);
        userRequests.set(userKey, validRequests);

        next();
    };
};

module.exports = {
    authenticate,
    optionalAuth,
    authorize,
    verifyZoneOwnership,
    userRateLimit
};