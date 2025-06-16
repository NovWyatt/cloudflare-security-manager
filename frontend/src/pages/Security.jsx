import React, { useState, useEffect } from 'react';

// Security Level Component
const SecurityLevel = ({ level, onLevelChange, loading }) => {
    const levels = [
        {
            value: 'off',
            label: 'Off',
            description: 'No security measures applied',
            color: 'text-gray-600',
            bgColor: 'bg-gray-100 dark:bg-gray-700'
        },
        {
            value: 'essentially_off',
            label: 'Essentially Off',
            description: 'Very low security',
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-100 dark:bg-yellow-900/50'
        },
        {
            value: 'low',
            label: 'Low',
            description: 'Minimal protection',
            color: 'text-blue-600',
            bgColor: 'bg-blue-100 dark:bg-blue-900/50'
        },
        {
            value: 'medium',
            label: 'Medium',
            description: 'Standard protection',
            color: 'text-green-600',
            bgColor: 'bg-green-100 dark:bg-green-900/50'
        },
        {
            value: 'high',
            label: 'High',
            description: 'Enhanced protection',
            color: 'text-orange-600',
            bgColor: 'bg-orange-100 dark:bg-orange-900/50'
        },
        {
            value: 'under_attack',
            label: 'Under Attack',
            description: 'Maximum protection (I\'m Under Attack Mode)',
            color: 'text-red-600',
            bgColor: 'bg-red-100 dark:bg-red-900/50'
        }
    ];

    const currentLevel = levels.find(l => l.value === level) || levels[2];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Security Level</h3>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${currentLevel.bgColor} ${currentLevel.color}`}>
                    {currentLevel.label}
                </div>
            </div>

            <p className="text-gray-600 dark:text-gray-400 mb-6">{currentLevel.description}</p>

            <div className="space-y-3">
                {levels.map((levelOption) => (
                    <label key={levelOption.value} className="flex items-center p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                        <input
                            type="radio"
                            name="securityLevel"
                            value={levelOption.value}
                            checked={level === levelOption.value}
                            onChange={(e) => onLevelChange(e.target.value)}
                            disabled={loading}
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                        />
                        <div className="ml-3 flex-1">
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900 dark:text-white">{levelOption.label}</span>
                                <span className={`text-sm ${levelOption.color}`}>
                                    {levelOption.value === 'under_attack' && '🚨'}
                                    {levelOption.value === 'high' && '🛡️'}
                                    {levelOption.value === 'medium' && '⚖️'}
                                    {levelOption.value === 'low' && '🔓'}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{levelOption.description}</p>
                        </div>
                    </label>
                ))}
            </div>

            {level === 'under_attack' && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start">
                        <span className="text-red-500 text-lg mr-2">⚠️</span>
                        <div>
                            <h4 className="text-red-800 dark:text-red-200 font-medium">Under Attack Mode Active</h4>
                            <p className="text-red-700 dark:text-red-300 text-sm mt-1">
                                All visitors will see a challenge page. This may impact user experience but provides maximum DDoS protection.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// SSL Settings Component
const SSLSettings = ({ settings, onSettingsChange, loading }) => {
    const sslModes = [
        { value: 'off', label: 'Off', description: 'No SSL encryption' },
        { value: 'flexible', label: 'Flexible', description: 'Encrypts traffic between browser and Cloudflare' },
        { value: 'full', label: 'Full', description: 'Encrypts end-to-end, allows self-signed certificates on server' },
        { value: 'strict', label: 'Full (Strict)', description: 'Encrypts end-to-end, requires valid certificate on server' }
    ];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">SSL/TLS Settings</h3>

            <div className="space-y-6">
                {/* SSL Mode */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        SSL Mode
                    </label>
                    <select
                        value={settings.sslMode || 'flexible'}
                        onChange={(e) => onSettingsChange({ ...settings, sslMode: e.target.value })}
                        disabled={loading}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        {sslModes.map(mode => (
                            <option key={mode.value} value={mode.value}>
                                {mode.label} - {mode.description}
                            </option>
                        ))}
                    </select>
                </div>

                {/* HTTPS Rewrite */}
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Automatic HTTPS Rewrites</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Automatically rewrite HTTP links to HTTPS</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.httpsRewrite || false}
                            onChange={(e) => onSettingsChange({ ...settings, httpsRewrite: e.target.checked })}
                            disabled={loading}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {/* HSTS */}
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">HTTP Strict Transport Security (HSTS)</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Force browsers to use HTTPS</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.hsts || false}
                            onChange={(e) => onSettingsChange({ ...settings, hsts: e.target.checked })}
                            disabled={loading}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>
        </div>
    );
};

// Bot Protection Component
const BotProtection = ({ settings, onSettingsChange, loading }) => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bot Protection</h3>

            <div className="space-y-6">
                {/* Bot Fight Mode */}
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Bot Fight Mode</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Block bad bots and allow good bots</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.botFightMode || false}
                            onChange={(e) => onSettingsChange({ ...settings, botFightMode: e.target.checked })}
                            disabled={loading}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {/* Super Bot Fight Mode */}
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                            Super Bot Fight Mode
                            <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 rounded">Pro+</span>
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Advanced bot detection with machine learning</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.superBotFightMode || false}
                            onChange={(e) => onSettingsChange({ ...settings, superBotFightMode: e.target.checked })}
                            disabled={loading}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {/* Challenge Passage */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Challenge Passage Duration
                    </label>
                    <select
                        value={settings.challengePassage || 30}
                        onChange={(e) => onSettingsChange({ ...settings, challengePassage: parseInt(e.target.value) })}
                        disabled={loading}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value={5}>5 minutes</option>
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={60}>1 hour</option>
                        <option value={120}>2 hours</option>
                        <option value={1440}>24 hours</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        How long a visitor can browse your site after completing a challenge
                    </p>
                </div>
            </div>
        </div>
    );
};

// Firewall Rules Component
const FirewallRules = ({ rules, onRulesChange, loading }) => {
    const [showAddRule, setShowAddRule] = useState(false);
    const [newRule, setNewRule] = useState({
        expression: '',
        action: 'block',
        description: ''
    });

    const actions = [
        { value: 'block', label: 'Block', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/50' },
        { value: 'challenge', label: 'Challenge', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/50' },
        { value: 'js_challenge', label: 'JS Challenge', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/50' },
        { value: 'allow', label: 'Allow', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/50' },
        { value: 'bypass', label: 'Bypass', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/50' }
    ];

    const handleAddRule = () => {
        if (newRule.expression && newRule.action) {
            const ruleToAdd = {
                id: Date.now(),
                ...newRule,
                priority: rules.length + 1
            };
            onRulesChange([...rules, ruleToAdd]);
            setNewRule({ expression: '', action: 'block', description: '' });
            setShowAddRule(false);
        }
    };

    const handleDeleteRule = (ruleId) => {
        onRulesChange(rules.filter(rule => rule.id !== ruleId));
    };

    const getActionStyle = (action) => {
        const actionConfig = actions.find(a => a.value === action);
        return actionConfig ? `${actionConfig.color} ${actionConfig.bg}` : 'text-gray-600 bg-gray-100';
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Firewall Rules</h3>
                <button
                    onClick={() => setShowAddRule(true)}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                >
                    + Add Rule
                </button>
            </div>

            {/* Add Rule Form */}
            {showAddRule && (
                <div className="mb-6 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">Add New Firewall Rule</h4>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Expression
                            </label>
                            <input
                                type="text"
                                value={newRule.expression}
                                onChange={(e) => setNewRule({ ...newRule, expression: e.target.value })}
                                placeholder="e.g., (ip.src eq 192.168.1.1)"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Action
                            </label>
                            <select
                                value={newRule.action}
                                onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                                {actions.map(action => (
                                    <option key={action.value} value={action.value}>
                                        {action.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Description (Optional)
                            </label>
                            <input
                                type="text"
                                value={newRule.description}
                                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                                placeholder="Brief description of this rule"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                        </div>
                        <div className="flex space-x-3">
                            <button
                                onClick={handleAddRule}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 transition-colors"
                            >
                                Add Rule
                            </button>
                            <button
                                onClick={() => setShowAddRule(false)}
                                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rules List */}
            <div className="space-y-3">
                {rules.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-4xl mb-3">🛡️</div>
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No firewall rules</h4>
                        <p className="text-gray-600 dark:text-gray-400">Add your first firewall rule to enhance security.</p>
                    </div>
                ) : (
                    rules.map((rule, index) => (
                        <div key={rule.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">#{index + 1}</span>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActionStyle(rule.action)}`}>
                                            {rule.action.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="font-mono text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded mb-2">
                                        {rule.expression}
                                    </div>
                                    {rule.description && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{rule.description}</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDeleteRule(rule.id)}
                                    className="ml-4 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Delete rule"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// Zone Selector Component
const ZoneSelector = ({ zones, selectedZone, onZoneChange }) => {
    return (
        <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Zone
            </label>
            <select
                value={selectedZone?.id || ''}
                onChange={(e) => {
                    const zone = zones.find(z => z.id === e.target.value);
                    onZoneChange(zone);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
                <option value="">Select a zone...</option>
                {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                        {zone.name} ({zone.status})
                    </option>
                ))}
            </select>
        </div>
    );
};

// Main Security Page Component
const SecurityPage = () => {
    const [selectedZone, setSelectedZone] = useState(null);
    const [securityLevel, setSecurityLevel] = useState('medium');
    const [sslSettings, setSSLSettings] = useState({
        sslMode: 'flexible',
        httpsRewrite: false,
        hsts: false
    });
    const [botSettings, setBotSettings] = useState({
        botFightMode: false,
        superBotFightMode: false,
        challengePassage: 30
    });
    const [firewallRules, setFirewallRules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Mock zones data
    const zones = [
        { id: '1', name: 'example.com', status: 'active' },
        { id: '2', name: 'test.com', status: 'active' },
        { id: '3', name: 'demo.org', status: 'pending' }
    ];

    useEffect(() => {
        if (selectedZone) {
            loadSecuritySettings();
        }
    }, [selectedZone]);

    const loadSecuritySettings = async () => {
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Mock data
            setSecurityLevel('medium');
            setSSLSettings({
                sslMode: 'flexible',
                httpsRewrite: true,
                hsts: false
            });
            setBotSettings({
                botFightMode: true,
                superBotFightMode: false,
                challengePassage: 30
            });
            setFirewallRules([
                {
                    id: 1,
                    expression: '(ip.geoip.country eq "CN")',
                    action: 'block',
                    description: 'Block traffic from China',
                    priority: 1
                }
            ]);
        } catch (error) {
            console.error('Failed to load security settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        if (!selectedZone) return;

        setSaving(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Mock successful save
            console.log('Security settings saved:', {
                zone: selectedZone.name,
                securityLevel,
                sslSettings,
                botSettings,
                firewallRules
            });

            // Show success message
            alert('Security settings saved successfully!');
        } catch (error) {
            console.error('Failed to save security settings:', error);
            alert('Failed to save security settings. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Security Management</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Configure security settings for your Cloudflare zones
                    </p>
                </div>
                <button
                    onClick={handleSaveSettings}
                    disabled={!selectedZone || saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {/* Zone Selector */}
            <ZoneSelector
                zones={zones}
                selectedZone={selectedZone}
                onZoneChange={setSelectedZone}
            />

            {selectedZone ? (
                <>
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-gray-600 dark:text-gray-400">Loading security settings...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Security Level */}
                            <div className="lg:col-span-2">
                                <SecurityLevel
                                    level={securityLevel}
                                    onLevelChange={setSecurityLevel}
                                    loading={saving}
                                />
                            </div>

                            {/* SSL Settings */}
                            <SSLSettings
                                settings={sslSettings}
                                onSettingsChange={setSSLSettings}
                                loading={saving}
                            />

                            {/* Bot Protection */}
                            <BotProtection
                                settings={botSettings}
                                onSettingsChange={setBotSettings}
                                loading={saving}
                            />

                            {/* Firewall Rules */}
                            <div className="lg:col-span-2">
                                <FirewallRules
                                    rules={firewallRules}
                                    onRulesChange={setFirewallRules}
                                    loading={saving}
                                />
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-12">
                    <div className="text-6xl mb-4">🛡️</div>
                    <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">Select a Zone</h3>
                    <p className="text-gray-600 dark:text-gray-400">
                        Choose a zone from the dropdown above to manage its security settings.
                    </p>
                </div>
            )}
        </div>
    );
};

export default SecurityPage;