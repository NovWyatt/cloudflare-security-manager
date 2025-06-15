-- Cloudflare Security Manager Database Schema
-- SQLite compatible schema with proper indexes and constraints

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'premium', 'admin')),
    is_active BOOLEAN DEFAULT 1,
    is_verified BOOLEAN DEFAULT 0,
    verification_token TEXT,
    reset_password_token TEXT,
    reset_password_expires DATETIME,
    last_login DATETIME,
    login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    preferences TEXT DEFAULT '{"theme":"light","notifications":{"email":true,"security_alerts":true,"weekly_reports":false},"dashboard":{"default_view":"overview","auto_refresh":true,"refresh_interval":30}}',
    api_usage TEXT DEFAULT '{"requests_today":0,"requests_this_month":0,"last_reset":""}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Zones table
CREATE TABLE IF NOT EXISTS zones (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL,
    cloudflare_zone_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('active', 'pending', 'initializing', 'moved', 'deleted', 'deactivated')),
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business', 'enterprise')),
    is_paused BOOLEAN DEFAULT 0,
    name_servers TEXT DEFAULT '[]',
    original_name_servers TEXT DEFAULT '[]',
    cloudflare_api_token TEXT NOT NULL,
    permissions TEXT DEFAULT '{"read":true,"edit":true,"zone_settings":true,"dns":false,"ssl":true,"cache":false,"analytics":true}',
    settings_cache TEXT DEFAULT '{}',
    last_sync DATETIME,
    sync_status TEXT DEFAULT 'never' CHECK (sync_status IN ('success', 'error', 'pending', 'never')),
    sync_error TEXT,
    auto_sync BOOLEAN DEFAULT 1,
    notification_settings TEXT DEFAULT '{"security_changes":true,"ssl_expiry":true,"downtime_alerts":false,"weekly_reports":true}',
    analytics_retention INTEGER DEFAULT 30,
    tags TEXT DEFAULT '[]',
    notes TEXT,
    is_favorite BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Security configurations table
CREATE TABLE IF NOT EXISTS security_configs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    zone_id TEXT NOT NULL,
    
    -- Security Level Settings
    security_level TEXT DEFAULT 'medium' CHECK (security_level IN ('off', 'essentially_off', 'low', 'medium', 'high', 'under_attack')),
    
    -- SSL/TLS Settings
    ssl_mode TEXT DEFAULT 'full' CHECK (ssl_mode IN ('off', 'flexible', 'full', 'strict')),
    always_use_https BOOLEAN DEFAULT 1,
    min_tls_version TEXT DEFAULT '1.2' CHECK (min_tls_version IN ('1.0', '1.1', '1.2', '1.3')),
    opportunistic_encryption BOOLEAN DEFAULT 1,
    tls_1_3 TEXT DEFAULT 'on' CHECK (tls_1_3 IN ('off', 'on', 'zrt')),
    automatic_https_rewrites BOOLEAN DEFAULT 1,
    
    -- Bot Protection
    bot_fight_mode BOOLEAN DEFAULT 0,
    super_bot_fight_mode BOOLEAN DEFAULT 0,
    
    -- Browser & Challenge Settings
    browser_integrity_check BOOLEAN DEFAULT 1,
    challenge_ttl INTEGER DEFAULT 1800,
    privacy_pass BOOLEAN DEFAULT 1,
    
    -- Security Headers
    security_headers TEXT DEFAULT '{"hsts":{"enabled":true,"max_age":31536000,"include_subdomains":true,"preload":false},"x_frame_options":"DENY","x_content_type_options":"nosniff","x_xss_protection":"1; mode=block","referrer_policy":"strict-origin-when-cross-origin"}',
    
    -- DDoS Protection
    ddos_protection TEXT DEFAULT '{"enabled":true,"sensitivity":"medium","unmetered_mitigation":false}',
    
    -- Rate Limiting
    rate_limiting TEXT DEFAULT '{"enabled":false,"rules":[]}',
    
    -- WAF Settings
    waf TEXT DEFAULT '{"enabled":true,"managed_rules":{"cloudflare_managed":true,"cloudflare_specials":true,"owasp_core":false},"custom_rules":[]}',
    
    -- IP Access Rules
    ip_access_rules TEXT DEFAULT '{"whitelist":[],"blacklist":[],"challenge":[]}',
    
    -- Country Access Rules
    country_access_rules TEXT DEFAULT '{"whitelist":[],"blacklist":[],"challenge":[]}',
    
    -- Firewall Rules
    firewall_rules TEXT DEFAULT '{"enabled":true,"rules":[]}',
    
    -- Scrape Shield
    scrape_shield TEXT DEFAULT '{"email_obfuscation":true,"server_side_excludes":true,"hotlink_protection":false}',
    
    -- Development Mode
    development_mode BOOLEAN DEFAULT 0,
    development_mode_expires DATETIME,
    
    -- Backup Configuration
    backup_config TEXT DEFAULT '{}',
    
    -- Metadata
    last_modified_by TEXT,
    last_cloudflare_sync DATETIME,
    config_version INTEGER DEFAULT 1,
    is_template BOOLEAN DEFAULT 0,
    template_name TEXT,
    notes TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE,
    FOREIGN KEY (last_modified_by) REFERENCES users(id)
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT,
    zone_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('user', 'zone', 'security_config', 'ssl_setting', 'firewall_rule', 'dns_record', 'page_rule', 'rate_limit', 'bot_management', 'api_token')),
    resource_id TEXT,
    description TEXT NOT NULL,
    old_values TEXT,
    new_values TEXT,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
    error_message TEXT,
    severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    category TEXT DEFAULT 'configuration' CHECK (category IN ('authentication', 'authorization', 'configuration', 'security', 'data_access', 'system', 'api')),
    metadata TEXT DEFAULT '{}',
    session_id TEXT,
    correlation_id TEXT,
    duration_ms INTEGER,
    cloudflare_response TEXT,
    tags TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (zone_id) REFERENCES zones(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token);

