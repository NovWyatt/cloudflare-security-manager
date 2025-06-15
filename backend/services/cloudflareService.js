const axios = require('axios');
const logger = require('../utils/logger');
const { handleCloudflareError } = require('../middleware/errorHandler');

class CloudflareService {
    constructor() {
        this.baseURL = process.env.CLOUDFLARE_API_BASE_URL || 'https://api.cloudflare.com/client/v4';
        this.timeout = parseInt(process.env.CLOUDFLARE_API_TIMEOUT) || 30000;

        // Create axios instance with default config
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: this.timeout,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Cloudflare-Security-Manager/1.0.0'
            }
        });

        // Request interceptor
        this.client.interceptors.request.use(
            (config) => {
                config.metadata = { startTime: Date.now() };
                logger.cloudflareApi('REQUEST', null, true, {
                    method: config.method?.toUpperCase(),
                    url: config.url,
                    hasAuth: !!config.headers.Authorization
                });
                return config;
            },
            (error) => {
                logger.cloudflareApi('REQUEST_ERROR', null, false, { error: error.message });
                return Promise.reject(error);
            }
        );

        // Response interceptor
        this.client.interceptors.response.use(
            (response) => {
                const duration = Date.now() - response.config.metadata.startTime;
                logger.cloudflareApi('RESPONSE', null, true, {
                    status: response.status,
                    duration: `${duration}ms`,
                    url: response.config.url
                });
                return response;
            },
            (error) => {
                const duration = error.config?.metadata ?
                    Date.now() - error.config.metadata.startTime : 0;

                logger.cloudflareApi('RESPONSE_ERROR', null, false, {
                    status: error.response?.status,
                    duration: `${duration}ms`,
                    url: error.config?.url,
                    error: error.message
                });

                handleCloudflareError(error);
            }
        );
    }

    /**
     * Set authorization header
     */
    setAuthToken(token) {
        this.client.defaults.headers.Authorization = `Bearer ${token}`;
    }

    /**
     * Create request with token
     */
    createAuthenticatedRequest(token) {
        return this.client.create({
            ...this.client.defaults,
            headers: {
                ...this.client.defaults.headers,
                Authorization: `Bearer ${token}`
            }
        });
    }

    // ===== ZONE MANAGEMENT =====

    /**
     * Get all zones for the authenticated user
     */
    async getZones(token, options = {}) {
        try {
            const client = this.createAuthenticatedRequest(token);

            const params = {
                page: options.page || 1,
                per_page: options.perPage || 50,
                order: options.order || 'name',
                direction: options.direction || 'asc',
                status: options.status,
                account: options.account,
                name: options.name
            };

            // Remove undefined params
            Object.keys(params).forEach(key =>
                params[key] === undefined && delete params[key]
            );

            const response = await client.get('/zones', { params });

            return {
                success: true,
                zones: response.data.result,
                pagination: {
                    page: response.data.result_info.page,
                    perPage: response.data.result_info.per_page,
                    totalPages: response.data.result_info.total_pages,
                    totalCount: response.data.result_info.total_count
                }
            };
        } catch (error) {
            logger.error('Failed to get zones:', error);
            throw error;
        }
    }

    /**
     * Get zone details by ID
     */
    async getZone(token, zoneId) {
        try {
            const client = this.createAuthenticatedRequest(token);
            const response = await client.get(`/zones/${zoneId}`);

            return {
                success: true,
                zone: response.data.result
            };
        } catch (error) {
            logger.error(`Failed to get zone ${zoneId}:`, error);
            throw error;
        }
    }

    /**
     * Verify zone access with token
     */
    async verifyZoneAccess(token, zoneId) {
        try {
            await this.getZone(token, zoneId);
            return true;
        } catch (error) {
            if (error.statusCode === 404 || error.statusCode === 403) {
                return false;
            }
            throw error;
        }
    }

    // ===== SECURITY SETTINGS =====

    /**
     * Get all security settings for a zone
     */
    async getSecuritySettings(token, zoneId) {
        try {
            const client = this.createAuthenticatedRequest(token);

            // Get multiple settings in parallel
            const [
                securityLevel,
                sslSettings,
                alwaysUseHttps,
                botFightMode,
                browserCheck,
                challengeTtl,
                developmentMode,
                scrapeShield
            ] = await Promise.all([
                this.getZoneSetting(token, zoneId, 'security_level'),
                this.getZoneSetting(token, zoneId, 'ssl'),
                this.getZoneSetting(token, zoneId, 'always_use_https'),
                this.getZoneSetting(token, zoneId, 'bot_fight_mode'),
                this.getZoneSetting(token, zoneId, 'browser_integrity_check'),
                this.getZoneSetting(token, zoneId, 'challenge_ttl'),
                this.getZoneSetting(token, zoneId, 'development_mode'),
                this.getScrapeShieldSettings(token, zoneId)
            ]);

            return {
                success: true,
                settings: {
                    security_level: securityLevel.value,
                    ssl_mode: sslSettings.value,
                    always_use_https: alwaysUseHttps.value,
                    bot_fight_mode: botFightMode.value,
                    browser_integrity_check: browserCheck.value,
                    challenge_ttl: challengeTtl.value,
                    development_mode: developmentMode.value,
                    scrape_shield: scrapeShield
                }
            };
        } catch (error) {
            logger.error(`Failed to get security settings for zone ${zoneId}:`, error);
            throw error;
        }
    }

    /**
     * Get a specific zone setting
     */
    async getZoneSetting(token, zoneId, settingName) {
        try {
            const client = this.createAuthenticatedRequest(token);
            const response = await client.get(`/zones/${zoneId}/settings/${settingName}`);

            return response.data.result;
        } catch (error) {
            logger.error(`Failed to get setting ${settingName} for zone ${zoneId}:`, error);
            throw error;
        }
    }

    /**
     * Update a zone setting
     */
    async updateZoneSetting(token, zoneId, settingName, value) {
        try {
            const client = this.createAuthenticatedRequest(token);

            const data = { value };

            const response = await client.patch(`/zones/${zoneId}/settings/${settingName}`, data);

            logger.cloudflareApi('UPDATE_SETTING', zoneId, true, {
                setting: settingName,
                oldValue: response.data.result.modified_on ? 'changed' : 'unchanged',
                newValue: value
            });

            return {
                success: true,
                setting: response.data.result
            };
        } catch (error) {
            logger.error(`Failed to update setting ${settingName} for zone ${zoneId}:`, error);
            throw error;
        }
    }

    /**
     * Bulk update multiple zone settings
     */
    async bulkUpdateSettings(token, zoneId, settings) {
        try {
            const results = {};
            const errors = {};

            // Update settings sequentially to avoid rate limits
            for (const [settingName, value] of Object.entries(settings)) {
                try {
                    const result = await this.updateZoneSetting(token, zoneId, settingName, value);
                    results[settingName] = result.setting;

                    // Small delay between requests
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    errors[settingName] = error.message;
                    logger.warn(`Failed to update setting ${settingName}:`, error);
                }
            }

            const hasErrors = Object.keys(errors).length > 0;

            return {
                success: !hasErrors,
                partial: hasErrors && Object.keys(results).length > 0,
                results,
                errors: hasErrors ? errors : undefined
            };
        } catch (error) {
            logger.error(`Failed to bulk update settings for zone ${zoneId}:`, error);
            throw error;
        }
    }

    // ===== SSL/TLS SETTINGS =====

    /**
     * Get SSL/TLS settings
     */
    async getSSLSettings(token, zoneId) {
        try {
            const [sslSettings, httpsSettings, tlsSettings] = await Promise.all([
                this.getZoneSetting(token, zoneId, 'ssl'),
                this.getZoneSetting(token, zoneId, 'always_use_https'),
                this.getZoneSetting(token, zoneId, 'min_tls_version')
            ]);

            return {
                success: true,
                ssl: {
                    mode: sslSettings.value,
                    always_use_https: httpsSettings.value,
                    min_tls_version: tlsSettings.value
                }
            };
        } catch (error) {
            logger.error(`Failed to get SSL settings for zone ${zoneId}:`, error);
            throw error;
        }
    }

    /**
     * Update SSL mode
     */
    async updateSSLMode(token, zoneId, mode) {
        const validModes = ['off', 'flexible', 'full', 'strict'];

        if (!validModes.includes(mode)) {
            throw new Error(`Invalid SSL mode: ${mode}. Valid modes: ${validModes.join(', ')}`);
        }

        return this.updateZoneSetting(token, zoneId, 'ssl', mode);
    }

    // ===== BOT MANAGEMENT =====

    /**
     * Get bot protection settings
     */
    async getBotSettings(token, zoneId) {
        try {
            const [botFightMode, superBotFightMode, botManagement] = await Promise.allSettled([
                this.getZoneSetting(token, zoneId, 'bot_fight_mode'),
                this.getZoneSetting(token, zoneId, 'super_bot_fight_mode'),
                this.getBotManagement(token, zoneId)
            ]);

            return {
                success: true,
                bot_protection: {
                    bot_fight_mode: botFightMode.status === 'fulfilled' ? botFightMode.value.value : 'off',
                    super_bot_fight_mode: superBotFightMode.status === 'fulfilled' ? superBotFightMode.value.value : 'off',
                    bot_management: botManagement.status === 'fulfilled' ? botManagement.value : null
                }
            };
        } catch (error) {
            logger.error(`Failed to get bot settings for zone ${zoneId}:`, error);
            throw error;
        }
    }

    /**
     * Get bot management configuration (Enterprise feature)
     */
    async getBotManagement(token, zoneId) {
        try {
            const client = this.createAuthenticatedRequest(token);
            const response = await client.get(`/zones/${zoneId}/bot_management`);

            return response.data.result;
        } catch (error) {
            // Bot management might not be available for this plan
            if (error.statusCode === 403 || error.statusCode === 404) {
                return null;
            }
            throw error;
        }
    }

    // ===== SCRAPE SHIELD =====

    /**
     * Get Scrape Shield settings
     */
    async getScrapeShieldSettings(token, zoneId) {
        try {
            const [emailObfuscation, serverSideExcludes, hotlinkProtection] = await Promise.all([
                this.getZoneSetting(token, zoneId, 'email_obfuscation'),
                this.getZoneSetting(token, zoneId, 'server_side_exclude'),
                this.getZoneSetting(token, zoneId, 'hotlink_protection')
            ]);

            return {
                email_obfuscation: emailObfuscation.value,
                server_side_excludes: serverSideExcludes.value,
                hotlink_protection: hotlinkProtection.value
            };
        } catch (error) {
            logger.warn(`Failed to get some Scrape Shield settings for zone ${zoneId}:`, error);
            return {
                email_obfuscation: 'off',
                server_side_excludes: 'off',
                hotlink_protection: 'off'
            };
        }
    }

    // ===== ANALYTICS =====

    /**
     * Get zone analytics
     */
    async getZoneAnalytics(token, zoneId, options = {}) {
        try {
            const client = this.createAuthenticatedRequest(token);

            const params = {
                since: options.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                until: options.until || new Date().toISOString(),
                continuous: options.continuous !== false
            };

            const response = await client.get(`/zones/${zoneId}/analytics/dashboard`, { params });

            return {
                success: true,
                analytics: response.data.result
            };
        } catch (error) {
            logger.error(`Failed to get analytics for zone ${zoneId}:`, error);
            throw error;
        }
    }

    /**
     * Get security events
     */
    async getSecurityEvents(token, zoneId, options = {}) {
        try {
            const client = this.createAuthenticatedRequest(token);

            const params = {
                since: options.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                until: options.until || new Date().toISOString()
            };

            const response = await client.get(`/zones/${zoneId}/security/events`, { params });

            return {
                success: true,
                events: response.data.result
            };
        } catch (error) {
            logger.error(`Failed to get security events for zone ${zoneId}:`, error);
            throw error;
        }
    }

    // ===== FIREWALL RULES =====

    /**
     * Get firewall rules
     */
    async getFirewallRules(token, zoneId) {
        try {
            const client = this.createAuthenticatedRequest(token);
            const response = await client.get(`/zones/${zoneId}/firewall/rules`);

            return {
                success: true,
                rules: response.data.result
            };
        } catch (error) {
            logger.error(`Failed to get firewall rules for zone ${zoneId}:`, error);
            throw error;
        }
    }

    /**
     * Create firewall rule
     */
    async createFirewallRule(token, zoneId, rule) {
        try {
            const client = this.createAuthenticatedRequest(token);
            const response = await client.post(`/zones/${zoneId}/firewall/rules`, rule);

            logger.cloudflareApi('CREATE_FIREWALL_RULE', zoneId, true, {
                ruleId: response.data.result.id,
                action: rule.action
            });

            return {
                success: true,
                rule: response.data.result
            };
        } catch (error) {
            logger.error(`Failed to create firewall rule for zone ${zoneId}:`, error);
            throw error;
        }
    }

    // ===== UTILITIES =====

    /**
     * Test API token validity
     */
    async testToken(token) {
        try {
            const client = this.createAuthenticatedRequest(token);
            const response = await client.get('/user/tokens/verify');

            return {
                valid: true,
                token_info: response.data.result
            };
        } catch (error) {
            logger.warn('Token validation failed:', error);
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Get account information
     */
    async getAccountInfo(token) {
        try {
            const client = this.createAuthenticatedRequest(token);
            const response = await client.get('/accounts');

            return {
                success: true,
                accounts: response.data.result
            };
        } catch (error) {
            logger.error('Failed to get account info:', error);
            throw error;
        }
    }

    /**
     * Purge cache for zone
     */
    async purgeCache(token, zoneId, options = {}) {
        try {
            const client = this.createAuthenticatedRequest(token);

            let data = {};

            if (options.purgeEverything) {
                data.purge_everything = true;
            } else if (options.files) {
                data.files = options.files;
            } else if (options.tags) {
                data.tags = options.tags;
            } else {
                data.purge_everything = true;
            }

            const response = await client.post(`/zones/${zoneId}/purge_cache`, data);

            logger.cloudflareApi('PURGE_CACHE', zoneId, true, {
                type: options.purgeEverything ? 'everything' : 'selective'
            });

            return {
                success: true,
                id: response.data.result.id
            };
        } catch (error) {
            logger.error(`Failed to purge cache for zone ${zoneId}:`, error);
            throw error;
        }
    }
}

// Create singleton instance
const cloudflareService = new CloudflareService();

module.exports = cloudflareService;