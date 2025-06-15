const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');

const { Zone, SecurityConfig, AuditLog } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate, verifyZoneOwnership } = require('../middleware/auth');
const { exportLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const cloudflareService = require('../services/cloudflareService');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/json') {
            cb(null, true);
        } else {
            cb(new Error('Only JSON files are allowed'), false);
        }
    }
});

// All config routes require authentication
router.use(authenticate);

// Validation rules
const importValidation = [
    body('overwrite_existing')
        .optional()
        .isBoolean()
        .withMessage('Overwrite existing must be a boolean'),
    body('apply_to_cloudflare')
        .optional()
        .isBoolean()
        .withMessage('Apply to Cloudflare must be a boolean')
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
 * @route   GET /api/config/:zoneId/export
 * @desc    Export zone configuration
 * @access  Private
 */
router.get('/:zoneId/export',
    verifyZoneOwnership,
    exportLimiter,
    asyncHandler(async (req, res) => {
        const zone = req.zone;
        const { format = 'json', include_sensitive = 'false' } = req.query;

        try {
            // Get current security configuration
            let securityConfig = await SecurityConfig.findByZone(zone.id);
            if (!securityConfig) {
                securityConfig = await SecurityConfig.create({
                    zone_id: zone.id,
                    last_modified_by: req.user.id
                });
            }

            // Get current settings from Cloudflare
            const apiToken = zone.getDecryptedApiToken();
            const currentSettings = await cloudflareService.getSecuritySettings(apiToken, zone.cloudflare_zone_id);

            // Prepare export data
            const exportData = {
                metadata: {
                    zone_name: zone.name,
                    zone_id: zone.cloudflare_zone_id,
                    exported_at: new Date().toISOString(),
                    exported_by: req.user.name,
                    export_version: '1.0',
                    cloudflare_plan: zone.plan
                },
                zone_info: {
                    name: zone.name,
                    status: zone.status,
                    plan: zone.plan,
                    name_servers: zone.name_servers,
                    tags: zone.tags,
                    notes: zone.notes
                },
                security_settings: currentSettings.success ? currentSettings.settings : {},
                security_config: securityConfig.exportConfig(),
                preferences: {
                    auto_sync: zone.auto_sync,
                    notification_settings: zone.notification_settings,
                    analytics_retention: zone.analytics_retention
                }
            };

            // Include sensitive data if requested and user has permission
            if (include_sensitive === 'true') {
                // Note: Never include actual API tokens, but include permissions
                exportData.api_permissions = zone.permissions;
            }

            // Log export activity
            await AuditLog.createEntry({
                userId: req.user.id,
                zoneId: zone.id,
                action: 'config_exported',
                resourceType: 'zone',
                resourceId: zone.id,
                description: `Configuration exported for zone ${zone.name}`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                category: 'data_access',
                metadata: {
                    format,
                    includeSensitive: include_sensitive === 'true',
                    exportSize: JSON.stringify(exportData).length
                }
            });

            logger.userActivity(req.user.id, 'config_export', {
                zoneId: zone.id,
                zoneName: zone.name,
                format,
                size: JSON.stringify(exportData).length
            });

            // Set appropriate headers for download
            const filename = `${zone.name.replace(/[^a-zA-Z0-9]/g, '_')}_config_${new Date().toISOString().split('T')[0]}.json`;

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            res.json(exportData);

        } catch (error) {
            logger.error(`Failed to export configuration for zone ${zone.id}:`, error);
            throw error;
        }
    })
);

/**
 * @route   POST /api/config/:zoneId/import
 * @desc    Import zone configuration
 * @access  Private
 */
router.post('/:zoneId/import',
    verifyZoneOwnership,
    uploadLimiter,
    upload.single('config_file'),
    importValidation,
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const zone = req.zone;
        const { overwrite_existing = false, apply_to_cloudflare = true } = req.body;

        if (!req.file) {
            throw new AppError('Configuration file is required', 400);
        }

        try {
            // Parse uploaded JSON file
            let importData;
            try {
                importData = JSON.parse(req.file.buffer.toString());
            } catch (parseError) {
                throw new AppError('Invalid JSON file format', 400);
            }

            // Validate import data structure
            if (!importData.metadata || !importData.security_settings) {
                throw new AppError('Invalid configuration file structure', 400);
            }

            // Check version compatibility
            if (importData.metadata.export_version !== '1.0') {
                logger.warn(`Importing config with version ${importData.metadata.export_version}, expected 1.0`);
            }

            const results = {
                zone_updated: false,
                security_config_updated: false,
                cloudflare_applied: false,
                errors: [],
                warnings: []
            };

            // Update zone preferences
            if (importData.preferences) {
                const zoneUpdates = {};

                if (importData.preferences.auto_sync !== undefined) {
                    zoneUpdates.auto_sync = importData.preferences.auto_sync;
                }

                if (importData.preferences.notification_settings) {
                    zoneUpdates.notification_settings = importData.preferences.notification_settings;
                }

                if (importData.zone_info?.tags) {
                    zoneUpdates.tags = importData.zone_info.tags;
                }

                if (importData.zone_info?.notes) {
                    zoneUpdates.notes = importData.zone_info.notes;
                }

                if (Object.keys(zoneUpdates).length > 0) {
                    await zone.update(zoneUpdates);
                    results.zone_updated = true;
                }
            }

            // Update security configuration
            let securityConfig = await SecurityConfig.findByZone(zone.id);
            if (!securityConfig) {
                securityConfig = await SecurityConfig.create({
                    zone_id: zone.id,
                    last_modified_by: req.user.id
                });
            }

            if (importData.security_config || importData.security_settings) {
                // Create backup before importing
                await securityConfig.createBackup();

                const configToImport = importData.security_config || importData.security_settings;

                // Filter out readonly fields
                const {
                    id, zone_id, created_at, updated_at, last_modified_by,
                    last_cloudflare_sync, backup_config, ...updateData
                } = configToImport;

                updateData.last_modified_by = req.user.id;

                if (overwrite_existing || !securityConfig.config_version || securityConfig.config_version === 1) {
                    await securityConfig.update(updateData);
                    results.security_config_updated = true;
                } else {
                    results.warnings.push('Security configuration not updated (overwrite_existing=false)');
                }
            }

            // Apply settings to Cloudflare
            if (apply_to_cloudflare && importData.security_settings) {
                try {
                    const apiToken = zone.getDecryptedApiToken();

                    // Filter settings that can be applied via API
                    const applicableSettings = {
                        security_level: importData.security_settings.security_level,
                        ssl: importData.security_settings.ssl_mode,
                        always_use_https: importData.security_settings.always_use_https,
                        bot_fight_mode: importData.security_settings.bot_fight_mode,
                        browser_integrity_check: importData.security_settings.browser_integrity_check,
                        challenge_ttl: importData.security_settings.challenge_ttl,
                        development_mode: importData.security_settings.development_mode
                    };

                    // Remove undefined values
                    Object.keys(applicableSettings).forEach(key => {
                        if (applicableSettings[key] === undefined) {
                            delete applicableSettings[key];
                        }
                    });

                    if (Object.keys(applicableSettings).length > 0) {
                        const cloudflareResult = await cloudflareService.bulkUpdateSettings(
                            apiToken,
                            zone.cloudflare_zone_id,
                            applicableSettings
                        );

                        if (cloudflareResult.success || cloudflareResult.partial) {
                            results.cloudflare_applied = true;

                            if (cloudflareResult.errors) {
                                results.errors.push(...Object.entries(cloudflareResult.errors).map(
                                    ([setting, error]) => `${setting}: ${error}`
                                ));
                            }
                        } else {
                            results.errors.push('Failed to apply some settings to Cloudflare');
                        }
                    }
                } catch (cloudflareError) {
                    results.errors.push(`Cloudflare API error: ${cloudflareError.message}`);
                }
            }

            // Log import activity
            await AuditLog.createEntry({
                userId: req.user.id,
                zoneId: zone.id,
                action: 'config_imported',
                resourceType: 'zone',
                resourceId: zone.id,
                description: `Configuration imported for zone ${zone.name}`,
                newValues: {
                    source_zone: importData.metadata.zone_name,
                    exported_at: importData.metadata.exported_at,
                    overwrite_existing,
                    apply_to_cloudflare
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                category: 'configuration',
                severity: 'medium',
                metadata: {
                    fileSize: req.file.size,
                    originalFilename: req.file.originalname,
                    importResults: results
                }
            });

            logger.userActivity(req.user.id, 'config_import', {
                zoneId: zone.id,
                zoneName: zone.name,
                sourceZone: importData.metadata.zone_name,
                success: results.errors.length === 0
            });

            const message = results.errors.length === 0 ?
                'Configuration imported successfully' :
                'Configuration imported with some errors';

            res.json({
                message,
                results,
                imported_from: {
                    zone_name: importData.metadata.zone_name,
                    exported_at: importData.metadata.exported_at,
                    exported_by: importData.metadata.exported_by
                }
            });

        } catch (error) {
            logger.error(`Failed to import configuration for zone ${zone.id}:`, error);
            throw error;
        }
    })
);

