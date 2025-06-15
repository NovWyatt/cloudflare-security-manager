const express = require('express');
const { query, validationResult } = require('express-validator');

const { Zone, AuditLog } = require('../models');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authenticate, verifyZoneOwnership } = require('../middleware/auth');
const { analyticsLimiter } = require('../middleware/rateLimiter');
const cloudflareService = require('../services/cloudflareService');
const logger = require('../utils/logger');

const router = express.Router();

// All analytics routes require authentication
router.use(authenticate);

// Validation rules
const dateRangeValidation = [
    query('since')
        .optional()
        .isISO8601()
        .withMessage('Since must be a valid ISO 8601 date'),
    query('until')
        .optional()
        .isISO8601()
        .withMessage('Until must be a valid ISO 8601 date'),
    query('continuous')
        .optional()
        .isBoolean()
        .withMessage('Continuous must be a boolean')
];

const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Limit must be between 1 and 1000')
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            message: 'Please check your query parameters',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value
            }))
        });
    }
    next();
};

// Helper function to get default date range
const getDefaultDateRange = (period = '24h') => {
    const now = new Date();
    let since;

    switch (period) {
        case '1h':
            since = new Date(now.getTime() - 60 * 60 * 1000);
            break;
        case '6h':
            since = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            break;
        case '24h':
            since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    return {
        since: since.toISOString(),
        until: now.toISOString()
    };
};

/**
 * @route   GET /api/analytics/:zoneId/overview
 * @desc    Get analytics overview for a zone
 * @access  Private
 */
router.get('/:zoneId/overview',
    verifyZoneOwnership,
    analyticsLimiter,
    dateRangeValidation,
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const zone = req.zone;
        const { since, until, continuous = true, period = '24h' } = req.query;

        // Use provided dates or default range
        const dateRange = since && until ?
            { since, until } :
            getDefaultDateRange(period);

        try {
            const apiToken = zone.getDecryptedApiToken();

            const analytics = await cloudflareService.getZoneAnalytics(apiToken, zone.cloudflare_zone_id, {
                since: dateRange.since,
                until: dateRange.until,
                continuous: continuous !== 'false'
            });

            if (!analytics.success) {
                throw new AppError('Failed to fetch analytics from Cloudflare', 503);
            }

            // Process and format analytics data
            const processedData = processAnalyticsData(analytics.analytics, period);

            res.json({
                zone: {
                    id: zone.id,
                    name: zone.name,
                    status: zone.status,
                    plan: zone.plan
                },
                period: {
                    since: dateRange.since,
                    until: dateRange.until,
                    duration: period
                },
                overview: processedData.overview,
                timeseries: processedData.timeseries,
                top_stats: processedData.topStats,
                last_updated: new Date().toISOString()
            });

        } catch (error) {
            logger.error(`Failed to get analytics overview for zone ${zone.id}:`, error);
            throw error;
        }
    })
);

/**
 * @route   GET /api/analytics/:zoneId/threats
 * @desc    Get threat analytics and security events
 * @access  Private
 */
router.get('/:zoneId/threats',
    verifyZoneOwnership,
    analyticsLimiter,
    dateRangeValidation,
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const zone = req.zone;
        const { since, until, period = '24h' } = req.query;

        const dateRange = since && until ?
            { since, until } :
            getDefaultDateRange(period);

        try {
            const apiToken = zone.getDecryptedApiToken();

            const [securityEvents, zoneAnalytics] = await Promise.all([
                cloudflareService.getSecurityEvents(apiToken, zone.cloudflare_zone_id, {
                    since: dateRange.since,
                    until: dateRange.until
                }),
                cloudflareService.getZoneAnalytics(apiToken, zone.cloudflare_zone_id, {
                    since: dateRange.since,
                    until: dateRange.until
                })
            ]);

            // Process threat data
            const threatStats = processThreatData(securityEvents.events || [], zoneAnalytics.analytics);

            res.json({
                zone: {
                    id: zone.id,
                    name: zone.name
                },
                period: {
                    since: dateRange.since,
                    until: dateRange.until,
                    duration: period
                },
                threat_summary: threatStats.summary,
                threat_types: threatStats.byType,
                threat_countries: threatStats.byCountry,
                threat_timeline: threatStats.timeline,
                blocked_ips: threatStats.blockedIPs,
                security_level_effectiveness: threatStats.effectiveness,
                last_updated: new Date().toISOString()
            });

        } catch (error) {
            logger.error(`Failed to get threat analytics for zone ${zone.id}:`, error);
            throw error;
        }
    })
);

