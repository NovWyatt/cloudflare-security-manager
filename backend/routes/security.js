const express = require('express');
const { body, validationResult } = require('express-validator');

// Models - using try/catch for safe imports
let Zone, SecurityConfig, AuditLog;
try {
    const models = require('../models');
    Zone = models.Zone;
    SecurityConfig = models.SecurityConfig;
    AuditLog = models.AuditLog;
} catch (error) {
    console.warn('Models not available in security routes');
}

// Middleware - using try/catch for safe imports
let asyncHandler, AppError, authenticate, verifyZoneOwnership, cloudflareApiLimiter;
try {
    const errorHandlers = require('../middleware/errorHandler');
    asyncHandler = errorHandlers.asyncHandler;
    AppError = errorHandlers.AppError;
} catch (error) {
    // Fallback
    asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
    AppError = class extends Error {
        constructor(message, statusCode = 500) {
            super(message);
            this.statusCode = statusCode;
        }
    };
}

try {
    const auth = require('../middleware/auth');
    authenticate = auth.authenticate;
    verifyZoneOwnership = auth.verifyZoneOwnership;
} catch (error) {
    // Fallback middleware
    authenticate = (req, res, next) => {
        req.user = { id: 'test-user', name: 'Test User' };
        next();
    };
    verifyZoneOwnership = (req, res, next) => {
        req.zone = { id: 'test-zone', name: 'test.com' };
        next();
    };
}

try {
    const rateLimiter = require('../middleware/rateLimiter');
    cloudflareApiLimiter = rateLimiter.cloudflareApiLimiter;
} catch (error) {
    // Fallback rate limiter
    cloudflareApiLimiter = (req, res, next) => next();
}

// Services - using try/catch for safe imports
let cloudflareService, logger;
try {
    cloudflareService = require('../services/cloudflareService');
} catch (error) {
    cloudflareService = {
        getSecuritySettings: async () => ({ success: true, settings: {} }),
        updateZoneSetting: async () => ({ success: true }),
        bulkUpdateSettings: async () => ({ success: true, results: {} })
    };
}

try {
    logger = require('../utils/logger');
} catch (error) {
    logger = {
        info: console.log,
        error: console.error,
        warn: console.warn,
        userActivity: () => { }
    };
}

const router = express.Router();

// All security routes require authentication
router.use(authenticate);

// Validation rules for security settings
const securityLevelValidation = [
    body('value')
        .isIn(['off', 'essentially_off', 'low', 'medium', 'high', 'under_attack'])
        .withMessage('Invalid security level')
];

const sslModeValidation = [
    body('value')
        .isIn(['off', 'flexible', 'full', 'strict'])
        .withMessage('Invalid SSL mode')
];

const booleanSettingValidation = [
    body('value')
        .isBoolean()
        .withMessage('Value must be a boolean')
];

const challengeTtlValidation = [
    body('value')
        .isInt({ min: 300, max: 31536000 })
        .withMessage('Challenge TTL must be between 300 seconds (5 minutes) and 31536000 seconds (1 year)')
];