CREATE INDEX IF NOT EXISTS idx_zones_user_id ON zones(user_id);
CREATE INDEX IF NOT EXISTS idx_zones_cloudflare_zone_id ON zones(cloudflare_zone_id);
CREATE INDEX IF NOT EXISTS idx_zones_status ON zones(status);
CREATE INDEX IF NOT EXISTS idx_zones_plan ON zones(plan);
CREATE INDEX IF NOT EXISTS idx_zones_is_favorite ON zones(is_favorite);
CREATE INDEX IF NOT EXISTS idx_zones_last_sync ON zones(last_sync);
CREATE INDEX IF NOT EXISTS idx_zones_sync_status ON zones(sync_status);

CREATE INDEX IF NOT EXISTS idx_security_configs_zone_id ON security_configs(zone_id);
CREATE INDEX IF NOT EXISTS idx_security_configs_security_level ON security_configs(security_level);
CREATE INDEX IF NOT EXISTS idx_security_configs_ssl_mode ON security_configs(ssl_mode);
CREATE INDEX IF NOT EXISTS idx_security_configs_is_template ON security_configs(is_template);
CREATE INDEX IF NOT EXISTS idx_security_configs_last_sync ON security_configs(last_cloudflare_sync);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_zone_id ON audit_logs(zone_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id ON audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_zone_action_created ON audit_logs(zone_id, action, created_at);

-- Insert default admin user (password: admin123)
INSERT OR IGNORE INTO users (
    id, email, password, name, role, is_active, is_verified
) VALUES (
    'admin-user-id-123456789012',
    'admin@cloudflare-manager.local',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewNcMnY9D5o.RHBW',
    'System Administrator',
    'admin',
    1,
    1
);

-- Insert security templates
INSERT OR IGNORE INTO security_configs (
    id, zone_id, security_level, ssl_mode, always_use_https, bot_fight_mode, 
    browser_integrity_check, challenge_ttl, is_template, template_name, notes
) VALUES 
(
    'template-basic-protection',
    NULL,
    'medium',
    'full', 
    1,
    1,
    1,
    1800,
    1,
    'Basic Protection',
    'Recommended security settings for most websites'
),
(
    'template-high-security',
    NULL,
    'high',
    'strict',
    1,
    1,
    1,
    900,
    1,
    'High Security',
    'Maximum protection for sensitive websites and applications'
),
(
    'template-development',
    NULL,
    'low',
    'flexible',
    0,
    0,
    0,
    3600,
    1,
    'Development Mode',
    'Relaxed settings for development and testing environments'
);

-- Update timestamps trigger for users
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update timestamps trigger for zones
CREATE TRIGGER IF NOT EXISTS update_zones_timestamp 
    AFTER UPDATE ON zones
    FOR EACH ROW
BEGIN
    UPDATE zones SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update timestamps trigger for security_configs
CREATE TRIGGER IF NOT EXISTS update_security_configs_timestamp 
    AFTER UPDATE ON security_configs
    FOR EACH ROW
BEGIN
    UPDATE security_configs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;