/**
 * @route   POST /api/config/:zoneId/backup
 * @desc    Create a backup of current configuration
 * @access  Private
 */
router.post('/:zoneId/backup',
    verifyZoneOwnership,
    asyncHandler(async (req, res) => {
        const zone = req.zone;
        const { description } = req.body;

        try {
            // Get or create security config
            let securityConfig = await SecurityConfig.findByZone(zone.id);
            if (!securityConfig) {
                securityConfig = await SecurityConfig.create({
                    zone_id: zone.id,
                    last_modified_by: req.user.id
                });
            }

            // Get current settings from Cloudflare for backup
            const apiToken = zone.getDecryptedApiToken();
            const currentSettings = await cloudflareService.getSecuritySettings(apiToken, zone.cloudflare_zone_id);

            // Create backup
            const backupData = {
                zone_info: {
                    name: zone.name,
                    status: zone.status,
                    plan: zone.plan
                },
                security_settings: currentSettings.success ? currentSettings.settings : {},
                security_config: securityConfig.exportConfig(),
                created_at: new Date().toISOString(),
                description: description || `Backup created on ${new Date().toLocaleString()}`
            };

            await securityConfig.update({
                backup_config: backupData,
                config_version: securityConfig.config_version + 1
            });

            // Log backup creation
            await AuditLog.createEntry({
                userId: req.user.id,
                zoneId: zone.id,
                action: 'config_backup_created',
                resourceType: 'security_config',
                resourceId: securityConfig.id,
                description: `Configuration backup created for zone ${zone.name}`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                category: 'configuration',
                metadata: {
                    backupVersion: securityConfig.config_version,
                    description,
                    backupSize: JSON.stringify(backupData).length
                }
            });

            res.json({
                message: 'Configuration backup created successfully',
                backup: {
                    version: securityConfig.config_version,
                    description: backupData.description,
                    created_at: backupData.created_at,
                    size: JSON.stringify(backupData).length
                }
            });

        } catch (error) {
            logger.error(`Failed to create backup for zone ${zone.id}:`, error);
            throw error;
        }
    })
);

