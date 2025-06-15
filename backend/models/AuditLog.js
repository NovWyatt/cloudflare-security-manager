const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },

    user_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'SET NULL'
    },

    zone_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'zones',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },

    action: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [1, 100]
        }
    },

    resource_type: {
        type: DataTypes.ENUM(
            'user', 'zone', 'security_config', 'ssl_setting',
            'firewall_rule', 'dns_record', 'page_rule',
            'rate_limit', 'bot_management', 'api_token'
        ),
        allowNull: false
    },

    resource_id: {
        type: DataTypes.STRING,
        allowNull: true
    },

    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },

    old_values: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Previous values before change'
    },

    new_values: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'New values after change'
    },

    ip_address: {
        type: DataTypes.INET,
        allowNull: true
    },

    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    status: {
        type: DataTypes.ENUM('success', 'failed', 'pending'),
        defaultValue: 'success',
        allowNull: false
    },

    error_message: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    severity: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        defaultValue: 'low',
        allowNull: false
    },

    category: {
        type: DataTypes.ENUM(
            'authentication', 'authorization', 'configuration',
            'security', 'data_access', 'system', 'api'
        ),
        defaultValue: 'configuration',
        allowNull: false
    },

    metadata: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'Additional context and metadata'
    },

    session_id: {
        type: DataTypes.STRING,
        allowNull: true
    },

    correlation_id: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Groups related audit entries'
    },

    duration_ms: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Time taken to complete the action'
    },

    cloudflare_response: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Response from Cloudflare API if applicable'
    },

    tags: {
        type: DataTypes.JSON,
        defaultValue: [],
        comment: 'Tags for categorizing and filtering'
    }
}, {
    tableName: 'audit_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // Audit logs should be immutable

    // Indexes for performance
    indexes: [
        {
            fields: ['user_id']
        },
        {
            fields: ['zone_id']
        },
        {
            fields: ['action']
        },
        {
            fields: ['resource_type']
        },
        {
            fields: ['resource_id']
        },
        {
            fields: ['status']
        },
        {
            fields: ['severity']
        },
        {
            fields: ['category']
        },
        {
            fields: ['created_at']
        },
        {
            fields: ['correlation_id']
        },
        {
            fields: ['ip_address']
        },
        {
            // Composite index for common queries
            fields: ['user_id', 'created_at']
        },
        {
            // Composite index for zone-specific queries
            fields: ['zone_id', 'action', 'created_at']
        }
    ],

    // Hooks
    hooks: {
        beforeCreate: async (auditLog) => {
            // Generate correlation ID if not provided
            if (!auditLog.correlation_id) {
                auditLog.correlation_id = DataTypes.UUIDV4();
            }

            // Auto-detect severity based on action
            if (!auditLog.severity || auditLog.severity === 'low') {
                auditLog.severity = auditLog.detectSeverity();
            }

            // Add default tags
            if (!auditLog.tags || auditLog.tags.length === 0) {
                auditLog.tags = [auditLog.action, auditLog.resource_type];
            }
        }
    }
});

// Instance methods
AuditLog.prototype.detectSeverity = function () {
    const highSeverityActions = [
        'delete', 'disable_security', 'change_ssl_mode',
        'disable_bot_protection', 'add_firewall_rule',
        'change_security_level', 'api_token_created'
    ];

    const mediumSeverityActions = [
        'update', 'enable', 'disable', 'change_settings',
        'login_failed', 'password_reset_requested'
    ];

    const criticalSeverityActions = [
        'zone_deleted', 'user_deleted', 'api_token_compromised',
        'security_breach', 'unauthorized_access'
    ];

    if (criticalSeverityActions.some(action => this.action.includes(action))) {
        return 'critical';
    }

    if (highSeverityActions.some(action => this.action.includes(action))) {
        return 'high';
    }

    if (mediumSeverityActions.some(action => this.action.includes(action))) {
        return 'medium';
    }

    return 'low';
};

AuditLog.prototype.isSecurityRelated = function () {
    const securityCategories = ['authentication', 'authorization', 'security'];
    const securityActions = [
        'login', 'logout', 'password', 'token', 'ssl', 'firewall',
        'bot_protection', 'security_level', 'access_rule'
    ];

    return securityCategories.includes(this.category) ||
        securityActions.some(action => this.action.toLowerCase().includes(action));
};

AuditLog.prototype.getFormattedDescription = function () {
    let description = this.description;

    // Add user context
    if (this.user_id) {
        description = `User ${this.user_id}: ${description}`;
    }

    // Add zone context
    if (this.zone_id) {
        description = `${description} (Zone: ${this.zone_id})`;
    }

    // Add status context
    if (this.status !== 'success') {
        description = `${description} [${this.status.toUpperCase()}]`;
    }

    return description;
};

AuditLog.prototype.getDuration = function () {
    if (!this.duration_ms) return null;

    if (this.duration_ms < 1000) {
        return `${this.duration_ms}ms`;
    }

    const seconds = Math.round(this.duration_ms / 1000 * 100) / 100;
    return `${seconds}s`;
};

AuditLog.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());

    // Add computed fields
    values.formatted_description = this.getFormattedDescription();
    values.duration_formatted = this.getDuration();
    values.is_security_related = this.isSecurityRelated();

    return values;
};

