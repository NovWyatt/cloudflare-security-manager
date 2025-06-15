const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SecurityConfig = sequelize.define('SecurityConfig', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },

    zone_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'zones',
            key: 'id'
        },
        onDelete: 'CASCADE'
    },

    // Security Level Settings
    security_level: {
        type: DataTypes.ENUM('off', 'essentially_off', 'low', 'medium', 'high', 'under_attack'),
        defaultValue: 'medium',
        allowNull: false
    },

    // SSL/TLS Settings
    ssl_mode: {
        type: DataTypes.ENUM('off', 'flexible', 'full', 'strict'),
        defaultValue: 'full',
        allowNull: false
    },

    always_use_https: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },

    min_tls_version: {
        type: DataTypes.ENUM('1.0', '1.1', '1.2', '1.3'),
        defaultValue: '1.2',
        allowNull: false
    },

    opportunistic_encryption: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },

    tls_1_3: {
        type: DataTypes.ENUM('off', 'on', 'zrt'),
        defaultValue: 'on',
        allowNull: false
    },

    automatic_https_rewrites: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },

    // Bot Protection
    bot_fight_mode: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },

    super_bot_fight_mode: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },

    // Browser & Challenge Settings
    browser_integrity_check: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },

    challenge_ttl: {
        type: DataTypes.INTEGER,
        defaultValue: 1800, // 30 minutes
        allowNull: false,
        validate: {
            min: 300,   // 5 minutes
            max: 31536000 // 1 year
        }
    },

    privacy_pass: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },

    // Security Headers
    security_headers: {
        type: DataTypes.JSON,
        defaultValue: {
            hsts: {
                enabled: true,
                max_age: 31536000,
                include_subdomains: true,
                preload: false
            },
            x_frame_options: 'DENY',
            x_content_type_options: 'nosniff',
            x_xss_protection: '1; mode=block',
            referrer_policy: 'strict-origin-when-cross-origin'
        }
    },

    // DDoS Protection
    ddos_protection: {
        type: DataTypes.JSON,
        defaultValue: {
            enabled: true,
            sensitivity: 'medium',
            unmetered_mitigation: false
        }
    },

    // Rate Limiting
    rate_limiting: {
        type: DataTypes.JSON,
        defaultValue: {
            enabled: false,
            rules: []
        }
    },

    // WAF Settings
    waf: {
        type: DataTypes.JSON,
        defaultValue: {
            enabled: true,
            managed_rules: {
                cloudflare_managed: true,
                cloudflare_specials: true,
                owasp_core: false
            },
            custom_rules: []
        }
    },

    // IP Access Rules
    ip_access_rules: {
        type: DataTypes.JSON,
        defaultValue: {
            whitelist: [],
            blacklist: [],
            challenge: []
        }
    },

    // Country Access Rules
    country_access_rules: {
        type: DataTypes.JSON,
        defaultValue: {
            whitelist: [],
            blacklist: [],
            challenge: []
        }
    },

    // Firewall Rules
    firewall_rules: {
        type: DataTypes.JSON,
        defaultValue: {
            enabled: true,
            rules: []
        }
    },

    // Scrape Shield
    scrape_shield: {
        type: DataTypes.JSON,
        defaultValue: {
            email_obfuscation: true,
            server_side_excludes: true,
            hotlink_protection: false
        }
    },

    // Development Mode
    development_mode: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },

    development_mode_expires: {
        type: DataTypes.DATE,
        allowNull: true
    },

    // Backup Configuration
    backup_config: {
        type: DataTypes.JSON,
        defaultValue: {},
        comment: 'Previous configuration for rollback'
    },

    // Metadata
    last_modified_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },

    last_cloudflare_sync: {
        type: DataTypes.DATE,
        allowNull: true
    },

    config_version: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false
    },

    is_template: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },

    template_name: {
        type: DataTypes.STRING,
        allowNull: true
    },

    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'security_configs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    // Indexes
    indexes: [
        {
            fields: ['zone_id']
        },
        {
            fields: ['security_level']
        },
        {
            fields: ['ssl_mode']
        },
        {
            fields: ['is_template']
        },
        {
            fields: ['last_cloudflare_sync']
        }
    ],

    // Hooks
    hooks: {
        beforeUpdate: async (config) => {
            // Create backup of current config before updating
            if (config.changed() && !config.changed('backup_config')) {
                const originalConfig = { ...config._previousDataValues };
                delete originalConfig.backup_config;
                delete originalConfig.updated_at;
                delete originalConfig.config_version;

                config.backup_config = originalConfig;
                config.config_version = (config.config_version || 1) + 1;
            }

            // Update development mode expiry
            if (config.changed('development_mode') && config.development_mode) {
                config.development_mode_expires = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours
            } else if (config.changed('development_mode') && !config.development_mode) {
                config.development_mode_expires = null;
            }
        }
    }
});