/**
 * @route   GET /api/analytics/:zoneId/performance
 * @desc    Get performance metrics
 * @access  Private
 */
router.get('/:zoneId/performance',
    verifyZoneOwnership,
    analyticsLimiter,
    dateRangeValidation,
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const zone = req.zone;
        const { since, until, period = '24h' } = req.query;

        const dateRange = since && until ?
            { since, until } :
            getDefaultDateRange(period);

        try {
            const apiToken = zone.getDecryptedApiToken();

            const analytics = await cloudflareService.getZoneAnalytics(apiToken, zone.cloudflare_zone_id, {
                since: dateRange.since,
                until: dateRange.until,
                continuous: true
            });

            if (!analytics.success) {
                throw new AppError('Failed to fetch performance metrics', 503);
            }

            // Process performance data
            const performanceData = processPerformanceData(analytics.analytics);

            res.json({
                zone: {
                    id: zone.id,
                    name: zone.name
                },
                period: {
                    since: dateRange.since,
                    until: dateRange.until,
                    duration: period
                },
                performance: {
                    cache_ratio: performanceData.cacheRatio,
                    bandwidth_saved: performanceData.bandwidthSaved,
                    response_time: performanceData.responseTime,
                    ssl_requests: performanceData.sslRequests,
                    http_status: performanceData.httpStatus,
                    content_types: performanceData.contentTypes
                },
                trends: performanceData.trends,
                last_updated: new Date().toISOString()
            });

        } catch (error) {
            logger.error(`Failed to get performance analytics for zone ${zone.id}:`, error);
            throw error;
        }
    })
);

/**
 * @route   GET /api/analytics/:zoneId/traffic
 * @desc    Get traffic analytics
 * @access  Private
 */
router.get('/:zoneId/traffic',
    verifyZoneOwnership,
    analyticsLimiter,
    dateRangeValidation,
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const zone = req.zone;
        const { since, until, period = '24h' } = req.query;

        const dateRange = since && until ?
            { since, until } :
            getDefaultDateRange(period);

        try {
            const apiToken = zone.getDecryptedApiToken();

            const analytics = await cloudflareService.getZoneAnalytics(apiToken, zone.cloudflare_zone_id, {
                since: dateRange.since,
                until: dateRange.until,
                continuous: true
            });

            if (!analytics.success) {
                throw new AppError('Failed to fetch traffic analytics', 503);
            }

            // Process traffic data
            const trafficData = processTrafficData(analytics.analytics);

            res.json({
                zone: {
                    id: zone.id,
                    name: zone.name
                },
                period: {
                    since: dateRange.since,
                    until: dateRange.until,
                    duration: period
                },
                traffic: {
                    total_requests: trafficData.totalRequests,
                    unique_visitors: trafficData.uniqueVisitors,
                    page_views: trafficData.pageViews,
                    bandwidth: trafficData.bandwidth,
                    requests_by_country: trafficData.byCountry,
                    requests_by_ssl: trafficData.bySsl,
                    requests_by_http_version: trafficData.byHttpVersion
                },
                timeline: trafficData.timeline,
                last_updated: new Date().toISOString()
            });

        } catch (error) {
            logger.error(`Failed to get traffic analytics for zone ${zone.id}:`, error);
            throw error;
        }
    })
);

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get dashboard analytics for all user zones
 * @access  Private
 */