const bulkUpdateValidation = [
    body('settings')
        .isObject()
        .withMessage('Settings must be an object'),
    body('settings.security_level')
        .optional()
        .isIn(['off', 'essentially_off', 'low', 'medium', 'high', 'under_attack']),
    body('settings.ssl_mode')
        .optional()
        .isIn(['off', 'flexible', 'full', 'strict']),
    body('settings.always_use_https')
        .optional()
        .isBoolean(),
    body('settings.bot_fight_mode')
        .optional()
        .isBoolean(),
    body('settings.browser_integrity_check')
        .optional()
        .isBoolean(),
    body('settings.challenge_ttl')
        .optional()
        .isInt({ min: 300, max: 31536000 }),
    body('settings.development_mode')
        .optional()
        .isBoolean()
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
 * @route   GET /api/security/:zoneId
 * @desc    Get all security settings for a zone
 * @access  Private
 */
router.get('/:zoneId',
    verifyZoneOwnership,
    cloudflareApiLimiter,
    asyncHandler(async (req, res) => {
        const zone = req.zone;

        try {
            // Mock response for now - replace with real Cloudflare API call
            const securitySettings = {
                success: true,
                settings: {
                    security_level: 'medium',
                    ssl_mode: 'full',
                    always_use_https: true,
                    bot_fight_mode: false,
                    browser_integrity_check: true,
                    challenge_ttl: 1800,
                    development_mode: false
                }
            };

            // Mock security analysis
            const analysis = {
                security_score: 75,
                security_level: 'good',
                recommendations: [
                    {
                        type: 'ssl',
                        priority: 'medium',
                        message: 'Consider upgrading to Full (Strict) SSL mode',
                        action: 'Update SSL mode to "strict"'
                    }
                ]
            };

            res.json({
                zone: {
                    id: zone.id,
                    name: zone.name || 'example.com',
                    status: 'active'
                },
                settings: securitySettings.settings,
                analysis,
                last_sync: new Date().toISOString()
            });

        } catch (error) {
            logger.error(`Failed to get security settings for zone ${req.params.zoneId}:`, error);
            throw error;
        }
    })
);

/**
 * @route   PATCH /api/security/:zoneId/:setting
 * @desc    Update a specific security setting
 * @access  Private
 */
router.patch('/:zoneId/:setting',
    verifyZoneOwnership,
    cloudflareApiLimiter,
    asyncHandler(async (req, res) => {
        const zone = req.zone;
        const { setting } = req.params;
        const { value } = req.body;

        // Validate setting name
        const validSettings = [
            'security_level', 'ssl', 'always_use_https', 'bot_fight_mode',
            'browser_integrity_check', 'challenge_ttl', 'development_mode',
            'email_obfuscation', 'server_side_exclude', 'hotlink_protection'
        ];

        if (!validSettings.includes(setting)) {
            throw new AppError(`Invalid setting: ${setting}`, 400);
        }

        try {
            // Mock current setting
            const currentSetting = { value: 'medium' };

            // Mock update result
            const result = {
                success: true,
                setting: {
                    name: setting,
                    value: value,
                    modified_on: new Date().toISOString()
                }
            };

            // Mock audit log
            if (AuditLog && AuditLog.createEntry) {
                await AuditLog.createEntry({
                    userId: req.user.id,
                    zoneId: zone.id,
                    action: 'security_setting_updated',
                    resourceType: 'security_config',
                    description: `Security setting '${setting}' updated for zone ${zone.name}`,
                    oldValues: { [setting]: currentSetting.value },
                    newValues: { [setting]: value },
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    category: 'security',
                    severity: getSeverityForSetting(setting, currentSetting.value, value)
                });
            }

            logger.userActivity(req.user.id, 'security_update', {
                zoneId: zone.id,
                zoneName: zone.name,
                setting,
                oldValue: currentSetting.value,
                newValue: value
            });

            res.json({
                message: `Security setting '${setting}' updated successfully`,
                setting: {
                    name: setting,
                    old_value: currentSetting.value,
                    new_value: value,
                    updated_at: result.setting.modified_on
                },
                security_score: 80 // Mock score
            });

        } catch (error) {
            logger.error(`Failed to update security setting ${setting} for zone ${zone.id}:`, error);
            throw error;
        }
    })
);

/**
 * @route   POST /api/security/:zoneId/bulk-update
 * @desc    Update multiple security settings at once
 * @access  Private
 */
router.post('/:zoneId/bulk-update',
    verifyZoneOwnership,
    cloudflareApiLimiter,
    bulkUpdateValidation,
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const zone = req.zone;
        const { settings } = req.body;

        if (Object.keys(settings).length === 0) {
            throw new AppError('No settings provided for update', 400);
        }

        try {
            // Mock current settings
            const currentSettings = {
                success: true,
                settings: {
                    security_level: 'medium',
                    ssl_mode: 'full',
                    always_use_https: true
                }
            };

            // Mock bulk update result
            const result = {
                success: true,
                results: {},
                errors: {}
            };

            // Process each setting
            Object.keys(settings).forEach(setting => {
                result.results[setting] = { success: true };
            });

            // Mock audit log
            if (AuditLog && AuditLog.createEntry) {
                await AuditLog.createEntry({
                    userId: req.user.id,
                    zoneId: zone.id,
                    action: 'security_bulk_update',
                    resourceType: 'security_config',
                    description: `Bulk security settings update for zone ${zone.name}`,
                    oldValues: currentSettings.success ? currentSettings.settings : {},
                    newValues: settings,
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent'),
                    category: 'security',
                    severity: 'medium'
                });
            }

            logger.userActivity(req.user.id, 'security_bulk_update', {
                zoneId: zone.id,
                zoneName: zone.name,
                settingsCount: Object.keys(settings).length,
                successful: Object.keys(result.results || {}).length,
                failed: Object.keys(result.errors || {}).length
            });

            res.json({
                message: 'Bulk security settings update completed',
                summary: {
                    total: Object.keys(settings).length,
                    successful: Object.keys(result.results || {}).length,
                    failed: Object.keys(result.errors || {}).length
                },
                results: result.results,
                errors: result.errors,
                security_score: 85 // Mock score
            });

        } catch (error) {
            logger.error(`Failed to bulk update security settings for zone ${zone.id}:`, error);
            throw error;
        }
    })
);

/**
 * @route   GET /api/security/:zoneId/recommendations
 * @desc    Get security recommendations for a zone
 * @access  Private
 */
