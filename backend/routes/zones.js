const express = require('express');
const { body, query, validationResult } = require('express-validator');

const { Zone, SecurityConfig, AuditLog, User } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate, verifyZoneOwnership } = require('../middleware/auth');
const { cloudflareApiLimiter } = require('../middleware/rateLimiter');
const cloudflareService = require('../services/cloudflareService');
const encryptionService = require('../services/encryptionService');
const logger = require('../utils/logger');

const router = express.Router();

// All zone routes require authentication
router.use(authenticate);

// Validation rules
const addZoneValidation = [
    body('cloudflare_zone_id')
        .isLength({ min: 32, max: 32 })
        .withMessage('Cloudflare Zone ID must be 32 characters')
        .matches(/^[a-f0-9]+$/)
        .withMessage('Cloudflare Zone ID must be a valid hexadecimal string'),
    body('api_token')
        .notEmpty()
        .withMessage('API token is required')
        .isLength({ min: 40 })
        .withMessage('API token appears to be invalid'),
    body('name')
        .optional()
        .isURL({ protocols: [], require_tld: true, require_protocol: false })
        .withMessage('Domain name must be valid')
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
 * @route   GET /api/zones
 * @desc    Get all zones for the authenticated user
 * @access  Private
 */
router.get('/',
    asyncHandler(async (req, res) => {
        const { page = 1, limit = 20 } = req.query;

        const zones = await Zone.findByUser(req.user.id, {
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        });

        const totalZones = await Zone.count({
            where: { user_id: req.user.id }
        });

        const stats = await Zone.getStatsForUser(req.user.id);

        res.json({
            zones,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalZones,
                pages: Math.ceil(totalZones / parseInt(limit))
            },
            stats
        });
    })
);

/**
 * @route   GET /api/zones/:zoneId
 * @desc    Get zone details
 * @access  Private
 */
router.get('/:zoneId',
    verifyZoneOwnership,
    asyncHandler(async (req, res) => {
        const zone = req.zone;

        const zoneWithDetails = await Zone.findByPk(zone.id, {
            include: [
                {
                    model: SecurityConfig,
                    as: 'security_config'
                }
            ]
        });

        const needsSync = zone.needsSync();

        const recentLogs = await AuditLog.getByZone(zone.id, {
            limit: 10
        });

        res.json({
            zone: {
                ...zoneWithDetails.toJSON(),
                needs_sync: needsSync
            },
            recent_activity: recentLogs.rows
        });
    })
);

/**
 * @route   POST /api/zones
 * @desc    Add a new zone
 * @access  Private
 */
router.post('/',
    cloudflareApiLimiter,
    addZoneValidation,
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { cloudflare_zone_id, api_token, name } = req.body;

        // Check if zone already exists
        const existingZone = await Zone.findByCloudflareId(cloudflare_zone_id);
        if (existingZone) {
            throw new AppError('This zone is already registered in the system', 409);
        }

        // Verify token
        const tokenValid = await cloudflareService.testToken(api_token);
        if (!tokenValid.valid) {
            throw new AppError('Invalid Cloudflare API token', 401);
        }

        // Verify zone access
        const hasAccess = await cloudflareService.verifyZoneAccess(api_token, cloudflare_zone_id);
        if (!hasAccess) {
            throw new AppError('Token does not have access to this zone', 403);
        }

        // Get zone details
        const zoneDetails = await cloudflareService.getZone(api_token, cloudflare_zone_id);

        if (!zoneDetails.success) {
            throw new AppError('Failed to fetch zone details from Cloudflare', 503);
        }

        const cfZone = zoneDetails.zone;

        // Create zone
        const zone = await Zone.create({
            user_id: req.user.id,
            cloudflare_zone_id,
            name: name || cfZone.name,
            status: cfZone.status,
            plan: cfZone.plan?.name || 'free',
            is_paused: cfZone.paused,
            name_servers: cfZone.name_servers || [],
            original_name_servers: cfZone.original_name_servers || [],
            cloudflare_api_token: api_token,
            auto_sync: true
        });

        // Create security config
        const securityConfig = await SecurityConfig.create({
            zone_id: zone.id,
            last_modified_by: req.user.id
        });

        // Log zone addition
        await AuditLog.createEntry({
            userId: req.user.id,
            zoneId: zone.id,
            action: 'zone_added',
            resourceType: 'zone',
            resourceId: zone.id,
            description: `New zone added: ${zone.name}`,
            newValues: {
                name: zone.name,
                status: zone.status,
                plan: zone.plan
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            category: 'configuration'
        });

        logger.userActivity(req.user.id, 'zone_add', {
            zoneId: zone.id,
            zoneName: zone.name,
            plan: zone.plan
        });

        res.status(201).json({
            message: 'Zone added successfully',
            zone: {
                ...zone.toJSON(),
                security_config: securityConfig
            }
        });
    })
);

/**
 * @route   PUT /api/zones/:zoneId
 * @desc    Update zone settings
 * @access  Private
 */
router.put('/:zoneId',
    verifyZoneOwnership,
    asyncHandler(async (req, res) => {
        const zone = req.zone;
        const updates = req.body;

        const oldValues = {
            name: zone.name,
            auto_sync: zone.auto_sync,
            notification_settings: zone.notification_settings,
            tags: zone.tags,
            notes: zone.notes
        };

        await zone.update(updates);

        // Log zone update
        await AuditLog.createEntry({
            userId: req.user.id,
            zoneId: zone.id,
            action: 'zone_updated',
            resourceType: 'zone',
            resourceId: zone.id,
            description: `Zone settings updated: ${zone.name}`,
            oldValues,
            newValues: updates,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            category: 'configuration'
        });

        res.json({
            message: 'Zone updated successfully',
            zone: zone.toJSON()
        });
    })
);

/**
 * @route   DELETE /api/zones/:zoneId
 * @desc    Remove zone from management
 * @access  Private
 */
router.delete('/:zoneId',
    verifyZoneOwnership,
    asyncHandler(async (req, res) => {
        const zone = req.zone;

        // Log zone removal
        await AuditLog.createEntry({
            userId: req.user.id,
            zoneId: zone.id,
            action: 'zone_removed',
            resourceType: 'zone',
            resourceId: zone.id,
            description: `Zone removed from management: ${zone.name}`,
            oldValues: {
                name: zone.name,
                status: zone.status,
                plan: zone.plan
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            category: 'configuration',
            severity: 'high'
        });

        await zone.destroy();

        res.json({
            message: 'Zone removed successfully'
        });
    })
);

module.exports = router;