router.get('/dashboard',
    analyticsLimiter,
    [
        query('period')
            .optional()
            .isIn(['1h', '6h', '24h', '7d', '30d'])
            .withMessage('Period must be one of: 1h, 6h, 24h, 7d, 30d')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { period = '24h' } = req.query;
        const dateRange = getDefaultDateRange(period);

        try {
            // Get user's zones
            const zones = await Zone.findByUser(req.user.id, {
                status: 'active'
            });

            if (zones.length === 0) {
                return res.json({
                    message: 'No active zones found',
                    summary: {
                        total_zones: 0,
                        total_requests: 0,
                        total_threats: 0,
                        bandwidth_saved: 0
                    },
                    zones: [],
                    period: dateRange
                });
            }

            // Get analytics for each zone (limit to first 10 for performance)
            const zoneAnalytics = await Promise.allSettled(
                zones.slice(0, 10).map(async (zone) => {
                    try {
                        const apiToken = zone.getDecryptedApiToken();
                        const analytics = await cloudflareService.getZoneAnalytics(apiToken, zone.cloudflare_zone_id, {
                            since: dateRange.since,
                            until: dateRange.until
                        });

                        return {
                            zone: {
                                id: zone.id,
                                name: zone.name,
                                status: zone.status,
                                plan: zone.plan
                            },
                            analytics: analytics.success ? analytics.analytics : null,
                            error: analytics.success ? null : 'Failed to fetch data'
                        };
                    } catch (error) {
                        return {
                            zone: {
                                id: zone.id,
                                name: zone.name,
                                status: zone.status,
                                plan: zone.plan
                            },
                            analytics: null,
                            error: error.message
                        };
                    }
                })
            );

            // Process results
            const results = zoneAnalytics
                .filter(result => result.status === 'fulfilled')
                .map(result => result.value);

            // Calculate summary statistics
            const summary = calculateDashboardSummary(results);

            res.json({
                summary,
                zones: results,
                period: {
                    since: dateRange.since,
                    until: dateRange.until,
                    duration: period
                },
                last_updated: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Failed to get dashboard analytics:', error);
            throw error;
        }
    })
);

/**
 * @route   GET /api/analytics/:zoneId/reports/security
 * @desc    Generate security report for a zone
 * @access  Private
 */
router.get('/:zoneId/reports/security',
    verifyZoneOwnership,
    analyticsLimiter,
    dateRangeValidation,
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const zone = req.zone;
        const { since, until, period = '7d' } = req.query;

        const dateRange = since && until ?
            { since, until } :
            getDefaultDateRange(period);

        try {
            const apiToken = zone.getDecryptedApiToken();

            const [securityEvents, analytics, auditLogs] = await Promise.all([
                cloudflareService.getSecurityEvents(apiToken, zone.cloudflare_zone_id, {
                    since: dateRange.since,
                    until: dateRange.until
                }),
                cloudflareService.getZoneAnalytics(apiToken, zone.cloudflare_zone_id, {
                    since: dateRange.since,
                    until: dateRange.until
                }),
                AuditLog.getByZone(zone.id, {
                    category: 'security',
                    dateFrom: dateRange.since,
                    dateTo: dateRange.until,
                    limit: 100
                })
            ]);

            // Generate comprehensive security report
            const securityReport = generateSecurityReport(
                zone,
                securityEvents.events || [],
                analytics.analytics,
                auditLogs.rows,
                dateRange
            );

            res.json(securityReport);

        } catch (error) {
            logger.error(`Failed to generate security report for zone ${zone.id}:`, error);
            throw error;
        }
    })
);

