const { Zone, SecurityConfig, AuditLog } = require('../models');
const cloudflareService = require('../services/cloudflareService');
const logger = require('../utils/logger');

class SecurityController {
    // Lấy tất cả cài đặt bảo mật cho một zone
    async getSecuritySettings(req, res) {
        try {
            const { zoneId } = req.params;

            // Kiểm tra zone thuộc về user
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

            // Lấy cài đặt bảo mật từ Cloudflare
            const securitySettings = await cloudflareService.getSecuritySettings(req.userId, zoneId);

            // Lấy cài đặt từ database local
            const localConfig = await SecurityConfig.findOne({
                where: { zoneId: zone.id }
            });

            res.json({
                success: true,
                data: {
                    zoneId,
                    zoneName: zone.name,
                    cloudflareSettings: securitySettings,
                    localSettings: localConfig
                }
            });

        } catch (error) {
            logger.error('Get security settings error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy cài đặt bảo mật',
                error: error.message
            });
        }
    }

    // Cập nhật Security Level
    async updateSecurityLevel(req, res) {
        try {
            const { zoneId } = req.params;
            const { level } = req.body;

            const validLevels = ['off', 'essentially_off', 'low', 'medium', 'high', 'under_attack'];
            if (!validLevels.includes(level)) {
                return res.status(400).json({
                    success: false,
                    message: 'Security level không hợp lệ',
                    validLevels
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

            // Cập nhật trên Cloudflare
            const result = await cloudflareService.updateSecurityLevel(req.userId, zoneId, level);

            // Lưu vào database local
            await SecurityConfig.upsert({
                zoneId: zone.id,
                securityLevel: level,
                updatedAt: new Date()
            });

            // Ghi audit log
            await AuditLog.create({
                userId: req.userId,
                zoneId: zone.id,
                action: 'UPDATE_SECURITY_LEVEL',
                details: JSON.stringify({ oldLevel: result.oldValue, newLevel: level }),
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Security level updated: ${zone.name} - ${level}`, {
                userId: req.userId,
                zoneId,
                level
            });

            res.json({
                success: true,
                message: 'Cập nhật Security Level thành công',
                data: { level, result }
            });

        } catch (error) {
            logger.error('Update security level error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi cập nhật Security Level',
                error: error.message
            });
        }
    }

    // Cập nhật SSL/TLS settings
    async updateSslSettings(req, res) {
        try {
            const { zoneId } = req.params;
            const { sslMode, httpsRewrite, hsts } = req.body;

            const validSslModes = ['off', 'flexible', 'full', 'strict'];
            if (sslMode && !validSslModes.includes(sslMode)) {
                return res.status(400).json({
                    success: false,
                    message: 'SSL mode không hợp lệ',
                    validModes: validSslModes
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

            const updates = {};

            // Cập nhật SSL Mode
            if (sslMode) {
                await cloudflareService.updateZoneSetting(req.userId, zoneId, 'ssl', sslMode);
                updates.sslMode = sslMode;
            }

            // Cập nhật HTTPS Rewrite
            if (httpsRewrite !== undefined) {
                await cloudflareService.updateZoneSetting(req.userId, zoneId, 'automatic_https_rewrites', httpsRewrite ? 'on' : 'off');
                updates.httpsRewrite = httpsRewrite;
            }

            // Cập nhật HSTS
            if (hsts !== undefined) {
                await cloudflareService.updateZoneSetting(req.userId, zoneId, 'security_header', {
                    strict_transport_security: {
                        enabled: hsts,
                        max_age: hsts ? 31536000 : 0, // 1 year if enabled
                        include_subdomains: hsts,
                        nosniff: true
                    }
                });
                updates.hsts = hsts;
            }

            // Cập nhật database local
            const securityConfig = await SecurityConfig.findOne({
                where: { zoneId: zone.id }
            });

            if (securityConfig) {
                await securityConfig.update({
                    sslMode: sslMode || securityConfig.sslMode,
                    httpsRewrite: httpsRewrite !== undefined ? httpsRewrite : securityConfig.httpsRewrite,
                    hsts: hsts !== undefined ? hsts : securityConfig.hsts,
                    updatedAt: new Date()
                });
            } else {
                await SecurityConfig.create({
                    zoneId: zone.id,
                    sslMode: sslMode || 'flexible',
                    httpsRewrite: httpsRewrite || false,
                    hsts: hsts || false
                });
            }

            // Ghi audit log
            await AuditLog.create({
                userId: req.userId,
                zoneId: zone.id,
                action: 'UPDATE_SSL_SETTINGS',
                details: JSON.stringify(updates),
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`SSL settings updated: ${zone.name}`, {
                userId: req.userId,
                zoneId,
                updates
            });

            res.json({
                success: true,
                message: 'Cập nhật SSL settings thành công',
                data: updates
            });

        } catch (error) {
            logger.error('Update SSL settings error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi cập nhật SSL settings',
                error: error.message
            });
        }
    }

    // Cập nhật Bot Fight Mode
    async updateBotProtection(req, res) {
        try {
            const { zoneId } = req.params;
            const { botFightMode, superBotFightMode, challengePassage } = req.body;

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

            const updates = {};

            // Cập nhật Bot Fight Mode
            if (botFightMode !== undefined) {
                await cloudflareService.updateZoneSetting(req.userId, zoneId, 'bic', botFightMode ? 'on' : 'off');
                updates.botFightMode = botFightMode;
            }

            // Cập nhật Super Bot Fight Mode (Pro plan trở lên)
            if (superBotFightMode !== undefined) {
                await cloudflareService.updateZoneSetting(req.userId, zoneId, 'bot_management', {
                    enable_js: superBotFightMode,
                    fight_mode: superBotFightMode
                });
                updates.superBotFightMode = superBotFightMode;
            }

            // Cập nhật Challenge Passage
            if (challengePassage !== undefined) {
                await cloudflareService.updateZoneSetting(req.userId, zoneId, 'challenge_ttl', challengePassage);
                updates.challengePassage = challengePassage;
            }

            // Cập nhật database local
            await SecurityConfig.upsert({
                zoneId: zone.id,
                botFightMode: botFightMode,
                superBotFightMode: superBotFightMode,
                challengePassage: challengePassage,
                updatedAt: new Date()
            });

            // Ghi audit log
            await AuditLog.create({
                userId: req.userId,
                zoneId: zone.id,
                action: 'UPDATE_BOT_PROTECTION',
                details: JSON.stringify(updates),
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Bot protection updated: ${zone.name}`, {
                userId: req.userId,
                zoneId,
                updates
            });

            res.json({
                success: true,
                message: 'Cập nhật Bot Protection thành công',
                data: updates
            });

        } catch (error) {
            logger.error('Update bot protection error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi cập nhật Bot Protection',
                error: error.message
            });
        }
    }

    // Quản lý Firewall Rules
    async getFirewallRules(req, res) {
        try {
            const { zoneId } = req.params;

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

            const firewallRules = await cloudflareService.getFirewallRules(req.userId, zoneId);

            res.json({
                success: true,
                data: {
                    zoneId,
                    zoneName: zone.name,
                    firewallRules
                }
            });

        } catch (error) {
            logger.error('Get firewall rules error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy Firewall Rules',
                error: error.message
            });
        }
    }

    // Tạo Firewall Rule mới
    async createFirewallRule(req, res) {
        try {
            const { zoneId } = req.params;
            const { expression, action, description, priority } = req.body;

            if (!expression || !action) {
                return res.status(400).json({
                    success: false,
                    message: 'Expression và action là bắt buộc'
                });
            }

            const validActions = ['block', 'challenge', 'allow', 'js_challenge', 'bypass'];
            if (!validActions.includes(action)) {
                return res.status(400).json({
                    success: false,
                    message: 'Action không hợp lệ',
                    validActions
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

            const ruleData = {
                expression,
                action,
                description: description || `Rule created at ${new Date().toISOString()}`,
                priority: priority || 1
            };

            const result = await cloudflareService.createFirewallRule(req.userId, zoneId, ruleData);

            // Ghi audit log
            await AuditLog.create({
                userId: req.userId,
                zoneId: zone.id,
                action: 'CREATE_FIREWALL_RULE',
                details: JSON.stringify(ruleData),
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Firewall rule created: ${zone.name}`, {
                userId: req.userId,
                zoneId,
                ruleId: result.id,
                action: ruleData.action
            });

            res.status(201).json({
                success: true,
                message: 'Tạo Firewall Rule thành công',
                data: { rule: result }
            });

        } catch (error) {
            logger.error('Create firewall rule error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi tạo Firewall Rule',
                error: error.message
            });
        }
    }

    // Cập nhật Firewall Rule
    async updateFirewallRule(req, res) {
        try {
            const { zoneId, ruleId } = req.params;
            const { expression, action, description, priority, paused } = req.body;

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

            const updateData = {};
            if (expression) updateData.expression = expression;
            if (action) updateData.action = action;
            if (description) updateData.description = description;
            if (priority) updateData.priority = priority;
            if (paused !== undefined) updateData.paused = paused;

            const result = await cloudflareService.updateFirewallRule(req.userId, zoneId, ruleId, updateData);

            // Ghi audit log
            await AuditLog.create({
                userId: req.userId,
                zoneId: zone.id,
                action: 'UPDATE_FIREWALL_RULE',
                details: JSON.stringify({ ruleId, ...updateData }),
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Firewall rule updated: ${zone.name}`, {
                userId: req.userId,
                zoneId,
                ruleId
            });

            res.json({
                success: true,
                message: 'Cập nhật Firewall Rule thành công',
                data: { rule: result }
            });

        } catch (error) {
            logger.error('Update firewall rule error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi cập nhật Firewall Rule',
                error: error.message
            });
        }
    }

    // Xóa Firewall Rule
    async deleteFirewallRule(req, res) {
        try {
            const { zoneId, ruleId } = req.params;

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

            await cloudflareService.deleteFirewallRule(req.userId, zoneId, ruleId);

            // Ghi audit log
            await AuditLog.create({
                userId: req.userId,
                zoneId: zone.id,
                action: 'DELETE_FIREWALL_RULE',
                details: JSON.stringify({ ruleId }),
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Firewall rule deleted: ${zone.name}`, {
                userId: req.userId,
                zoneId,
                ruleId
            });

            res.json({
                success: true,
                message: 'Xóa Firewall Rule thành công'
            });

        } catch (error) {
            logger.error('Delete firewall rule error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi xóa Firewall Rule',
                error: error.message
            });
        }
    }

    // Bật/tắt I'm Under Attack Mode
    async toggleUnderAttackMode(req, res) {
        try {
            const { zoneId } = req.params;
            const { enabled } = req.body;

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

            const securityLevel = enabled ? 'under_attack' : 'medium';
            await cloudflareService.updateSecurityLevel(req.userId, zoneId, securityLevel);

            // Cập nhật database
            await SecurityConfig.upsert({
                zoneId: zone.id,
                securityLevel: securityLevel,
                underAttackMode: enabled,
                updatedAt: new Date()
            });

            // Ghi audit log
            await AuditLog.create({
                userId: req.userId,
                zoneId: zone.id,
                action: 'TOGGLE_UNDER_ATTACK_MODE',
                details: JSON.stringify({ enabled, securityLevel }),
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Under Attack Mode ${enabled ? 'enabled' : 'disabled'}: ${zone.name}`, {
                userId: req.userId,
                zoneId,
                enabled
            });

            res.json({
                success: true,
                message: `${enabled ? 'Bật' : 'Tắt'} Under Attack Mode thành công`,
                data: { enabled, securityLevel }
            });

        } catch (error) {
            logger.error('Toggle under attack mode error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi thay đổi Under Attack Mode',
                error: error.message
            });
        }
    }

    // Lấy security analytics
    async getSecurityAnalytics(req, res) {
        try {
            const { zoneId } = req.params;
            const { since, until } = req.query;

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

            const analytics = await cloudflareService.getSecurityAnalytics(req.userId, zoneId, {
                since: since || '-1440', // 24h ago default
                until: until || '0'       // now default
            });

            res.json({
                success: true,
                data: {
                    zoneId,
                    zoneName: zone.name,
                    analytics
                }
            });

        } catch (error) {
            logger.error('Get security analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy security analytics',
                error: error.message
            });
        }
    }
}

module.exports = new SecurityController();