/**
 * @route   GET /api/config/:zoneId/backups
 * @desc    List available backups for a zone
 * @access  Private
 */
router.get('/:zoneId/backups',
    verifyZoneOwnership,
    asyncHandler(async (req, res) => {
        const zone = req.zone;

        // Get security config with backup info
        const securityConfig = await SecurityConfig.findByZone(zone.id);

        if (!securityConfig || !securityConfig.backup_config) {
            return res.json({
                zone: {
                    id: zone.id,
                    name: zone.name
                },
                backups: [],
                message: 'No backups available for this zone'
            });
        }

        const backup = securityConfig.backup_config;

        res.json({
            zone: {
                id: zone.id,
                name: zone.name
            },
            current_version: securityConfig.config_version,
            backups: [
                {
                    version: securityConfig.config_version - 1,
                    description: backup.description || 'Configuration backup',
                    created_at: backup.created_at,
                    size: JSON.stringify(backup).length,
                    has_security_settings: !!backup.security_settings,
                    has_zone_info: !!backup.zone_info
                }
            ]
        });
    })
);

/**
 * @route   POST /api/config/:zoneId/clone
 * @desc    Clone configuration to another zone
 * @access  Private
 */
router.post('/:zoneId/clone',
    verifyZoneOwnership,
    uploadLimiter,
    [
        body('target_zone_id')
            .isUUID()
            .withMessage('Target zone ID must be a valid UUID'),
        body('include_preferences')
            .optional()
            .isBoolean()
            .withMessage('Include preferences must be a boolean'),
        body('apply_immediately')
            .optional()
            .isBoolean()
            .withMessage('Apply immediately must be a boolean')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const sourceZone = req.zone;
        const { target_zone_id, include_preferences = true, apply_immediately = false } = req.body;

        // Verify user owns target zone
        const targetZone = await Zone.findOne({
            where: {
                id: target_zone_id,
                user_id: req.user.id
            }
        });

        if (!targetZone) {
            throw new AppError('Target zone not found or access denied', 404);
        }

        if (sourceZone.id === targetZone.id) {
            throw new AppError('Cannot clone configuration to the same zone', 400);
        }

        try {
            // Get source configuration
            const sourceApiToken = sourceZone.getDecryptedApiToken();
            const sourceSettings = await cloudflareService.getSecuritySettings(sourceApiToken, sourceZone.cloudflare_zone_id);

            if (!sourceSettings.success) {
                throw new AppError('Failed to fetch source zone configuration', 503);
            }

            let sourceSecurityConfig = await SecurityConfig.findByZone(sourceZone.id);
            if (!sourceSecurityConfig) {
                sourceSecurityConfig = await SecurityConfig.create({
                    zone_id: sourceZone.id,
                    last_modified_by: req.user.id
                });
            }

            // Prepare configuration to clone
            const configToClone = {
                security_settings: sourceSettings.settings,
                security_config: sourceSecurityConfig.exportConfig()
            };

            if (include_preferences) {
                configToClone.preferences = {
                    auto_sync: sourceZone.auto_sync,
                    notification_settings: sourceZone.notification_settings,
                    analytics_retention: sourceZone.analytics_retention
                };
                configToClone.zone_info = {
                    tags: sourceZone.tags,
                    notes: `Cloned from ${sourceZone.name} on ${new Date().toISOString()}`
                };
            }

            const results = {
                target_zone_updated: false,
                security_config_created: false,
                cloudflare_applied: false,
                errors: [],
                warnings: []
            };

            // Update target zone preferences
            if (include_preferences && configToClone.preferences) {
                const targetZoneUpdates = {
                    auto_sync: configToClone.preferences.auto_sync,
                    notification_settings: configToClone.preferences.notification_settings,
                    analytics_retention: configToClone.preferences.analytics_retention
                };

                if (configToClone.zone_info?.tags) {
                    targetZoneUpdates.tags = [...(targetZone.tags || []), ...configToClone.zone_info.tags];
                }

                if (configToClone.zone_info?.notes) {
                    targetZoneUpdates.notes = configToClone.zone_info.notes;
                }

                await targetZone.update(targetZoneUpdates);
                results.target_zone_updated = true;
            }

            // Create or update target security configuration
            let targetSecurityConfig = await SecurityConfig.findByZone(targetZone.id);
            if (!targetSecurityConfig) {
                targetSecurityConfig = await SecurityConfig.create({
                    zone_id: targetZone.id,
                    last_modified_by: req.user.id
                });
                results.security_config_created = true;
            } else {
                // Create backup before overwriting
                await targetSecurityConfig.createBackup();
            }

            // Clone security configuration
            const { id, zone_id, created_at, updated_at, ...clonedConfig } = configToClone.security_config;
            clonedConfig.last_modified_by = req.user.id;

            await targetSecurityConfig.update(clonedConfig);

            // Apply to Cloudflare if requested
            if (apply_immediately) {
                try {
                    const targetApiToken = targetZone.getDecryptedApiToken();

                    const applicableSettings = {
                        security_level: configToClone.security_settings.security_level,
                        ssl: configToClone.security_settings.ssl_mode,
                        always_use_https: configToClone.security_settings.always_use_https,
                        bot_fight_mode: configToClone.security_settings.bot_fight_mode,
                        browser_integrity_check: configToClone.security_settings.browser_integrity_check,
                        challenge_ttl: configToClone.security_settings.challenge_ttl,
                        development_mode: configToClone.security_settings.development_mode
                    };

                    // Remove undefined values
                    Object.keys(applicableSettings).forEach(key => {
                        if (applicableSettings[key] === undefined) {
                            delete applicableSettings[key];
                        }
                    });

                    if (Object.keys(applicableSettings).length > 0) {
                        const cloudflareResult = await cloudflareService.bulkUpdateSettings(
                            targetApiToken,
                            targetZone.cloudflare_zone_id,
                            applicableSettings
                        );

                        if (cloudflareResult.success || cloudflareResult.partial) {
                            results.cloudflare_applied = true;

                            if (cloudflareResult.errors) {
                                results.errors.push(...Object.entries(cloudflareResult.errors).map(
                                    ([setting, error]) => `${setting}: ${error}`
                                ));
                            }
                        } else {
                            results.errors.push('Failed to apply some settings to target zone');
                        }
                    }
                } catch (cloudflareError) {
                    results.errors.push(`Cloudflare API error: ${cloudflareError.message}`);
                }
            }

            // Log clone activity for both zones
            const auditData = {
                action: 'config_cloned',
                description: `Configuration cloned from ${sourceZone.name} to ${targetZone.name}`,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                category: 'configuration',
                severity: 'medium',
                metadata: {
                    sourceZoneId: sourceZone.id,
                    targetZoneId: targetZone.id,
                    includePreferences: include_preferences,
                    applyImmediately: apply_immediately,
                    results
                }
            };

            await Promise.all([
                AuditLog.createEntry({
                    userId: req.user.id,
                    zoneId: sourceZone.id,
                    resourceType: 'zone',
                    resourceId: sourceZone.id,
                    ...auditData,
                    description: `Configuration cloned FROM this zone to ${targetZone.name}`
                }),
                AuditLog.createEntry({
                    userId: req.user.id,
                    zoneId: targetZone.id,
                    resourceType: 'zone',
                    resourceId: targetZone.id,
                    ...auditData,
                    description: `Configuration cloned TO this zone from ${sourceZone.name}`
                })
            ]);

            logger.userActivity(req.user.id, 'config_clone', {
                sourceZoneId: sourceZone.id,
                sourceZoneName: sourceZone.name,
                targetZoneId: targetZone.id,
                targetZoneName: targetZone.name,
                success: results.errors.length === 0
            });

            const message = results.errors.length === 0 ?
                'Configuration cloned successfully' :
                'Configuration cloned with some errors';

            res.json({
                message,
                source_zone: {
                    id: sourceZone.id,
                    name: sourceZone.name
                },
                target_zone: {
                    id: targetZone.id,
                    name: targetZone.name
                },
                results,
                cloned_at: new Date().toISOString()
            });

        } catch (error) {
            logger.error(`Failed to clone configuration from zone ${sourceZone.id} to ${target_zone_id}:`, error);
            throw error;
        }
    })
);