// Helper functions for data processing
function processAnalyticsData(analytics, period) {
    // Process raw Cloudflare analytics data
    const timeseries = analytics.timeseries || [];
    const totals = analytics.totals || {};

    return {
        overview: {
            requests: totals.requests?.all || 0,
            bandwidth: totals.bandwidth?.all || 0,
            unique_visitors: totals.uniques?.all || 0,
            threats: totals.threats?.all || 0,
            page_views: totals.pageviews?.all || 0
        },
        timeseries: timeseries.map(point => ({
            timestamp: point.since,
            requests: point.requests?.all || 0,
            bandwidth: point.bandwidth?.all || 0,
            threats: point.threats?.all || 0,
            unique_visitors: point.uniques?.all || 0
        })),
        topStats: {
            cache_ratio: calculateCacheRatio(totals),
            ssl_ratio: calculateSSLRatio(totals),
            threat_ratio: calculateThreatRatio(totals),
            bandwidth_saved: calculateBandwidthSaved(totals)
        }
    };
}

function processThreatData(securityEvents, analytics) {
    const summary = {
        total_threats: securityEvents.length,
        blocked_requests: securityEvents.filter(e => e.action === 'drop').length,
        challenged_requests: securityEvents.filter(e => e.action === 'challenge').length,
        allowed_requests: securityEvents.filter(e => e.action === 'allow').length
    };

    // Group by threat type
    const byType = securityEvents.reduce((acc, event) => {
        const type = event.rule_id || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});

    // Group by country
    const byCountry = securityEvents.reduce((acc, event) => {
        const country = event.country || 'unknown';
        acc[country] = (acc[country] || 0) + 1;
        return acc;
    }, {});

    // Create timeline (hourly buckets)
    const timeline = createTimelineBuckets(securityEvents, 'hour');

    // Get most blocked IPs
    const blockedIPs = securityEvents
        .filter(e => e.action === 'drop')
        .reduce((acc, event) => {
            const ip = event.client_ip;
            acc[ip] = (acc[ip] || 0) + 1;
            return acc;
        }, {});

    const topBlockedIPs = Object.entries(blockedIPs)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([ip, count]) => ({ ip, count }));

    return {
        summary,
        byType: Object.entries(byType)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([type, count]) => ({ type, count })),
        byCountry: Object.entries(byCountry)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([country, count]) => ({ country, count })),
        timeline,
        blockedIPs: topBlockedIPs,
        effectiveness: calculateSecurityEffectiveness(analytics, summary)
    };
}

function processPerformanceData(analytics) {
    const totals = analytics.totals || {};

    const cacheRatio = calculateCacheRatio(totals);
    const bandwidthSaved = calculateBandwidthSaved(totals);

    return {
        cacheRatio: {
            hit: cacheRatio.hit,
            miss: cacheRatio.miss,
            ratio: cacheRatio.ratio
        },
        bandwidthSaved: {
            total: bandwidthSaved.total,
            saved: bandwidthSaved.saved,
            percentage: bandwidthSaved.percentage
        },
        responseTime: {
            avg: totals.response_time?.avg || 0,
            median: totals.response_time?.median || 0,
            p95: totals.response_time?.p95 || 0
        },
        sslRequests: {
            ssl: totals.requests?.ssl?.encrypted || 0,
            non_ssl: totals.requests?.ssl?.unencrypted || 0,
            ratio: calculateSSLRatio(totals)
        },
        httpStatus: {
            '2xx': totals.requests?.http_status?.['2xx'] || 0,
            '3xx': totals.requests?.http_status?.['3xx'] || 0,
            '4xx': totals.requests?.http_status?.['4xx'] || 0,
            '5xx': totals.requests?.http_status?.['5xx'] || 0
        },
        contentTypes: totals.requests?.content_type || {},
        trends: calculatePerformanceTrends(analytics.timeseries || [])
    };
}

