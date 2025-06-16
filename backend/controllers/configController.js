const { Zone, SecurityConfig, AuditLog } = require('../models');
const cloudflareService = require('../services/cloudflareService');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class ConfigController {
    // Export cấu hình của một zone
    async exportZoneConfig(req, res) {
        try {
            const { zoneId } = req.params;
            const { includeSecrets = false } = req.query;

            const zone = await Zone.findOne({
                where: {
                    cloudflareId: zoneId,
                    userId: req.userId
                }
            });

            if (!zone) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy zone hoặc bạn không có quyền truy cập'
                });
            }

            // Lấy zone settings từ Cloudflare
            const zoneSettings = await cloudflareService.getZoneSettings(req.userId, zoneId);

            // Lấy security settings
            const securitySettings = await cloudflareService.getSecuritySettings(req.userId, zoneId);

            // Lấy firewall rules
            const firewallRules = await cloudflareService.getFirewallRules(req.userId, zoneId);

            // Lấy DNS records
            const dnsRecords = await cloudflareService.getDnsRecords(req.userId, zoneId);

            // Lấy local security config
            const localSecurityConfig = await SecurityConfig.findOne({
                where: { zoneId: zone.id }
            });

            const configData = {
                metadata: {
                    exportedAt: new Date().toISOString(),
                    exportedBy: req.userId,
                    version: '1.0',
                    includeSecrets: includeSecrets === 'true'
                },
                zone: {
                    id: zoneId,
                    name: zone.name,
                    status: zone.status,
                    type: zone.type
                },
                settings: {
                    zone: zoneSettings,
                    security: securitySettings,
                    localSecurity: localSecurityConfig
                },
                firewall: {
                    rules: firewallRules
                },
                dns: {
                    records: includeSecrets === 'true' ? dnsRecords : dnsRecords?.map(record => ({
                        ...record,
                        content: record.type === 'TXT' ? '[HIDDEN]' : record.content
                    }))
                }
            };

            // Ghi audit log
            await AuditLog.create({
                userId: req.userId,
                zoneId: zone.id,
                action: 'EXPORT_CONFIG',
                details: JSON.stringify({ includeSecrets: includeSecrets === 'true' }),
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Config exported for zone: ${zone.name}`, {
                userId: req.userId,
                zoneId,
                includeSecrets: includeSecrets === 'true'
            });

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${zone.name}-config-${Date.now()}.json"`);
            res.json(configData);

        } catch (error) {
            logger.error('Export zone config error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi export cấu hình',
                error: error.message
            });
        }
    }

    // Export cấu hình tất cả zones
    async exportAllZonesConfig(req, res) {
        try {
            const { includeSecrets = false } = req.query;

            const zones = await Zone.findAll({
                where: { userId: req.userId },
                attributes: ['id', 'cloudflareId', 'name', 'status', 'type']
            });

            if (zones.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy zones nào'
                });
            }

            const allConfigs = {
                metadata: {
                    exportedAt: new Date().toISOString(),
                    exportedBy: req.userId,
                    version: '1.0',
                    totalZones: zones.length,
                    includeSecrets: includeSecrets === 'true'
                },
                zones: []
            };

            // Export từng zone
            for (const zone of zones) {
                try {
                    const zoneSettings = await cloudflareService.getZoneSettings(req.userId, zone.cloudflareId);
                    const securitySettings = await cloudflareService.getSecuritySettings(req.userId, zone.cloudflareId);
                    const firewallRules = await cloudflareService.getFirewallRules(req.userId, zone.cloudflareId);
                    const localSecurityConfig = await SecurityConfig.findOne({
                        where: { zoneId: zone.id }
                    });

                    allConfigs.zones.push({
                        zone: {
                            id: zone.cloudflareId,
                            name: zone.name,
                            status: zone.status,
                            type: zone.type
                        },
                        settings: {
                            zone: zoneSettings,
                            security: securitySettings,
                            localSecurity: localSecurityConfig
                        },
                        firewall: {
                            rules: firewallRules
                        }
                    });

                } catch (error) {
                    logger.warn(`Failed to export config for zone ${zone.name}:`, error.message);
                    allConfigs.zones.push({
                        zone: {
                            id: zone.cloudflareId,
                            name: zone.name,
                            status: zone.status,
                            type: zone.type
                        },
                        error: error.message
                    });
                }
            }

            // Ghi audit log
            await AuditLog.create({
                userId: req.userId,
                action: 'EXPORT_ALL_CONFIGS',
                details: JSON.stringify({
                    totalZones: zones.length,
                    includeSecrets: includeSecrets === 'true'
                }),
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`All configs exported for user`, {
                userId: req.userId,
                totalZones: zones.length,
                includeSecrets: includeSecrets === 'true'
            });

            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="all-zones-config-${Date.now()}.json"`);
            res.json(allConfigs);

        } catch (error) {
            logger.error('Export all zones config error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi export tất cả cấu hình',
                error: error.message
            });
        }
    }

    // Import cấu hình cho một zone
    async importZoneConfig(req, res) {
        try {
            const { zoneId } = req.params;
            const { config, dryRun = false } = req.body;

            if (!config) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu dữ liệu config để import'
                });
            }

            const zone = await Zone.findOne({
                where: {
                    cloudflareId: zoneId,
                    userId: req.userId
                }
            });

            if (!zone) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy zone hoặc bạn không có quyền truy cập'
                });
            }

            const results = {
                zoneId,
                zoneName: zone.name,
                dryRun: dryRun === true,
                changes: [],
                errors: []
            };

            // Import zone settings
            if (config.settings?.zone) {
                for (const [setting, value] of Object.entries(config.settings.zone)) {
                    try {
                        if (!dryRun) {
                            await cloudflareService.updateZoneSetting(req.userId, zoneId, setting, value);
                        }
                        results.changes.push({
                            type: 'zone_setting',
                            setting,
                            value,
                            status: 'success'
                        });
                    } catch (error) {
                        results.errors.push({
                            type: 'zone_setting',
                            setting,
                            error: error.message
                        });
                    }
                }
            }

            // Import security settings
            if (config.settings?.security) {
                const securitySettings = config.settings.security;

                // Security Level
                if (securitySettings.security_level) {
                    try {
                        if (!dryRun) {
                            await cloudflareService.updateSecurityLevel(req.userId, zoneId, securitySettings.security_level);
                        }
                        results.changes.push({
                            type: 'security_level',
                            value: securitySettings.security_level,
                            status: 'success'
                        });
                    } catch (error) {
                        results.errors.push({
                            type: 'security_level',
                            error: error.message
                        });
                    }
                }

                // SSL Mode
                if (securitySettings.ssl) {
                    try {
                        if (!dryRun) {
                            await cloudflareService.updateZoneSetting(req.userId, zoneId, 'ssl', securitySettings.ssl);
                        }
                        results.changes.push({
                            type: 'ssl_mode',
                            value: securitySettings.ssl,
                            status: 'success'
                        });
                    } catch (error) {
                        results.errors.push({
                            type: 'ssl_mode',
                            error: error.message
                        });
                    }
                }
            }

            // Import firewall rules
            if (config.firewall?.rules && Array.isArray(config.firewall.rules)) {
                for (const rule of config.firewall.rules) {
                    try {
                        if (!dryRun) {
                            await cloudflareService.createFirewallRule(req.userId, zoneId, {
                                expression: rule.expression,
                                action: rule.action,
                                description: rule.description || 'Imported rule',
                                priority: rule.priority || 1
                            });
                        }
                        results.changes.push({
                            type: 'firewall_rule',
                            rule: rule.description || 'Unnamed rule',
                            action: rule.action,
                            status: 'success'
                        });
                    } catch (error) {
                        results.errors.push({
                            type: 'firewall_rule',
                            rule: rule.description || 'Unnamed rule',
                            error: error.message
                        });
                    }
                }
            }

            // Import local security config
            if (config.settings?.localSecurity && !dryRun) {
                await SecurityConfig.upsert({
                    zoneId: zone.id,
                    ...config.settings.localSecurity,
                    updatedAt: new Date()
                });
                results.changes.push({
                    type: 'local_security_config',
                    status: 'success'
                });
            }

            // Ghi audit log
            if (!dryRun) {
                await AuditLog.create({
                    userId: req.userId,
                    zoneId: zone.id,
                    action: 'IMPORT_CONFIG',
                    details: JSON.stringify({
                        totalChanges: results.changes.length,
                        totalErrors: results.errors.length
                    }),
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                });

                logger.info(`Config imported for zone: ${zone.name}`, {
                    userId: req.userId,
                    zoneId,
                    changes: results.changes.length,
                    errors: results.errors.length
                });
            }

            res.json({
                success: true,
                message: dryRun ? 'Dry run completed' : 'Import cấu hình thành công',
                data: results
            });

        } catch (error) {
            logger.error('Import zone config error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi import cấu hình',
                error: error.message
            });
        }
    }

    // Clone cấu hình từ zone này sang zone khác
    async cloneZoneConfig(req, res) {
        try {
            const { sourceZoneId } = req.params;
            const { targetZoneId, settings } = req.body;

            if (!targetZoneId) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu target zone ID'
                });
            }

            // Kiểm tra cả 2 zones thuộc về user
            const sourceZone = await Zone.findOne({
                where: {
                    cloudflareId: sourceZoneId,
                    userId: req.userId
                }
            });

            const targetZone = await Zone.findOne({
                where: {
                    cloudflareId: targetZoneId,
                    userId: req.userId
                }
            });

            if (!sourceZone || !targetZone) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy source hoặc target zone'
                });
            }

            const results = {
                sourceZone: sourceZone.name,
                targetZone: targetZone.name,
                changes: [],
                errors: []
            };

            // Lấy cấu hình từ source zone
            const sourceConfig = {};

            if (!settings || settings.includes('zone')) {
                sourceConfig.zoneSettings = await cloudflareService.getZoneSettings(req.userId, sourceZoneId);
            }

            if (!settings || settings.includes('security')) {
                sourceConfig.securitySettings = await cloudflareService.getSecuritySettings(req.userId, sourceZoneId);
            }

            if (!settings || settings.includes('firewall')) {
                sourceConfig.firewallRules = await cloudflareService.getFirewallRules(req.userId, sourceZoneId);
            }

            // Apply cấu hình lên target zone

            // Clone zone settings
            if (sourceConfig.zoneSettings) {
                const settingsToSkip = ['development_mode', 'minify']; // Các settings không nên clone

                for (const [setting, value] of Object.entries(sourceConfig.zoneSettings)) {
                    if (settingsToSkip.includes(setting)) continue;

                    try {
                        await cloudflareService.updateZoneSetting(req.userId, targetZoneId, setting, value);
                        results.changes.push({
                            type: 'zone_setting',
                            setting,
                            value,
                            status: 'success'
                        });
                    } catch (error) {
                        results.errors.push({
                            type: 'zone_setting',
                            setting,
                            error: error.message
                        });
                    }
                }
            }

            // Clone security settings
            if (sourceConfig.securitySettings) {
                if (sourceConfig.securitySettings.security_level) {
                    try {
                        await cloudflareService.updateSecurityLevel(req.userId, targetZoneId, sourceConfig.securitySettings.security_level);
                        results.changes.push({
                            type: 'security_level',
                            value: sourceConfig.securitySettings.security_level,
                            status: 'success'
                        });
                    } catch (error) {
                        results.errors.push({
                            type: 'security_level',
                            error: error.message
                        });
                    }
                }
            }

            // Clone firewall rules
            if (sourceConfig.firewallRules && Array.isArray(sourceConfig.firewallRules)) {
                for (const rule of sourceConfig.firewallRules) {
                    try {
                        await cloudflareService.createFirewallRule(req.userId, targetZoneId, {
                            expression: rule.expression,
                            action: rule.action,
                            description: `${rule.description} (cloned from ${sourceZone.name})`,
                            priority: rule.priority || 1
                        });
                        results.changes.push({
                            type: 'firewall_rule',
                            rule: rule.description,
                            action: rule.action,
                            status: 'success'
                        });
                    } catch (error) {
                        results.errors.push({
                            type: 'firewall_rule',
                            rule: rule.description,
                            error: error.message
                        });
                    }
                }
            }

            // Clone local security config
            const sourceLocalConfig = await SecurityConfig.findOne({
                where: { zoneId: sourceZone.id }
            });

            if (sourceLocalConfig) {
                const { id, zoneId, createdAt, ...configData } = sourceLocalConfig.toJSON();
                await SecurityConfig.upsert({
                    zoneId: targetZone.id,
                    ...configData,
                    updatedAt: new Date()
                });
                results.changes.push({
                    type: 'local_security_config',
                    status: 'success'
                });
            }

            // Ghi audit log
            await AuditLog.create({
                userId: req.userId,
                zoneId: targetZone.id,
                action: 'CLONE_CONFIG',
                details: JSON.stringify({
                    sourceZoneId,
                    sourceZoneName: sourceZone.name,
                    totalChanges: results.changes.length,
                    totalErrors: results.errors.length
                }),
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Config cloned from ${sourceZone.name} to ${targetZone.name}`, {
                userId: req.userId,
                sourceZoneId,
                targetZoneId,
                changes: results.changes.length,
                errors: results.errors.length
            });

            res.json({
                success: true,
                message: 'Clone cấu hình thành công',
                data: results
            });

        } catch (error) {
            logger.error('Clone zone config error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi clone cấu hình',
                error: error.message
            });
        }
    }

    // Lấy danh sách backup configs
    async getBackupConfigs(req, res) {
        try {
            const { zoneId } = req.params;
            const { limit = 10 } = req.query;

            const zone = await Zone.findOne({
                where: {
                    cloudflareId: zoneId,
                    userId: req.userId
                }
            });

            if (!zone) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy zone hoặc bạn không có quyền truy cập'
                });
            }

            // Lấy từ audit logs các lần export/backup
            const backupLogs = await AuditLog.findAll({
                where: {
                    userId: req.userId,
                    zoneId: zone.id,
                    action: ['EXPORT_CONFIG', 'BACKUP_CONFIG']
                },
                order: [['createdAt', 'DESC']],
                limit: parseInt(limit)
            });

            res.json({
                success: true,
                data: {
                    zoneId,
                    zoneName: zone.name,
                    backups: backupLogs.map(log => ({
                        id: log.id,
                        action: log.action,
                        createdAt: log.createdAt,
                        details: JSON.parse(log.details || '{}'),
                        ipAddress: log.ipAddress
                    }))
                }
            });

        } catch (error) {
            logger.error('Get backup configs error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy danh sách backup',
                error: error.message
            });
        }
    }

    // Validate cấu hình trước khi import
    async validateConfig(req, res) {
        try {
            const { config } = req.body;

            if (!config) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu dữ liệu config để validate'
                });
            }

            const validation = {
                valid: true,
                errors: [],
                warnings: [],
                summary: {
                    zoneSettings: 0,
                    securitySettings: 0,
                    firewallRules: 0,
                    dnsRecords: 0
                }
            };

            // Validate metadata
            if (!config.metadata || !config.metadata.version) {
                validation.errors.push('Config thiếu metadata hoặc version');
                validation.valid = false;
            }

            // Validate zone info
            if (!config.zone || !config.zone.name) {
                validation.errors.push('Config thiếu thông tin zone');
                validation.valid = false;
            }

            // Validate zone settings
            if (config.settings?.zone) {
                const validZoneSettings = [
                    'ssl', 'security_level', 'cache_level', 'browser_cache_ttl',
                    'always_use_https', 'automatic_https_rewrites', 'minify',
                    'development_mode', 'challenge_ttl'
                ];

                for (const [setting, value] of Object.entries(config.settings.zone)) {
                    validation.summary.zoneSettings++;

                    if (!validZoneSettings.includes(setting)) {
                        validation.warnings.push(`Zone setting '${setting}' không được hỗ trợ`);
                    }

                    // Validate specific settings
                    if (setting === 'ssl') {
                        const validSslModes = ['off', 'flexible', 'full', 'strict'];
                        if (!validSslModes.includes(value)) {
                            validation.errors.push(`SSL mode '${value}' không hợp lệ`);
                            validation.valid = false;
                        }
                    }

                    if (setting === 'security_level') {
                        const validLevels = ['off', 'essentially_off', 'low', 'medium', 'high', 'under_attack'];
                        if (!validLevels.includes(value)) {
                            validation.errors.push(`Security level '${value}' không hợp lệ`);
                            validation.valid = false;
                        }
                    }
                }
            }

            // Validate security settings
            if (config.settings?.security) {
                validation.summary.securitySettings++;

                const securitySettings = config.settings.security;

                if (securitySettings.security_level) {
                    const validLevels = ['off', 'essentially_off', 'low', 'medium', 'high', 'under_attack'];
                    if (!validLevels.includes(securitySettings.security_level)) {
                        validation.errors.push(`Security level '${securitySettings.security_level}' không hợp lệ`);
                        validation.valid = false;
                    }
                }
            }

            // Validate firewall rules
            if (config.firewall?.rules) {
                if (!Array.isArray(config.firewall.rules)) {
                    validation.errors.push('Firewall rules phải là một array');
                    validation.valid = false;
                } else {
                    config.firewall.rules.forEach((rule, index) => {
                        validation.summary.firewallRules++;

                        if (!rule.expression || !rule.action) {
                            validation.errors.push(`Firewall rule ${index + 1} thiếu expression hoặc action`);
                            validation.valid = false;
                        }

                        const validActions = ['block', 'challenge', 'allow', 'js_challenge', 'bypass'];
                        if (rule.action && !validActions.includes(rule.action)) {
                            validation.errors.push(`Firewall rule ${index + 1} có action '${rule.action}' không hợp lệ`);
                            validation.valid = false;
                        }

                        // Validate expression syntax (basic check)
                        if (rule.expression && typeof rule.expression !== 'string') {
                            validation.errors.push(`Firewall rule ${index + 1} có expression không hợp lệ`);
                            validation.valid = false;
                        }
                    });
                }
            }

            // Validate DNS records
            if (config.dns?.records) {
                if (!Array.isArray(config.dns.records)) {
                    validation.errors.push('DNS records phải là một array');
                    validation.valid = false;
                } else {
                    config.dns.records.forEach((record, index) => {
                        validation.summary.dnsRecords++;

                        if (!record.type || !record.name) {
                            validation.errors.push(`DNS record ${index + 1} thiếu type hoặc name`);
                            validation.valid = false;
                        }

                        const validTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS'];
                        if (record.type && !validTypes.includes(record.type)) {
                            validation.warnings.push(`DNS record ${index + 1} có type '${record.type}' có thể không được hỗ trợ`);
                        }
                    });
                }
            }

            // Check config version compatibility
            if (config.metadata?.version && config.metadata.version !== '1.0') {
                validation.warnings.push(`Config version '${config.metadata.version}' có thể không tương thích`);
            }

            res.json({
                success: true,
                data: validation
            });

        } catch (error) {
            logger.error('Validate config error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi validate config',
                error: error.message
            });
        }
    }

    // Backup tự động cấu hình
    async createBackup(req, res) {
        try {
            const { zoneId } = req.params;
            const { description } = req.body;

            const zone = await Zone.findOne({
                where: {
                    cloudflareId: zoneId,
                    userId: req.userId
                }
            });

            if (!zone) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy zone hoặc bạn không có quyền truy cập'
                });
            }

            // Tạo backup folder nếu chưa có
            const backupDir = path.join(process.cwd(), 'backups', req.userId.toString());
            try {
                await fs.mkdir(backupDir, { recursive: true });
            } catch (error) {
                // Folder đã tồn tại
            }

            // Lấy cấu hình hiện tại
            const zoneSettings = await cloudflareService.getZoneSettings(req.userId, zoneId);
            const securitySettings = await cloudflareService.getSecuritySettings(req.userId, zoneId);
            const firewallRules = await cloudflareService.getFirewallRules(req.userId, zoneId);
            const localSecurityConfig = await SecurityConfig.findOne({
                where: { zoneId: zone.id }
            });

            const backupData = {
                metadata: {
                    backupAt: new Date().toISOString(),
                    backupBy: req.userId,
                    version: '1.0',
                    description: description || `Automatic backup at ${new Date().toISOString()}`
                },
                zone: {
                    id: zoneId,
                    name: zone.name,
                    status: zone.status,
                    type: zone.type
                },
                settings: {
                    zone: zoneSettings,
                    security: securitySettings,
                    localSecurity: localSecurityConfig
                },
                firewall: {
                    rules: firewallRules
                }
            };

            // Lưu backup file
            const timestamp = Date.now();
            const backupFileName = `${zone.name}-backup-${timestamp}.json`;
            const backupFilePath = path.join(backupDir, backupFileName);

            await fs.writeFile(backupFilePath, JSON.stringify(backupData, null, 2));

            // Ghi audit log
            await AuditLog.create({
                userId: req.userId,
                zoneId: zone.id,
                action: 'CREATE_BACKUP',
                details: JSON.stringify({
                    backupFileName,
                    description: description || 'Automatic backup'
                }),
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Backup created for zone: ${zone.name}`, {
                userId: req.userId,
                zoneId,
                backupFileName
            });

            res.json({
                success: true,
                message: 'Tạo backup thành công',
                data: {
                    backupFileName,
                    backupPath: backupFilePath,
                    backupAt: backupData.metadata.backupAt,
                    description: backupData.metadata.description
                }
            });

        } catch (error) {
            logger.error('Create backup error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi tạo backup',
                error: error.message
            });
        }
    }

    // Restore từ backup
    async restoreFromBackup(req, res) {
        try {
            const { zoneId } = req.params;
            const { backupFileName, dryRun = false } = req.body;

            if (!backupFileName) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu tên file backup'
                });
            }

            const zone = await Zone.findOne({
                where: {
                    cloudflareId: zoneId,
                    userId: req.userId
                }
            });

            if (!zone) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy zone hoặc bạn không có quyền truy cập'
                });
            }

            // Đọc backup file
            const backupDir = path.join(process.cwd(), 'backups', req.userId.toString());
            const backupFilePath = path.join(backupDir, backupFileName);

            let backupData;
            try {
                const backupContent = await fs.readFile(backupFilePath, 'utf8');
                backupData = JSON.parse(backupContent);
            } catch (error) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy file backup hoặc file bị lỗi'
                });
            }

            // Validate backup data
            if (!backupData.zone || !backupData.settings) {
                return res.status(400).json({
                    success: false,
                    message: 'File backup không hợp lệ'
                });
            }

            // Restore config (reuse import logic)
            const results = {
                zoneId,
                zoneName: zone.name,
                dryRun: dryRun === true,
                restoredFrom: backupFileName,
                restoredAt: new Date().toISOString(),
                changes: [],
                errors: []
            };

            // Restore zone settings
            if (backupData.settings.zone) {
                for (const [setting, value] of Object.entries(backupData.settings.zone)) {
                    try {
                        if (!dryRun) {
                            await cloudflareService.updateZoneSetting(req.userId, zoneId, setting, value);
                        }
                        results.changes.push({
                            type: 'zone_setting',
                            setting,
                            value,
                            status: 'restored'
                        });
                    } catch (error) {
                        results.errors.push({
                            type: 'zone_setting',
                            setting,
                            error: error.message
                        });
                    }
                }
            }

            // Restore firewall rules
            if (backupData.firewall?.rules && Array.isArray(backupData.firewall.rules)) {
                for (const rule of backupData.firewall.rules) {
                    try {
                        if (!dryRun) {
                            await cloudflareService.createFirewallRule(req.userId, zoneId, {
                                expression: rule.expression,
                                action: rule.action,
                                description: `${rule.description} (restored from backup)`,
                                priority: rule.priority || 1
                            });
                        }
                        results.changes.push({
                            type: 'firewall_rule',
                            rule: rule.description || 'Unnamed rule',
                            action: rule.action,
                            status: 'restored'
                        });
                    } catch (error) {
                        results.errors.push({
                            type: 'firewall_rule',
                            rule: rule.description || 'Unnamed rule',
                            error: error.message
                        });
                    }
                }
            }

            // Restore local security config
            if (backupData.settings.localSecurity && !dryRun) {
                await SecurityConfig.upsert({
                    zoneId: zone.id,
                    ...backupData.settings.localSecurity,
                    updatedAt: new Date()
                });
                results.changes.push({
                    type: 'local_security_config',
                    status: 'restored'
                });
            }

            // Ghi audit log
            if (!dryRun) {
                await AuditLog.create({
                    userId: req.userId,
                    zoneId: zone.id,
                    action: 'RESTORE_BACKUP',
                    details: JSON.stringify({
                        backupFileName,
                        totalChanges: results.changes.length,
                        totalErrors: results.errors.length
                    }),
                    ipAddress: req.ip,
                    userAgent: req.get('User-Agent')
                });

                logger.info(`Config restored for zone: ${zone.name}`, {
                    userId: req.userId,
                    zoneId,
                    backupFileName,
                    changes: results.changes.length,
                    errors: results.errors.length
                });
            }

            res.json({
                success: true,
                message: dryRun ? 'Dry run completed' : 'Restore backup thành công',
                data: results
            });

        } catch (error) {
            logger.error('Restore backup error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi restore backup',
                error: error.message
            });
        }
    }
}

module.exports = new ConfigController();