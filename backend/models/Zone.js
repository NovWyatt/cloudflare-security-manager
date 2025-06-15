const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Zone = sequelize.define('Zone', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },

    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },

    cloudflare_zone_id: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            len: {
                args: [32, 32],
                msg: 'Cloudflare Zone ID must be 32 characters'
            }
        }
    },

    name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isUrl: {
                protocols: [],
                require_tld: true,
                require_protocol: false,
                msg: 'Please provide a valid domain name'
            }
        }
    },

    status: {
        type: DataTypes.ENUM('active', 'pending', 'initializing', 'moved', 'deleted', 'deactivated'),
        defaultValue: 'pending',
        allowNull: false
    },

    plan: {
        type: DataTypes.ENUM('free', 'pro', 'business', 'enterprise'),
        defaultValue: 'free',
        allowNull: false
    },

    is_paused: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },

    name_servers: {
        type: DataTypes.JSON,
        defaultValue: []
    },

    original_name_servers: {
        type: DataTypes.JSON,
        defaultValue: []
    },

    cloudflare_api_token: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'API Token is required'
            }
        }
    },

    permissions: {
        type: DataTypes.JSON,
        defaultValue: {
            read: true,
            edit: true,
            zone_settings: true,
            dns: false,
            ssl: true,
            cache: false,
            analytics: true
        }
    },

    settings_cache: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'Cached Cloudflare settings to reduce API calls'
    },

    last_sync: {
        type: DataTypes.DATE,
        allowNull: true
    },

    sync_status: {
        type: DataTypes.ENUM('success', 'error', 'pending', 'never'),
        defaultValue: 'never',
        allowNull: false
    },

    sync_error: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    auto_sync: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },

    notification_settings: {
        type: DataTypes.JSON,
        defaultValue: {
            security_changes: true,
            ssl_expiry: true,
            downtime_alerts: false,
            weekly_reports: true
        }
    },

    analytics_retention: {
        type: DataTypes.INTEGER,
        defaultValue: 30,
        allowNull: false,
        validate: {
            min: 1,
            max: 365
        }
    },

    tags: {
        type: DataTypes.JSON,
        defaultValue: []
    },

    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },

    is_favorite: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    }
}, {
    tableName: 'zones',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    // Indexes for performance
    indexes: [
        {
            fields: ['user_id']
        },
        {
            unique: true,
            fields: ['cloudflare_zone_id']
        },
        {
            fields: ['status']
        },
        {
            fields: ['plan']
        },
        {
            fields: ['is_favorite']
        },
        {
            fields: ['last_sync']
        },
        {
            fields: ['sync_status']
        }
    ],

    // Hooks
    hooks: {
        beforeCreate: async (zone) => {
            // Encrypt API token
            if (zone.cloudflare_api_token) {
                const encryptionService = require('../services/encryptionService');
                zone.cloudflare_api_token = encryptionService.encrypt(zone.cloudflare_api_token);
            }

            // Set default tags based on plan
            if (!zone.tags || zone.tags.length === 0) {
                zone.tags = [zone.plan];
            }
        },

        beforeUpdate: async (zone) => {
            // Encrypt API token if changed
            if (zone.changed('cloudflare_api_token')) {
                const encryptionService = require('../services/encryptionService');
                zone.cloudflare_api_token = encryptionService.encrypt(zone.cloudflare_api_token);
            }

            // Update sync status
            if (zone.changed('settings_cache')) {
                zone.last_sync = new Date();
                zone.sync_status = 'success';
                zone.sync_error = null;
            }
        }
    }
});

// Instance methods
Zone.prototype.getDecryptedApiToken = function () {
    try {
        const encryptionService = require('../services/encryptionService');
        return encryptionService.decrypt(this.cloudflare_api_token);
    } catch (error) {
        throw new Error('Failed to decrypt API token');
    }
};

Zone.prototype.updateSyncStatus = async function (status, error = null) {
    const updates = {
        sync_status: status,
        last_sync: new Date()
    };

    if (error) {
        updates.sync_error = error;
    } else {
        updates.sync_error = null;
    }

    return this.update(updates);
};