function processTrafficData(analytics) {
    const totals = analytics.totals || {};
    const timeseries = analytics.timeseries || [];

    return {
        totalRequests: totals.requests?.all || 0,
        uniqueVisitors: totals.uniques?.all || 0,
        pageViews: totals.pageviews?.all || 0,
        bandwidth: totals.bandwidth?.all || 0,
        byCountry: totals.requests?.country || {},
        bySsl: {
            encrypted: totals.requests?.ssl?.encrypted || 0,
            unencrypted: totals.requests?.ssl?.unencrypted || 0
        },
        byHttpVersion: totals.requests?.http_version || {},
        timeline: timeseries.map(point => ({
            timestamp: point.since,
            requests: point.requests?.all || 0,
            bandwidth: point.bandwidth?.all || 0,
            unique_visitors: point.uniques?.all || 0
        }))
    };
}

function calculateDashboardSummary(zoneResults) {
    const summary = {
        total_zones: zoneResults.length,
        active_zones: zoneResults.filter(r => r.zone.status === 'active').length,
        total_requests: 0,
        total_threats: 0,
        bandwidth_saved: 0,
        cache_hit_ratio: 0,
        ssl_ratio: 0
    };

    let validZones = 0;
    let totalCacheRatio = 0;
    let totalSSLRatio = 0;

    zoneResults.forEach(result => {
        if (result.analytics && result.analytics.totals) {
            const totals = result.analytics.totals;
            summary.total_requests += totals.requests?.all || 0;
            summary.total_threats += totals.threats?.all || 0;

            const bandwidthSaved = calculateBandwidthSaved(totals);
            summary.bandwidth_saved += bandwidthSaved.saved || 0;

            const cacheRatio = calculateCacheRatio(totals);
            const sslRatio = calculateSSLRatio(totals);

            if (cacheRatio.ratio > 0) {
                totalCacheRatio += cacheRatio.ratio;
                validZones++;
            }

            if (sslRatio > 0) {
                totalSSLRatio += sslRatio;
            }
        }
    });

    summary.cache_hit_ratio = validZones > 0 ? totalCacheRatio / validZones : 0;
    summary.ssl_ratio = zoneResults.length > 0 ? totalSSLRatio / zoneResults.length : 0;

    return summary;
}

function generateSecurityReport(zone, securityEvents, analytics, auditLogs, dateRange) {
    const threatData = processThreatData(securityEvents, analytics);
    const performanceData = processPerformanceData(analytics);

    return {
        zone: {
            id: zone.id,
            name: zone.name,
            status: zone.status,
            plan: zone.plan
        },
        report_period: {
            since: dateRange.since,
            until: dateRange.until,
            duration_days: Math.ceil((new Date(dateRange.until) - new Date(dateRange.since)) / (1000 * 60 * 60 * 24))
        },
        executive_summary: {
            total_requests: analytics.totals?.requests?.all || 0,
            blocked_threats: threatData.summary.blocked_requests,
            threat_ratio: ((threatData.summary.total_threats / (analytics.totals?.requests?.all || 1)) * 100).toFixed(2),
            security_effectiveness: threatData.effectiveness
        },
        threat_analysis: {
            summary: threatData.summary,
            top_threat_types: threatData.byType.slice(0, 5),
            geographic_distribution: threatData.byCountry.slice(0, 10),
            attack_timeline: threatData.timeline,
            top_blocked_ips: threatData.blockedIPs.slice(0, 5)
        },
        security_configuration: {
            recent_changes: auditLogs.slice(0, 10).map(log => ({
                action: log.action,
                description: log.description,
                timestamp: log.created_at,
                user: log.user?.name || 'System'
            })),
            recommendations: [] // Would be populated with security recommendations
        },
        performance_impact: {
            cache_performance: performanceData.cacheRatio,
            ssl_adoption: performanceData.sslRequests,
            response_times: performanceData.responseTime
        },
        generated_at: new Date().toISOString()
    };
}

