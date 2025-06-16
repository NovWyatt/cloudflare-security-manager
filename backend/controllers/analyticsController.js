const { Zone } = require('../models');
const cloudflareService = require('../services/cloudflareService');
const logger = require('../utils/logger');

class AnalyticsController {
    // Lấy dashboard overview analytics
    async getDashboardOverview(req, res) {
        try {
            const { timeRange = '24h' } = req.query;

            // Chuyển đổi timeRange thành since/until
            const timeRanges = {
                '1h': { since: '-60', until: '0' },
                '6h': { since: '-360', until: '0' },
                '24h': { since: '-1440', until: '0' },
                '7d': { since: '-10080', until: '0' },
                '30d': { since: '-43200', until: '0' }
            };

            const { since, until } = timeRanges[timeRange] || timeRanges['24h'];

            // Lấy tất cả zones của user
            const zones = await Zone.findAll({
                where: { userId: req.userId },
                attributes: ['id', 'cloudflareId', 'name']
            });

            if (zones.length === 0) {
                return res.json({
                    success: true,
                    data: {
                        totalRequests: 0,
                        totalBandwidth: 0,
                        uniqueVisitors: 0,
                        threats: 0,
                        zones: [],
                        timeRange
                    }
                });
            }

            // Lấy analytics cho tất cả zones
            const analyticsPromises = zones.map(async (zone) => {
                try {
                    const analytics = await cloudflareService.getZoneAnalytics(req.userId, zone.cloudflareId, {
                        since,
                        until,
                        dimensions: ['datetime']
                    });
                    return { zone: zone.name, zoneId: zone.cloudflareId, analytics };
                } catch (error) {
                    logger.warn(`Failed to get analytics for zone ${zone.name}:`, error.message);
                    return { zone: zone.name, zoneId: zone.cloudflareId, analytics: null };
                }
            });

            const allAnalytics = await Promise.all(analyticsPromises);

            // Tổng hợp dữ liệu
            let totalRequests = 0;
            let totalBandwidth = 0;
            let uniqueVisitors = 0;
            let threats = 0;

            const zonesSummary = allAnalytics.map(({ zone, zoneId, analytics }) => {
                if (!analytics || !analytics.totals) {
                    return {
                        name: zone,
                        zoneId,
                        requests: 0,
                        bandwidth: 0,
                        visitors: 0,
                        threats: 0
                    };
                }

                const zoneRequests = analytics.totals.requests?.all || 0;
                const zoneBandwidth = analytics.totals.bytes?.all || 0;
                const zoneVisitors = analytics.totals.uniques?.all || 0;
                const zoneThreats = analytics.totals.threats?.all || 0;

                totalRequests += zoneRequests;
                totalBandwidth += zoneBandwidth;
                uniqueVisitors += zoneVisitors;
                threats += zoneThreats;

                return {
                    name: zone,
                    zoneId,
                    requests: zoneRequests,
                    bandwidth: zoneBandwidth,
                    visitors: zoneVisitors,
                    threats: zoneThreats
                };
            });

            res.json({
                success: true,
                data: {
                    totalRequests,
                    totalBandwidth,
                    uniqueVisitors,
                    threats,
                    zones: zonesSummary,
                    timeRange,
                    period: { since, until }
                }
            });

        } catch (error) {
            logger.error('Get dashboard overview error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy dashboard overview',
                error: error.message
            });
        }
    }

    // Lấy analytics chi tiết cho một zone
    async getZoneAnalytics(req, res) {
        try {
            const { zoneId } = req.params;
            const { since, until, dimensions, metrics } = req.query;

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

            const analyticsParams = {
                since: since || '-1440', // 24h ago default
                until: until || '0',      // now default
            };

            if (dimensions) {
                analyticsParams.dimensions = dimensions.split(',');
            }

            if (metrics) {
                analyticsParams.metrics = metrics.split(',');
            }

            const analytics = await cloudflareService.getZoneAnalytics(req.userId, zoneId, analyticsParams);

            res.json({
                success: true,
                data: {
                    zoneId,
                    zoneName: zone.name,
                    analytics,
                    params: analyticsParams
                }
            });

        } catch (error) {
            logger.error('Get zone analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy zone analytics',
                error: error.message
            });
        }
    }

    // Lấy traffic analytics
    async getTrafficAnalytics(req, res) {
        try {
            const { zoneId } = req.params;
            const { timeRange = '24h', granularity = 'hour' } = req.query;

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

            // Chuyển đổi timeRange
            const timeRanges = {
                '1h': { since: '-60', until: '0' },
                '6h': { since: '-360', until: '0' },
                '24h': { since: '-1440', until: '0' },
                '7d': { since: '-10080', until: '0' },
                '30d': { since: '-43200', until: '0' }
            };

            const { since, until } = timeRanges[timeRange] || timeRanges['24h'];

            const analytics = await cloudflareService.getZoneAnalytics(req.userId, zoneId, {
                since,
                until,
                dimensions: ['datetime'],
                metrics: ['requests', 'bytes', 'uniques']
            });

            // Xử lý dữ liệu để tạo time series
            const timeSeries = analytics.data ? analytics.data.map(item => ({
                datetime: item.dimensions.datetime,
                requests: item.metrics.requests,
                bytes: item.metrics.bytes,
                uniques: item.metrics.uniques
            })) : [];

            res.json({
                success: true,
                data: {
                    zoneId,
                    zoneName: zone.name,
                    timeRange,
                    granularity,
                    totals: analytics.totals,
                    timeSeries
                }
            });

        } catch (error) {
            logger.error('Get traffic analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy traffic analytics',
                error: error.message
            });
        }
    }

    // Lấy security/threat analytics
    async getThreatAnalytics(req, res) {
        try {
            const { zoneId } = req.params;
            const { timeRange = '24h' } = req.query;

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

            const timeRanges = {
                '1h': { since: '-60', until: '0' },
                '6h': { since: '-360', until: '0' },
                '24h': { since: '-1440', until: '0' },
                '7d': { since: '-10080', until: '0' },
                '30d': { since: '-43200', until: '0' }
            };

            const { since, until } = timeRanges[timeRange] || timeRanges['24h'];

            // Lấy security analytics
            const securityAnalytics = await cloudflareService.getSecurityAnalytics(req.userId, zoneId, {
                since,
                until
            });

            // Lấy firewall events
            const firewallEvents = await cloudflareService.getFirewallEvents(req.userId, zoneId, {
                since,
                until
            });

            res.json({
                success: true,
                data: {
                    zoneId,
                    zoneName: zone.name,
                    timeRange,
                    securityAnalytics,
                    firewallEvents
                }
            });

        } catch (error) {
            logger.error('Get threat analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy threat analytics',
                error: error.message
            });
        }
    }

    // Lấy performance analytics
    async getPerformanceAnalytics(req, res) {
        try {
            const { zoneId } = req.params;
            const { timeRange = '24h' } = req.query;

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

            const timeRanges = {
                '1h': { since: '-60', until: '0' },
                '6h': { since: '-360', until: '0' },
                '24h': { since: '-1440', until: '0' },
                '7d': { since: '-10080', until: '0' },
                '30d': { since: '-43200', until: '0' }
            };

            const { since, until } = timeRanges[timeRange] || timeRanges['24h'];

            // Lấy performance metrics
            const performanceAnalytics = await cloudflareService.getZoneAnalytics(req.userId, zoneId, {
                since,
                until,
                dimensions: ['datetime', 'cacheStatus'],
                metrics: ['requests', 'bytes']
            });

            // Tính toán cache hit ratio và bandwidth savings
            let cacheHits = 0;
            let cacheMisses = 0;
            let bandwidthSaved = 0;

            if (performanceAnalytics.data) {
                performanceAnalytics.data.forEach(item => {
                    const cacheStatus = item.dimensions.cacheStatus;
                    const requests = item.metrics.requests || 0;
                    const bytes = item.metrics.bytes || 0;

                    if (cacheStatus === 'hit') {
                        cacheHits += requests;
                        bandwidthSaved += bytes;
                    } else if (cacheStatus === 'miss') {
                        cacheMisses += requests;
                    }
                });
            }

            const totalRequests = cacheHits + cacheMisses;
            const cacheHitRatio = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;

            res.json({
                success: true,
                data: {
                    zoneId,
                    zoneName: zone.name,
                    timeRange,
                    performance: {
                        cacheHitRatio: Math.round(cacheHitRatio * 100) / 100,
                        cacheHits,
                        cacheMisses,
                        totalRequests,
                        bandwidthSaved
                    },
                    analytics: performanceAnalytics
                }
            });

        } catch (error) {
            logger.error('Get performance analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy performance analytics',
                error: error.message
            });
        }
    }

    // Lấy top statistics (countries, content types, etc.)
    async getTopStatistics(req, res) {
        try {
            const { zoneId } = req.params;
            const { timeRange = '24h', dimension = 'country' } = req.query;

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

            const timeRanges = {
                '1h': { since: '-60', until: '0' },
                '6h': { since: '-360', until: '0' },
                '24h': { since: '-1440', until: '0' },
                '7d': { since: '-10080', until: '0' },
                '30d': { since: '-43200', until: '0' }
            };

            const { since, until } = timeRanges[timeRange] || timeRanges['24h'];

            const validDimensions = ['country', 'contentType', 'clientSSLProtocol', 'clientHTTPProtocol', 'clientAsn'];
            const requestedDimension = validDimensions.includes(dimension) ? dimension : 'country';

            const analytics = await cloudflareService.getZoneAnalytics(req.userId, zoneId, {
                since,
                until,
                dimensions: [requestedDimension],
                metrics: ['requests', 'bytes'],
                limit: 20 // Top 20
            });

            // Sắp xếp theo số requests giảm dần
            const sortedData = analytics.data ? analytics.data
                .sort((a, b) => (b.metrics.requests || 0) - (a.metrics.requests || 0))
                .slice(0, 10) // Top 10
                .map(item => ({
                    [requestedDimension]: item.dimensions[requestedDimension],
                    requests: item.metrics.requests || 0,
                    bytes: item.metrics.bytes || 0
                })) : [];

            res.json({
                success: true,
                data: {
                    zoneId,
                    zoneName: zone.name,
                    timeRange,
                    dimension: requestedDimension,
                    statistics: sortedData,
                    totals: analytics.totals
                }
            });

        } catch (error) {
            logger.error('Get top statistics error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy top statistics',
                error: error.message
            });
        }
    }

    // Export analytics data
    async exportAnalytics(req, res) {
        try {
            const { zoneId } = req.params;
            const { since, until, format = 'json' } = req.query;

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
                since: since || '-1440',
                until: until || '0',
                dimensions: ['datetime', 'country', 'contentType'],
                metrics: ['requests', 'bytes', 'uniques']
            });

            const exportData = {
                zone: {
                    id: zoneId,
                    name: zone.name
                },
                period: {
                    since: since || '-1440',
                    until: until || '0'
                },
                exportedAt: new Date().toISOString(),
                analytics
            };

            if (format === 'csv') {
                // Convert to CSV format
                const csv = this.convertToCSV(analytics.data || []);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${zone.name}-analytics-${Date.now()}.csv"`);
                res.send(csv);
            } else {
                // JSON format (default)
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="${zone.name}-analytics-${Date.now()}.json"`);
                res.json(exportData);
            }

        } catch (error) {
            logger.error('Export analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi export analytics',
                error: error.message
            });
        }
    }

    // Helper method to convert analytics data to CSV
    convertToCSV(data) {
        if (!data || data.length === 0) {
            return 'No data available';
        }

        // Get headers from first row
        const firstRow = data[0];
        const dimensionKeys = Object.keys(firstRow.dimensions || {});
        const metricKeys = Object.keys(firstRow.metrics || {});

        const headers = [...dimensionKeys, ...metricKeys];

        // Create CSV content
        let csv = headers.join(',') + '\n';

        data.forEach(row => {
            const values = [];

            // Add dimension values
            dimensionKeys.forEach(key => {
                values.push(row.dimensions[key] || '');
            });

            // Add metric values
            metricKeys.forEach(key => {
                values.push(row.metrics[key] || 0);
            });

            csv += values.map(value => `"${value}"`).join(',') + '\n';
        });

        return csv;
    }

    // Lấy real-time analytics
    async getRealTimeAnalytics(req, res) {
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

            // Lấy analytics cho 5 phút gần nhất
            const analytics = await cloudflareService.getZoneAnalytics(req.userId, zoneId, {
                since: '-5',  // 5 minutes ago
                until: '0',   // now
                dimensions: ['datetime'],
                metrics: ['requests', 'bytes', 'uniques']
            });

            // Lấy current threats
            const threatAnalytics = await cloudflareService.getSecurityAnalytics(req.userId, zoneId, {
                since: '-5',
                until: '0'
            });

            res.json({
                success: true,
                data: {
                    zoneId,
                    zoneName: zone.name,
                    timestamp: new Date().toISOString(),
                    analytics,
                    threats: threatAnalytics
                }
            });

        } catch (error) {
            logger.error('Get real-time analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy real-time analytics',
                error: error.message
            });
        }
    }

    // Lấy bandwidth analytics
    async getBandwidthAnalytics(req, res) {
        try {
            const { zoneId } = req.params;
            const { timeRange = '24h' } = req.query;

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

            const timeRanges = {
                '1h': { since: '-60', until: '0' },
                '6h': { since: '-360', until: '0' },
                '24h': { since: '-1440', until: '0' },
                '7d': { since: '-10080', until: '0' },
                '30d': { since: '-43200', until: '0' }
            };

            const { since, until } = timeRanges[timeRange] || timeRanges['24h'];

            const analytics = await cloudflareService.getZoneAnalytics(req.userId, zoneId, {
                since,
                until,
                dimensions: ['datetime', 'cacheStatus'],
                metrics: ['bytes']
            });

            // Phân tích bandwidth theo cache status
            let cachedBytes = 0;
            let uncachedBytes = 0;
            const timeSeries = [];

            if (analytics.data) {
                const timeGroups = {};

                analytics.data.forEach(item => {
                    const datetime = item.dimensions.datetime;
                    const cacheStatus = item.dimensions.cacheStatus;
                    const bytes = item.metrics.bytes || 0;

                    if (!timeGroups[datetime]) {
                        timeGroups[datetime] = { datetime, cached: 0, uncached: 0 };
                    }

                    if (cacheStatus === 'hit') {
                        timeGroups[datetime].cached += bytes;
                        cachedBytes += bytes;
                    } else {
                        timeGroups[datetime].uncached += bytes;
                        uncachedBytes += bytes;
                    }
                });

                timeSeries.push(...Object.values(timeGroups));
                timeSeries.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
            }

            const totalBytes = cachedBytes + uncachedBytes;
            const cacheRatio = totalBytes > 0 ? (cachedBytes / totalBytes) * 100 : 0;

            res.json({
                success: true,
                data: {
                    zoneId,
                    zoneName: zone.name,
                    timeRange,
                    summary: {
                        totalBytes,
                        cachedBytes,
                        uncachedBytes,
                        cacheRatio: Math.round(cacheRatio * 100) / 100,
                        bandwidthSaved: cachedBytes
                    },
                    timeSeries
                }
            });

        } catch (error) {
            logger.error('Get bandwidth analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy bandwidth analytics',
                error: error.message
            });
        }
    }

    // Lấy visitor analytics
    async getVisitorAnalytics(req, res) {
        try {
            const { zoneId } = req.params;
            const { timeRange = '24h' } = req.query;

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

            const timeRanges = {
                '1h': { since: '-60', until: '0' },
                '6h': { since: '-360', until: '0' },
                '24h': { since: '-1440', until: '0' },
                '7d': { since: '-10080', until: '0' },
                '30d': { since: '-43200', until: '0' }
            };

            const { since, until } = timeRanges[timeRange] || timeRanges['24h'];

            // Lấy visitor analytics by country
            const countryAnalytics = await cloudflareService.getZoneAnalytics(req.userId, zoneId, {
                since,
                until,
                dimensions: ['country'],
                metrics: ['uniques', 'requests']
            });

            // Lấy visitor analytics by datetime
            const timeAnalytics = await cloudflareService.getZoneAnalytics(req.userId, zoneId, {
                since,
                until,
                dimensions: ['datetime'],
                metrics: ['uniques', 'requests']
            });

            // Top countries
            const topCountries = countryAnalytics.data ? countryAnalytics.data
                .sort((a, b) => (b.metrics.uniques || 0) - (a.metrics.uniques || 0))
                .slice(0, 10)
                .map(item => ({
                    country: item.dimensions.country,
                    visitors: item.metrics.uniques || 0,
                    requests: item.metrics.requests || 0
                })) : [];

            // Time series
            const timeSeries = timeAnalytics.data ? timeAnalytics.data
                .map(item => ({
                    datetime: item.dimensions.datetime,
                    visitors: item.metrics.uniques || 0,
                    requests: item.metrics.requests || 0
                }))
                .sort((a, b) => new Date(a.datetime) - new Date(b.datetime)) : [];

            res.json({
                success: true,
                data: {
                    zoneId,
                    zoneName: zone.name,
                    timeRange,
                    summary: {
                        totalVisitors: countryAnalytics.totals?.uniques?.all || 0,
                        totalRequests: countryAnalytics.totals?.requests?.all || 0
                    },
                    topCountries,
                    timeSeries
                }
            });

        } catch (error) {
            logger.error('Get visitor analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi khi lấy visitor analytics',
                error: error.message
            });
        }
    }
}

module.exports = new AnalyticsController();