Zone.prototype.cacheSettings = async function (settings) {
    return this.update({
        settings_cache: settings,
        last_sync: new Date(),
        sync_status: 'success',
        sync_error: null
    });
};

Zone.prototype.needsSync = function () {
    if (!this.auto_sync) return false;
    if (this.sync_status === 'never') return true;

    const maxAge = 5 * 60 * 1000; // 5 minutes
    const lastSync = this.last_sync ? new Date(this.last_sync) : new Date(0);

    return (Date.now() - lastSync.getTime()) > maxAge;
};

Zone.prototype.canPerformAction = function (action) {
    const permissions = this.permissions || {};

    const actionMap = {
        'read': permissions.read,
        'edit': permissions.edit,
        'security': permissions.zone_settings,
        'ssl': permissions.ssl,
        'analytics': permissions.analytics,
        'dns': permissions.dns,
        'cache': permissions.cache
    };

    return actionMap[action] || false;
};

Zone.prototype.addTag = async function (tag) {
    const tags = [...(this.tags || [])];
    if (!tags.includes(tag)) {
        tags.push(tag);
        return this.update({ tags });
    }
    return this;
};

Zone.prototype.removeTag = async function (tag) {
    const tags = (this.tags || []).filter(t => t !== tag);
    return this.update({ tags });
};

Zone.prototype.toggleFavorite = async function () {
    return this.update({ is_favorite: !this.is_favorite });
};

Zone.prototype.updateNotificationSettings = async function (settings) {
    const currentSettings = this.notification_settings || {};
    const newSettings = { ...currentSettings, ...settings };
    return this.update({ notification_settings: newSettings });
};

Zone.prototype.getAnalyticsConfig = function () {
    return {
        retention_days: this.analytics_retention,
        enabled: this.canPerformAction('analytics'),
        last_sync: this.last_sync
    };
};

Zone.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());

    // Remove sensitive fields
    delete values.cloudflare_api_token;

    // Add computed fields
    values.needs_sync = this.needsSync();
    values.is_active = this.status === 'active';
    values.has_errors = this.sync_status === 'error';

    return values;
};

// Class methods
Zone.findByUser = function (userId, options = {}) {
    const where = { user_id: userId };

    if (options.status) {
        where.status = options.status;
    }

    if (options.plan) {
        where.plan = options.plan;
    }

    if (options.favorites_only) {
        where.is_favorite = true;
    }

    return this.findAll({
        where,
        order: [
            ['is_favorite', 'DESC'],
            ['name', 'ASC']
        ],
        ...options
    });
};

Zone.findByCloudflareId = function (cloudflareZoneId) {
    return this.findOne({
        where: { cloudflare_zone_id: cloudflareZoneId }
    });
};

Zone.findActiveZones = function (userId = null) {
    const where = {
        status: 'active',
        is_paused: false
    };

    if (userId) {
        where.user_id = userId;
    }

    return this.findAll({ where });
};

Zone.findZonesNeedingSync = function () {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    return this.findAll({
        where: {
            auto_sync: true,
            status: 'active',
            [sequelize.Sequelize.Op.or]: [
                { sync_status: 'never' },
                {
                    last_sync: {
                        [sequelize.Sequelize.Op.lt]: fiveMinutesAgo
                    }
                }
            ]
        }
    });
};

Zone.getStatsForUser = async function (userId) {
    const zones = await this.findAll({
        where: { user_id: userId },
        attributes: ['status', 'plan', 'sync_status']
    });

    const stats = {
        total: zones.length,
        active: 0,
        pending: 0,
        errors: 0,
        by_plan: {
            free: 0,
            pro: 0,
            business: 0,
            enterprise: 0
        }
    };

    zones.forEach(zone => {
        if (zone.status === 'active') stats.active++;
        if (zone.status === 'pending') stats.pending++;
        if (zone.sync_status === 'error') stats.errors++;

        stats.by_plan[zone.plan]++;
    });

    return stats;
};

module.exports = Zone;