// Utility functions
function calculateCacheRatio(totals) {
    const cached = totals.requests?.cache_status?.hit || 0;
    const uncached = totals.requests?.cache_status?.miss || 0;
    const total = cached + uncached;

    return {
        hit: cached,
        miss: uncached,
        ratio: total > 0 ? (cached / total) * 100 : 0
    };
}

function calculateSSLRatio(totals) {
    const ssl = totals.requests?.ssl?.encrypted || 0;
    const nonSSL = totals.requests?.ssl?.unencrypted || 0;
    const total = ssl + nonSSL;

    return total > 0 ? (ssl / total) * 100 : 0;
}

function calculateThreatRatio(totals) {
    const threats = totals.threats?.all || 0;
    const requests = totals.requests?.all || 0;

    return requests > 0 ? (threats / requests) * 100 : 0;
}

function calculateBandwidthSaved(totals) {
    const cached = totals.bandwidth?.cache_status?.hit || 0;
    const uncached = totals.bandwidth?.cache_status?.miss || 0;
    const total = cached + uncached;

    return {
        total,
        saved: cached,
        percentage: total > 0 ? (cached / total) * 100 : 0
    };
}

function calculateSecurityEffectiveness(analytics, threatSummary) {
    const totalRequests = analytics.totals?.requests?.all || 0;
    const blockedThreats = threatSummary.blocked_requests;

    if (totalRequests === 0) return 0;

    return ((blockedThreats / totalRequests) * 100).toFixed(2);
}

function createTimelineBuckets(events, interval = 'hour') {
    const buckets = {};
    const intervalMs = interval === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    events.forEach(event => {
        const timestamp = new Date(event.occurred_at || event.timestamp);
        const bucketTime = new Date(Math.floor(timestamp.getTime() / intervalMs) * intervalMs);
        const key = bucketTime.toISOString();

        if (!buckets[key]) {
            buckets[key] = { timestamp: key, count: 0, blocked: 0, challenged: 0 };
        }

        buckets[key].count++;
        if (event.action === 'drop') buckets[key].blocked++;
        if (event.action === 'challenge') buckets[key].challenged++;
    });

    return Object.values(buckets).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function calculatePerformanceTrends(timeseries) {
    if (timeseries.length < 2) return { cache_ratio: 'stable', response_time: 'stable' };

    const firstHalf = timeseries.slice(0, Math.floor(timeseries.length / 2));
    const secondHalf = timeseries.slice(Math.floor(timeseries.length / 2));

    const firstCacheRatio = calculateAverageCacheRatio(firstHalf);
    const secondCacheRatio = calculateAverageCacheRatio(secondHalf);

    const firstResponseTime = calculateAverageResponseTime(firstHalf);
    const secondResponseTime = calculateAverageResponseTime(secondHalf);

    const cacheRatioTrend = secondCacheRatio > firstCacheRatio + 5 ? 'improving' :
        secondCacheRatio < firstCacheRatio - 5 ? 'declining' : 'stable';

    const responseTimeTrend = secondResponseTime < firstResponseTime - 50 ? 'improving' :
        secondResponseTime > firstResponseTime + 50 ? 'declining' : 'stable';

    return {
        cache_ratio: cacheRatioTrend,
        response_time: responseTimeTrend
    };
}

function calculateAverageCacheRatio(timeseries) {
    if (timeseries.length === 0) return 0;

    const ratios = timeseries.map(point => {
        const hit = point.requests?.cache_status?.hit || 0;
        const miss = point.requests?.cache_status?.miss || 0;
        const total = hit + miss;
        return total > 0 ? (hit / total) * 100 : 0;
    });

    return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
}

function calculateAverageResponseTime(timeseries) {
    if (timeseries.length === 0) return 0;

    const responseTimes = timeseries
        .map(point => point.response_time?.avg || 0)
        .filter(time => time > 0);

    if (responseTimes.length === 0) return 0;

    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
}

module.exports = router;