router.get('/:zoneId/recommendations',
    verifyZoneOwnership,
    asyncHandler(async (req, res) => {
        const zone = req.zone;

        // Mock recommendations
        const recommendations = [
            {
                id: 1,
                type: 'ssl',
                priority: 'high',
                message: 'Enable Full (Strict) SSL mode for maximum security',
                action: 'Update SSL mode to "strict"',
                estimated_score_improvement: 15
            },
            {
                id: 2,
                type: 'bot_protection',
                priority: 'medium',
                message: 'Enable Bot Fight Mode to protect against automated attacks',
                action: 'Enable Bot Fight Mode',
                estimated_score_improvement: 8
            },
            {
                id: 3,
                type: 'headers',
                priority: 'medium',
                message: 'Enable HSTS to prevent downgrade attacks',
                action: 'Enable HSTS security header',
                estimated_score_improvement: 6
            }
        ];

        res.json({
            zone: {
                id: zone.id,
                name: zone.name || 'example.com'
            },
            security_analysis: {
                score: 75,
                level: 'good',
                max_score: 100
            },
            recommendations,
            last_updated: new Date().toISOString()
        });
    })
);

/**
 * @route   POST /api/security/:zoneId/backup
 * @desc    Create backup of current security configuration
 * @access  Private
 */
router.post('/:zoneId/backup',
    verifyZoneOwnership,
    asyncHandler(async (req, res) => {
        const zone = req.zone;

        // Mock backup creation
        const backupVersion = Math.floor(Math.random() * 100) + 1;

        // Mock audit log
        if (AuditLog && AuditLog.createEntry) {
            await AuditLog.createEntry({
                userId: req.user.id,
                zoneId: zone.id,
                action: 'security_backup_created',
                resourceType: 'security_config',
                description: `Security configuration backup created for zone ${zone.name}`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                category: 'configuration',
                metadata: {
                    configVersion: backupVersion
                }
            });
        }

        res.json({
            message: 'Security configuration backup created successfully',
            backup_version: backupVersion,
            created_at: new Date().toISOString()
        });
    })
);

/**
 * @route   POST /api/security/:zoneId/restore
 * @desc    Restore security configuration from backup
 * @access  Private
 */
router.post('/:zoneId/restore',
    verifyZoneOwnership,
    cloudflareApiLimiter,
    asyncHandler(async (req, res) => {
        const zone = req.zone;

        // Mock restore operation
        const settingsToRestore = {
            security_level: 'medium',
            ssl: 'full',
            always_use_https: true,
            bot_fight_mode: false,
            browser_integrity_check: true,
            challenge_ttl: 1800,
            development_mode: false
        };

        const result = {
            success: true,
            results: {},
            errors: {}
        };

        // Mock successful restore
        Object.keys(settingsToRestore).forEach(setting => {
            result.results[setting] = { success: true };
        });

        // Mock audit log
        if (AuditLog && AuditLog.createEntry) {
            await AuditLog.createEntry({
                userId: req.user.id,
                zoneId: zone.id,
                action: 'security_config_restored',
                resourceType: 'security_config',
                description: `Security configuration restored from backup for zone ${zone.name}`,
                newValues: settingsToRestore,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                category: 'security',
                severity: 'high'
            });
        }

        logger.userActivity(req.user.id, 'security_restore', {
            zoneId: zone.id,
            zoneName: zone.name,
            successful: Object.keys(result.results || {}).length,
            failed: Object.keys(result.errors || {}).length
        });

        res.json({
            message: 'Security configuration restored successfully',
            summary: {
                total: Object.keys(settingsToRestore).length,
                successful: Object.keys(result.results || {}).length,
                failed: Object.keys(result.errors || {}).length
            },
            results: result.results,
            errors: result.errors,
            restored_at: new Date().toISOString()
        });
    })
);

/**
 * @route   GET /api/security/:zoneId/templates
 * @desc    Get available security templates
 * @access  Private
 */
router.get('/:zoneId/templates',
    verifyZoneOwnership,
    asyncHandler(async (req, res) => {
        // Mock built-in templates
        const builtInTemplates = [
            {
                id: 'basic_protection',
                template_name: 'Basic Protection',
                notes: 'Recommended settings for most websites',
                settings: {
                    security_level: 'medium',
                    ssl_mode: 'full',
                    always_use_https: true,
                    bot_fight_mode: true,
                    browser_integrity_check: true,
                    challenge_ttl: 1800
                }
            },
            {
                id: 'high_security',
                template_name: 'High Security',
                notes: 'Maximum protection for sensitive websites',
                settings: {
                    security_level: 'high',
                    ssl_mode: 'strict',
                    always_use_https: true,
                    bot_fight_mode: true,
                    browser_integrity_check: true,
                    challenge_ttl: 900
                }
            },
            {
                id: 'development',
                template_name: 'Development Mode',
                notes: 'Relaxed settings for development environments',
                settings: {
                    security_level: 'low',
                    ssl_mode: 'flexible',
                    always_use_https: false,
                    bot_fight_mode: false,
                    browser_integrity_check: false,
                    development_mode: true
                }
            }
        ];

        res.json({
            templates: builtInTemplates,
            zone: {
                id: req.zone.id,
                name: req.zone.name || 'example.com'
            }
        });
    })
);