/**
 * @route   GET /api/config/templates
 * @desc    Get available configuration templates
 * @access  Private
 */
router.get('/templates',
    asyncHandler(async (req, res) => {
        // Get user's custom templates
        const customTemplates = await SecurityConfig.getTemplates();

        // Built-in templates
        const builtInTemplates = [
            {
                id: 'basic_protection',
                template_name: 'Basic Protection',
                notes: 'Recommended security settings for most websites',
                category: 'general',
                settings: {
                    security_level: 'medium',
                    ssl_mode: 'full',
                    always_use_https: true,
                    bot_fight_mode: true,
                    browser_integrity_check: true,
                    challenge_ttl: 1800,
                    development_mode: false
                }
            },
            {
                id: 'high_security',
                template_name: 'High Security',
                notes: 'Maximum protection for sensitive websites and applications',
                category: 'security',
                settings: {
                    security_level: 'high',
                    ssl_mode: 'strict',
                    always_use_https: true,
                    bot_fight_mode: true,
                    browser_integrity_check: true,
                    challenge_ttl: 900,
                    development_mode: false
                }
            },
            {
                id: 'development',
                template_name: 'Development Mode',
                notes: 'Relaxed settings for development and testing environments',
                category: 'development',
                settings: {
                    security_level: 'low',
                    ssl_mode: 'flexible',
                    always_use_https: false,
                    bot_fight_mode: false,
                    browser_integrity_check: false,
                    development_mode: true,
                    challenge_ttl: 3600
                }
            },
            {
                id: 'ecommerce',
                template_name: 'E-commerce Security',
                notes: 'Optimized settings for online stores and payment processing',
                category: 'ecommerce',
                settings: {
                    security_level: 'high',
                    ssl_mode: 'strict',
                    always_use_https: true,
                    bot_fight_mode: true,
                    browser_integrity_check: true,
                    challenge_ttl: 1200,
                    development_mode: false
                }
            },
            {
                id: 'api_service',
                template_name: 'API Service',
                notes: 'Settings optimized for API endpoints and web services',
                category: 'api',
                settings: {
                    security_level: 'medium',
                    ssl_mode: 'strict',
                    always_use_https: true,
                    bot_fight_mode: true,
                    browser_integrity_check: false,
                    challenge_ttl: 2400,
                    development_mode: false
                }
            }
        ];

        res.json({
            built_in_templates: builtInTemplates,
            custom_templates: customTemplates.map(template => ({
                id: template.id,
                template_name: template.template_name,
                notes: template.notes,
                category: 'custom',
                created_at: template.created_at,
                settings: template.exportConfig()
            })),
            total_templates: builtInTemplates.length + customTemplates.length
        });
    })
);