// Instance methods
SecurityConfig.prototype.getSecurityScore = function () {
    let score = 0;
    const maxScore = 100;

    // Security Level (20 points)
    const securityLevelPoints = {
        'off': 0,
        'essentially_off': 2,
        'low': 8,
        'medium': 14,
        'high': 18,
        'under_attack': 20
    };
    score += securityLevelPoints[this.security_level] || 0;

    // SSL/TLS (25 points)
    const sslModePoints = {
        'off': 0,
        'flexible': 8,
        'full': 18,
        'strict': 25
    };
    score += sslModePoints[this.ssl_mode] || 0;

    // HTTPS Settings (15 points)
    if (this.always_use_https) score += 8;
    if (this.automatic_https_rewrites) score += 4;
    if (this.min_tls_version === '1.3') score += 3;
    else if (this.min_tls_version === '1.2') score += 2;

    // Bot Protection (15 points)
    if (this.bot_fight_mode) score += 8;
    if (this.super_bot_fight_mode) score += 7;

    // Browser & Challenge (10 points)
    if (this.browser_integrity_check) score += 5;
    if (this.privacy_pass) score += 3;
    if (this.challenge_ttl <= 3600) score += 2; // Shorter TTL is more secure

    // Security Headers (10 points)
    if (this.security_headers?.hsts?.enabled) score += 4;
    if (this.security_headers?.x_frame_options) score += 2;
    if (this.security_headers?.x_content_type_options) score += 2;
    if (this.security_headers?.x_xss_protection) score += 2;

    // Scrape Shield (5 points)
    if (this.scrape_shield?.email_obfuscation) score += 2;
    if (this.scrape_shield?.server_side_excludes) score += 2;
    if (this.scrape_shield?.hotlink_protection) score += 1;

    return Math.min(score, maxScore);
};

SecurityConfig.prototype.getSecurityLevel = function () {
    const score = this.getSecurityScore();

    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
};

SecurityConfig.prototype.getRecommendations = function () {
    const recommendations = [];
    const score = this.getSecurityScore();

    if (this.ssl_mode !== 'strict') {
        recommendations.push({
            type: 'ssl',
            priority: 'high',
            message: 'Enable Full (Strict) SSL mode for maximum security',
            action: 'Update SSL mode to "strict"'
        });
    }

    if (!this.always_use_https) {
        recommendations.push({
            type: 'https',
            priority: 'high',
            message: 'Enable "Always Use HTTPS" to force secure connections',
            action: 'Enable Always Use HTTPS'
        });
    }

    if (this.security_level === 'low' || this.security_level === 'essentially_off') {
        recommendations.push({
            type: 'security_level',
            priority: 'medium',
            message: 'Consider increasing security level for better protection',
            action: 'Set security level to Medium or High'
        });
    }

    if (!this.bot_fight_mode && score < 75) {
        recommendations.push({
            type: 'bot_protection',
            priority: 'medium',
            message: 'Enable Bot Fight Mode to protect against automated attacks',
            action: 'Enable Bot Fight Mode'
        });
    }

    if (!this.security_headers?.hsts?.enabled) {
        recommendations.push({
            type: 'headers',
            priority: 'medium',
            message: 'Enable HSTS to prevent downgrade attacks',
            action: 'Enable HSTS security header'
        });
    }

    if (this.min_tls_version !== '1.3' && this.min_tls_version !== '1.2') {
        recommendations.push({
            type: 'tls',
            priority: 'high',
            message: 'Upgrade minimum TLS version for better security',
            action: 'Set minimum TLS version to 1.2 or 1.3'
        });
    }

    return recommendations;
};

SecurityConfig.prototype.createBackup = async function () {
    const backup = { ...this.toJSON() };
    delete backup.id;
    delete backup.created_at;
    delete backup.updated_at;
    delete backup.backup_config;

    return this.update({
        backup_config: backup,
        config_version: this.config_version + 1
    });
};

SecurityConfig.prototype.restoreFromBackup = async function () {
    if (!this.backup_config || Object.keys(this.backup_config).length === 0) {
        throw new Error('No backup configuration available');
    }

    const backupData = { ...this.backup_config };
    delete backupData.id;
    delete backupData.zone_id;

    return this.update(backupData);
};

SecurityConfig.prototype.isDevelopmentModeExpired = function () {
    if (!this.development_mode || !this.development_mode_expires) {
        return false;
    }

    return new Date() > new Date(this.development_mode_expires);
};

SecurityConfig.prototype.exportConfig = function () {
    const config = this.toJSON();

    // Remove internal fields
    delete config.id;
    delete config.zone_id;
    delete config.created_at;
    delete config.updated_at;
    delete config.last_modified_by;
    delete config.last_cloudflare_sync;
    delete config.backup_config;

    return config;
};

// Class methods
SecurityConfig.findByZone = function (zoneId) {
    return this.findOne({
        where: { zone_id: zoneId }
    });
};

SecurityConfig.getTemplates = function () {
    return this.findAll({
        where: { is_template: true },
        attributes: ['id', 'template_name', 'notes', 'created_at']
    });
};

SecurityConfig.createFromTemplate = async function (zoneId, templateId, userId) {
    const template = await this.findByPk(templateId);
    if (!template || !template.is_template) {
        throw new Error('Template not found');
    }

    const config = template.toJSON();
    delete config.id;
    delete config.created_at;
    delete config.updated_at;
    config.zone_id = zoneId;
    config.last_modified_by = userId;
    config.is_template = false;
    config.template_name = null;

    return this.create(config);
};

module.exports = SecurityConfig;