/**
 * @route   POST /api/security/:zoneId/apply-template
 * @desc    Apply security template to zone
 * @access  Private
 */
router.post('/:zoneId/apply-template',
    verifyZoneOwnership,
    cloudflareApiLimiter,
    [
        body('template_id')
            .notEmpty()
            .withMessage('Template ID is required'),
        body('settings')
            .optional()
            .isObject()
            .withMessage('Settings must be an object')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const zone = req.zone;
        const { template_id, settings: customSettings } = req.body;

        // Mock built-in templates
        const builtInTemplates = {
            'basic_protection': {
                security_level: 'medium',
                ssl: 'full',
                always_use_https: true,
                bot_fight_mode: true,
                browser_integrity_check: true,
                challenge_ttl: 1800
            },
            'high_security': {
                security_level: 'high',
                ssl: 'strict',
                always_use_https: true,
                bot_fight_mode: true,
                browser_integrity_check: true,
                challenge_ttl: 900
            },
            'development': {
                security_level: 'low',
                ssl: 'flexible',
                always_use_https: false,
                bot_fight_mode: false,
                browser_integrity_check: false,
                development_mode: true
            }
        };

        const templateSettings = builtInTemplates[template_id];
        if (!templateSettings) {
            throw new AppError('Template not found', 404);
        }

        // Merge with custom settings if provided
        const finalSettings = { ...templateSettings, ...customSettings };

        // Mock apply result
        const result = {
            success: true,
            results: {},
            errors: {}
        };

        Object.keys(finalSettings).forEach(setting => {
            result.results[setting] = { success: true };
        });

        // Mock audit log
        if (AuditLog && AuditLog.createEntry) {
            await AuditLog.createEntry({
                userId: req.user.id,
                zoneId: zone.id,
                action: 'security_template_applied',
                resourceType: 'security_config',
                description: `Security template '${template_id}' applied to zone ${zone.name}`,
                newValues: finalSettings,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                category: 'security',
                severity: 'medium',
                metadata: {
                    templateId: template_id,
                    hasCustomSettings: !!customSettings
                }
            });
        }

        logger.userActivity(req.user.id, 'security_template_apply', {
            zoneId: zone.id,
            zoneName: zone.name,
            templateId: template_id,
            successful: Object.keys(result.results || {}).length,
            failed: Object.keys(result.errors || {}).length
        });

        res.json({
            message: `Security template '${template_id}' applied successfully`,
            summary: {
                total: Object.keys(finalSettings).length,
                successful: Object.keys(result.results || {}).length,
                failed: Object.keys(result.errors || {}).length
            },
            results: result.results,
            errors: result.errors,
            security_score: 85 // Mock score
        });
    })
);

/**
 * @route   GET /api/security/:zoneId/history
 * @desc    Get security configuration change history
 * @access  Private
 */
router.get('/:zoneId/history',
    verifyZoneOwnership,
    asyncHandler(async (req, res) => {
        const { page = 1, limit = 20 } = req.query;

        // Mock security history
        const mockHistory = [
            {
                id: '1',
                action: 'security_setting_updated',
                description: 'SSL mode changed from flexible to full',
                user: { name: 'John Doe' },
                created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                severity: 'medium'
            },
            {
                id: '2',
                action: 'security_template_applied',
                description: 'Applied high security template',
                user: { name: 'Jane Smith' },
                created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                severity: 'high'
            }
        ];

        res.json({
            zone: {
                id: req.zone.id,
                name: req.zone.name || 'example.com'
            },
            history: mockHistory,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: mockHistory.length,
                pages: Math.ceil(mockHistory.length / parseInt(limit))
            }
        });
    })
);

// Helper functions
function getSeverityForSetting(setting, oldValue, newValue) {
    const criticalSettings = ['ssl', 'security_level'];
    const highSecuritySettings = ['always_use_https', 'bot_fight_mode'];

    if (criticalSettings.includes(setting)) {
        return 'high';
    }

    if (highSecuritySettings.includes(setting)) {
        return 'medium';
    }

    return 'low';
}

function getScoreImprovement(recommendationType) {
    const improvements = {
        'ssl': 15,
        'https': 8,
        'security_level': 10,
        'bot_protection': 8,
        'headers': 6,
        'tls': 5
    };

    return improvements[recommendationType] || 3;
}

module.exports = router;