// Class methods
AuditLog.createEntry = async function (data) {
    const {
        userId,
        zoneId,
        action,
        resourceType,
        resourceId,
        description,
        oldValues,
        newValues,
        ipAddress,
        userAgent,
        status = 'success',
        errorMessage,
        severity,
        category = 'configuration',
        metadata = {},
        sessionId,
        correlationId,
        durationMs,
        cloudflareResponse,
        tags = []
    } = data;

    return this.create({
        user_id: userId,
        zone_id: zoneId,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        description,
        old_values: oldValues,
        new_values: newValues,
        ip_address: ipAddress,
        user_agent: userAgent,
        status,
        error_message: errorMessage,
        severity,
        category,
        metadata,
        session_id: sessionId,
        correlation_id: correlationId,
        duration_ms: durationMs,
        cloudflare_response: cloudflareResponse,
        tags
    });
};

AuditLog.getByUser = function (userId, options = {}) {
    const {
        limit = 50,
        offset = 0,
        category,
        severity,
        dateFrom,
        dateTo,
        action
    } = options;

    const where = { user_id: userId };

    if (category) where.category = category;
    if (severity) where.severity = severity;
    if (action) where.action = { [sequelize.Sequelize.Op.iLike]: `%${action}%` };

    if (dateFrom || dateTo) {
        where.created_at = {};
        if (dateFrom) where.created_at[sequelize.Sequelize.Op.gte] = dateFrom;
        if (dateTo) where.created_at[sequelize.Sequelize.Op.lte] = dateTo;
    }

    return this.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit,
        offset,
        include: [
            {
                model: require('./Zone'),
                as: 'zone',
                attributes: ['name', 'status']
            }
        ]
    });
};

AuditLog.getByZone = function (zoneId, options = {}) {
    const {
        limit = 50,
        offset = 0,
        category,
        severity,
        dateFrom,
        dateTo
    } = options;

    const where = { zone_id: zoneId };

    if (category) where.category = category;
    if (severity) where.severity = severity;

    if (dateFrom || dateTo) {
        where.created_at = {};
        if (dateFrom) where.created_at[sequelize.Sequelize.Op.gte] = dateFrom;
        if (dateTo) where.created_at[sequelize.Sequelize.Op.lte] = dateTo;
    }

    return this.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit,
        offset,
        include: [
            {
                model: require('./User'),
                as: 'user',
                attributes: ['name', 'email']
            }
        ]
    });
};

AuditLog.getSecurityEvents = function (options = {}) {
    const {
        limit = 100,
        offset = 0,
        severity,
        dateFrom,
        dateTo,
        userId,
        zoneId
    } = options;

    const where = {
        category: ['authentication', 'authorization', 'security']
    };

    if (severity) where.severity = severity;
    if (userId) where.user_id = userId;
    if (zoneId) where.zone_id = zoneId;

    if (dateFrom || dateTo) {
        where.created_at = {};
        if (dateFrom) where.created_at[sequelize.Sequelize.Op.gte] = dateFrom;
        if (dateTo) where.created_at[sequelize.Sequelize.Op.lte] = dateTo;
    }

    return this.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit,
        offset,
        include: [
            {
                model: require('./User'),
                as: 'user',
                attributes: ['name', 'email']
            },
            {
                model: require('./Zone'),
                as: 'zone',
                attributes: ['name', 'status']
            }
        ]
    });
};

AuditLog.getStatistics = async function (options = {}) {
    const {
        dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        dateTo = new Date(),
        userId,
        zoneId
    } = options;

    const where = {
        created_at: {
            [sequelize.Sequelize.Op.between]: [dateFrom, dateTo]
        }
    };

    if (userId) where.user_id = userId;
    if (zoneId) where.zone_id = zoneId;

    const [
        totalEntries,
        byCategory,
        bySeverity,
        byStatus,
        securityEvents
    ] = await Promise.all([
        this.count({ where }),
        this.findAll({
            where,
            attributes: [
                'category',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: 'category',
            raw: true
        }),
        this.findAll({
            where,
            attributes: [
                'severity',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: 'severity',
            raw: true
        }),
        this.findAll({
            where,
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: 'status',
            raw: true
        }),
        this.count({
            where: {
                ...where,
                category: ['authentication', 'authorization', 'security']
            }
        })
    ]);

    return {
        total_entries: totalEntries,
        security_events: securityEvents,
        by_category: byCategory.reduce((acc, item) => {
            acc[item.category] = parseInt(item.count);
            return acc;
        }, {}),
        by_severity: bySeverity.reduce((acc, item) => {
            acc[item.severity] = parseInt(item.count);
            return acc;
        }, {}),
        by_status: byStatus.reduce((acc, item) => {
            acc[item.status] = parseInt(item.count);
            return acc;
        }, {}),
        date_range: {
            from: dateFrom,
            to: dateTo
        }
    };
};

// Auto-cleanup old audit logs (retention policy)
AuditLog.cleanup = async function (retentionDays = 365) {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const deletedCount = await this.destroy({
        where: {
            created_at: {
                [sequelize.Sequelize.Op.lt]: cutoffDate
            }
        }
    });

    return deletedCount;
};

module.exports = AuditLog;