/**
 * @route   POST /api/config/templates
 * @desc    Create a custom configuration template
 * @access  Private
 */
router.post('/templates',
    [
        body('template_name')
            .trim()
            .isLength({ min: 3, max: 100 })
            .withMessage('Template name must be between 3 and 100 characters'),
        body('notes')
            .optional()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Notes must be less than 500 characters'),
        body('source_zone_id')
            .isUUID()
            .withMessage('Source zone ID must be a valid UUID')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { template_name, notes, source_zone_id } = req.body;

        // Verify user owns source zone
        const sourceZone = await Zone.findOne({
            where: {
                id: source_zone_id,
                user_id: req.user.id
            }
        });

        if (!sourceZone) {
            throw new AppError('Source zone not found or access denied', 404);
        }

        // Get source configuration
        const sourceSecurityConfig = await SecurityConfig.findByZone(sourceZone.id);
        if (!sourceSecurityConfig) {
            throw new AppError('No security configuration found for source zone', 404);
        }

        // Create template
        const templateConfig = sourceSecurityConfig.exportConfig();
        templateConfig.is_template = true;
        templateConfig.template_name = template_name;
        templateConfig.notes = notes;
        templateConfig.zone_id = null; // Templates are not tied to specific zones

        const template = await SecurityConfig.create(templateConfig);

        // Log template creation
        await AuditLog.createEntry({
            userId: req.user.id,
            zoneId: sourceZone.id,
            action: 'template_created',
            resourceType: 'security_config',
            resourceId: template.id,
            description: `Configuration template '${template_name}' created from zone ${sourceZone.name}`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            category: 'configuration',
            metadata: {
                templateName: template_name,
                sourceZoneId: sourceZone.id,
                sourceZoneName: sourceZone.name
            }
        });

        logger.userActivity(req.user.id, 'template_create', {
            templateId: template.id,
            templateName: template_name,
            sourceZoneId: sourceZone.id,
            sourceZoneName: sourceZone.name
        });

        res.status(201).json({
            message: 'Configuration template created successfully',
            template: {
                id: template.id,
                template_name: template.template_name,
                notes: template.notes,
                created_at: template.created_at,
                source_zone: {
                    id: sourceZone.id,
                    name: sourceZone.name
                }
            }
        });
    })
);

/**
 * @route   DELETE /api/config/templates/:templateId
 * @desc    Delete a custom configuration template
 * @access  Private
 */
router.delete('/templates/:templateId',
    asyncHandler(async (req, res) => {
        const { templateId } = req.params;

        const template = await SecurityConfig.findOne({
            where: {
                id: templateId,
                is_template: true
            }
        });

        if (!template) {
            throw new AppError('Template not found', 404);
        }

        // Log template deletion
        await AuditLog.createEntry({
            userId: req.user.id,
            action: 'template_deleted',
            resourceType: 'security_config',
            resourceId: template.id,
            description: `Configuration template '${template.template_name}' deleted`,
            oldValues: {
                templateName: template.template_name,
                notes: template.notes
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            category: 'configuration',
            severity: 'medium'
        });

        await template.destroy();

        logger.userActivity(req.user.id, 'template_delete', {
            templateId: template.id,
            templateName: template.template_name
        });

        res.json({
            message: 'Configuration template deleted successfully'
        });
    })
);

module.exports = router;