const { Zone, User } = require('../models');
const cloudflareService = require('../services/cloudflareService');
const logger = require('../utils/logger');

class ZoneController {
    // Lấy danh sách tất cả zones từ Cloudflare
    async getAllZones(req, res) {
        try {
            const user = await User.findByPk(req.userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy người dùng'
                });
            }

            // Lấy zones từ Cloudflare API
            const cloudflareZones = await cloudflareService.getZones(user.id);

            // Đồng bộ với database local
            for (const zone of cloudflareZones) {
                await Zone.upsert({
                    cloudflareId: zone.id,
                    name: zone.name,
                    status: zone.status,
                    type: zone.type,
                    nameServers: JSON.stringify(zone.name_servers || []),
                    userId: user.id,
                    isActive: zone.status === 'active'
                });
            }

            // Lấy zones từ database với thông tin bổ sung
            const zones = await Zone.findAll({
                where: { userId: user.id },
                order: [['name', 'ASC']]
            });

            res.json({
                success: true,
                data: {
                    zones: zones.map(zone => ({
                        ...zone.toJSON(),
                        nameServers: JSON.parse(zone.nameServers || '[]')
                    }))
                }
            });

        } catch (error) {
            logger.error('Get all zones error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy danh sách zones',
                error: error.message
            });
        }
    }

    // Lấy thông tin chi tiết một zone
    async getZoneById(req, res) {
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
                    message: 'Không tìm thấy zone'
                });
            }

            // Lấy thông tin chi tiết từ Cloudflare
            const cloudflareZoneDetails = await cloudflareService.getZoneDetails(req.userId, zoneId);

            // Cập nhật thông tin zone trong database
            await zone.update({
                status: cloudflareZoneDetails.status,
                nameServers: JSON.stringify(cloudflareZoneDetails.name_servers || []),
                isActive: cloudflareZoneDetails.status === 'active'
            });

            res.json({
                success: true,
                data: {
                    zone: {
                        ...zone.toJSON(),
                        nameServers: JSON.parse(zone.nameServers || '[]'),
                        cloudflareDetails: cloudflareZoneDetails
                    }
                }
            });

        } catch (error) {
            logger.error('Get zone by ID error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy thông tin zone',
                error: error.message
            });
        }
    }

    // Lấy DNS records của một zone
    async getZoneDnsRecords(req, res) {
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

            const dnsRecords = await cloudflareService.getDnsRecords(req.userId, zoneId);

            res.json({
                success: true,
                data: {
                    zoneId,
                    zoneName: zone.name,
                    dnsRecords
                }
            });

        } catch (error) {
            logger.error('Get DNS records error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy DNS records',
                error: error.message
            });
        }
    }

    // Lấy zone settings
    async getZoneSettings(req, res) {
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

            const settings = await cloudflareService.getZoneSettings(req.userId, zoneId);

            res.json({
                success: true,
                data: {
                    zoneId,
                    zoneName: zone.name,
                    settings
                }
            });

        } catch (error) {
            logger.error('Get zone settings error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy zone settings',
                error: error.message
            });
        }
    }

    // Cập nhật zone setting
    async updateZoneSetting(req, res) {
        try {
            const { zoneId } = req.params;
            const { setting, value } = req.body;

            if (!setting || value === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Thiếu thông tin setting hoặc value'
                });
            }

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

            const result = await cloudflareService.updateZoneSetting(req.userId, zoneId, setting, value);

            logger.info(`Zone setting updated: ${zone.name} - ${setting} = ${value}`, {
                userId: req.userId,
                zoneId,
                setting,
                value
            });

            res.json({
                success: true,
                message: `Cập nhật ${setting} thành công`,
                data: { result }
            });

        } catch (error) {
            logger.error('Update zone setting error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi cập nhật zone setting',
                error: error.message
            });
        }
    }

    // Purge cache cho zone
    async purgeCache(req, res) {
        try {
            const { zoneId } = req.params;
            const { files, tags, hosts } = req.body;

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

            const result = await cloudflareService.purgeCache(req.userId, zoneId, {
                files,
                tags,
                hosts
            });

            logger.info(`Cache purged for zone: ${zone.name}`, {
                userId: req.userId,
                zoneId,
                files: files?.length || 0,
                tags: tags?.length || 0,
                hosts: hosts?.length || 0
            });

            res.json({
                success: true,
                message: 'Purge cache thành công',
                data: { result }
            });

        } catch (error) {
            logger.error('Purge cache error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi purge cache',
                error: error.message
            });
        }
    }

    // Lấy analytics cho zone
    async getZoneAnalytics(req, res) {
        try {
            const { zoneId } = req.params;
            const { since, until, dimensions } = req.query;

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

            const analytics = await cloudflareService.getZoneAnalytics(req.userId, zoneId, {
                since: since || '-1440', // 24h ago default
                until: until || '0',      // now default
                dimensions: dimensions ? dimensions.split(',') : undefined
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
            logger.error('Get zone analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy analytics',
                error: error.message
            });
        }
    }

    // Đồng bộ zones từ Cloudflare
    async syncZones(req, res) {
        try {
            const user = await User.findByPk(req.userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy người dùng'
                });
            }

            // Lấy zones từ Cloudflare
            const cloudflareZones = await cloudflareService.getZones(user.id);

            let syncedCount = 0;
            let updatedCount = 0;

            for (const zone of cloudflareZones) {
                const [dbZone, created] = await Zone.upsert({
                    cloudflareId: zone.id,
                    name: zone.name,
                    status: zone.status,
                    type: zone.type,
                    nameServers: JSON.stringify(zone.name_servers || []),
                    userId: user.id,
                    isActive: zone.status === 'active'
                });

                if (created) {
                    syncedCount++;
                } else {
                    updatedCount++;
                }
            }

            logger.info(`Zones synced for user: ${user.username}`, {
                userId: user.id,
                syncedCount,
                updatedCount,
                totalZones: cloudflareZones.length
            });

            res.json({
                success: true,
                message: 'Đồng bộ zones thành công',
                data: {
                    totalZones: cloudflareZones.length,
                    newZones: syncedCount,
                    updatedZones: updatedCount
                }
            });

        } catch (error) {
            logger.error('Sync zones error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi đồng bộ zones',
                error: error.message
            });
        }
    }
}

module.exports = new ZoneController();