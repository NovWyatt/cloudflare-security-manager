import React, { useState, useEffect } from 'react';

// Profile Settings Component
const ProfileSettings = ({ user, onUpdate }) => {
    const [formData, setFormData] = useState({
        username: user?.username || '',
        email: user?.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    const validateForm = () => {
        const newErrors = {};

        if (!formData.username.trim()) {
            newErrors.username = 'Username is required';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Email is invalid';
        }

        if (formData.newPassword) {
            if (!formData.currentPassword) {
                newErrors.currentPassword = 'Current password is required to change password';
            }

            if (formData.newPassword.length < 8) {
                newErrors.newPassword = 'New password must be at least 8 characters';
            }

            if (formData.newPassword !== formData.confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setSaving(true);

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            onUpdate({
                username: formData.username,
                email: formData.email
            });

            // Reset password fields
            setFormData(prev => ({
                ...prev,
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            }));

            setErrors({});
            alert('Profile updated successfully!');
        } catch (error) {
            alert('Failed to update profile. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Profile Settings</h3>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Username *
                        </label>
                        <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.username ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                                }`}
                            placeholder="Enter your username"
                        />
                        {errors.username && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.username}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Email Address *
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.email ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                                }`}
                            placeholder="Enter your email"
                        />
                        {errors.email && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.email}</p>}
                    </div>
                </div>

                <hr className="border-gray-200 dark:border-gray-600" />

                <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Change Password</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Leave password fields empty if you don't want to change your password.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Current Password
                    </label>
                    <input
                        type="password"
                        value={formData.currentPassword}
                        onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.currentPassword ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                            }`}
                        placeholder="Enter current password"
                    />
                    {errors.currentPassword && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.currentPassword}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            New Password
                        </label>
                        <input
                            type="password"
                            value={formData.newPassword}
                            onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.newPassword ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                                }`}
                            placeholder="Enter new password"
                        />
                        {errors.newPassword && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.newPassword}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Confirm New Password
                        </label>
                        <input
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.confirmPassword ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                                }`}
                            placeholder="Confirm new password"
                        />
                        {errors.confirmPassword && <p className="text-red-600 dark:text-red-400 text-sm mt-1">{errors.confirmPassword}</p>}
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? (
                            <div className="flex items-center">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                Saving...
                            </div>
                        ) : 'Update Profile'}
                    </button>
                </div>
            </form>
        </div>
    );
};

// Notification Settings Component
const NotificationSettings = ({ settings, onUpdate }) => {
    const [notificationSettings, setNotificationSettings] = useState({
        emailNotifications: settings?.emailNotifications ?? true,
        securityAlerts: settings?.securityAlerts ?? true,
        dailyReports: settings?.dailyReports ?? false,
        sslExpiry: settings?.sslExpiry ?? true,
        underAttackMode: settings?.underAttackMode ?? true,
        firewallEvents: settings?.firewallEvents ?? true,
        quietHours: settings?.quietHours ?? false,
        quietStart: settings?.quietStart ?? '22:00',
        quietEnd: settings?.quietEnd ?? '08:00',
        webhookUrl: settings?.webhookUrl ?? '',
        slackWebhook: settings?.slackWebhook ?? '',
        discordWebhook: settings?.discordWebhook ?? ''
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            onUpdate(notificationSettings);
            alert('Notification settings saved successfully!');
        } catch (error) {
            alert('Failed to save notification settings.');
        } finally {
            setSaving(false);
        }
    };

    const ToggleSwitch = ({ checked, onChange, disabled = false }) => (
        <label className="relative inline-flex items-center cursor-pointer">
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
        </label>
    );

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Notification Settings</h3>

            <div className="space-y-8">
                {/* Email Notifications */}
                <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Email Notifications</h4>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h5 className="text-sm font-medium text-gray-900 dark:text-white">Master Email Switch</h5>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Enable or disable all email notifications</p>
                            </div>
                            <ToggleSwitch
                                checked={notificationSettings.emailNotifications}
                                onChange={(e) => setNotificationSettings({ ...notificationSettings, emailNotifications: e.target.checked })}
                            />
                        </div>

                        <div className="ml-4 space-y-4 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h5 className="text-sm font-medium text-gray-900 dark:text-white">Security Alerts</h5>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Get notified about security events and threats</p>
                                </div>
                                <ToggleSwitch
                                    checked={notificationSettings.securityAlerts}
                                    onChange={(e) => setNotificationSettings({ ...notificationSettings, securityAlerts: e.target.checked })}
                                    disabled={!notificationSettings.emailNotifications}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h5 className="text-sm font-medium text-gray-900 dark:text-white">Daily Reports</h5>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Receive daily analytics summaries</p>
                                </div>
                                <ToggleSwitch
                                    checked={notificationSettings.dailyReports}
                                    onChange={(e) => setNotificationSettings({ ...notificationSettings, dailyReports: e.target.checked })}
                                    disabled={!notificationSettings.emailNotifications}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h5 className="text-sm font-medium text-gray-900 dark:text-white">SSL Certificate Expiry</h5>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Alerts when SSL certificates are expiring</p>
                                </div>
                                <ToggleSwitch
                                    checked={notificationSettings.sslExpiry}
                                    onChange={(e) => setNotificationSettings({ ...notificationSettings, sslExpiry: e.target.checked })}
                                    disabled={!notificationSettings.emailNotifications}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h5 className="text-sm font-medium text-gray-900 dark:text-white">Under Attack Mode</h5>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Notifications when Under Attack Mode is toggled</p>
                                </div>
                                <ToggleSwitch
                                    checked={notificationSettings.underAttackMode}
                                    onChange={(e) => setNotificationSettings({ ...notificationSettings, underAttackMode: e.target.checked })}
                                    disabled={!notificationSettings.emailNotifications}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h5 className="text-sm font-medium text-gray-900 dark:text-white">Firewall Events</h5>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Notifications when firewall rules are triggered</p>
                                </div>
                                <ToggleSwitch
                                    checked={notificationSettings.firewallEvents}
                                    onChange={(e) => setNotificationSettings({ ...notificationSettings, firewallEvents: e.target.checked })}
                                    disabled={!notificationSettings.emailNotifications}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <hr className="border-gray-200 dark:border-gray-600" />

                {/* Quiet Hours */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h4 className="text-md font-medium text-gray-900 dark:text-white">Quiet Hours</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Disable non-critical notifications during specified hours</p>
                        </div>
                        <ToggleSwitch
                            checked={notificationSettings.quietHours}
                            onChange={(e) => setNotificationSettings({ ...notificationSettings, quietHours: e.target.checked })}
                        />
                    </div>

                    {notificationSettings.quietHours && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Start Time
                                </label>
                                <input
                                    type="time"
                                    value={notificationSettings.quietStart}
                                    onChange={(e) => setNotificationSettings({ ...notificationSettings, quietStart: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    End Time
                                </label>
                                <input
                                    type="time"
                                    value={notificationSettings.quietEnd}
                                    onChange={(e) => setNotificationSettings({ ...notificationSettings, quietEnd: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                            </div>
                        </div>
                    )}
                </div>

                <hr className="border-gray-200 dark:border-gray-600" />

                {/* Webhook Integrations */}
                <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Webhook Integrations</h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Custom Webhook URL
                            </label>
                            <input
                                type="url"
                                value={notificationSettings.webhookUrl}
                                onChange={(e) => setNotificationSettings({ ...notificationSettings, webhookUrl: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="https://your-webhook-url.com/webhook"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Send notifications to your custom webhook endpoint
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Slack Webhook URL
                            </label>
                            <input
                                type="url"
                                value={notificationSettings.slackWebhook}
                                onChange={(e) => setNotificationSettings({ ...notificationSettings, slackWebhook: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="https://hooks.slack.com/services/..."
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Send notifications to your Slack channel
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Discord Webhook URL
                            </label>
                            <input
                                type="url"
                                value={notificationSettings.discordWebhook}
                                onChange={(e) => setNotificationSettings({ ...notificationSettings, discordWebhook: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                placeholder="https://discord.com/api/webhooks/..."
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Send notifications to your Discord server
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? (
                            <div className="flex items-center">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                Saving...
                            </div>
                        ) : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// API Keys Management Component
const ApiKeysManagement = () => {
    const [apiKeys, setApiKeys] = useState([
        {
            id: 1,
            name: 'Production API',
            keyPrefix: 'cfsmgr_live_',
            permissions: ['read', 'write'],
            created: '2024-01-15',
            lastUsed: '2024-02-10',
            status: 'active',
            expiresAt: '2024-12-31'
        },
        {
            id: 2,
            name: 'Development API',
            keyPrefix: 'cfsmgr_test_',
            permissions: ['read'],
            created: '2024-02-01',
            lastUsed: '2024-02-09',
            status: 'active',
            expiresAt: '2024-06-30'
        }
    ]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newKey, setNewKey] = useState({
        name: '',
        permissions: ['read'],
        expiresAt: ''
    });

    const permissions = [
        { value: 'read', label: 'Read Only', description: 'View zones and settings' },
        { value: 'write', label: 'Read & Write', description: 'Modify zones and settings' },
        { value: 'admin', label: 'Administrator', description: 'Full access including user management' }
    ];

    const handleCreateKey = async () => {
        if (!newKey.name.trim()) return;

        const generatedKey = {
            id: Date.now(),
            name: newKey.name,
            keyPrefix: 'cfsmgr_live_',
            permissions: newKey.permissions,
            created: new Date().toISOString().split('T')[0],
            lastUsed: 'Never',
            status: 'active',
            expiresAt: newKey.expiresAt || null
        };

        setApiKeys([...apiKeys, generatedKey]);
        setNewKey({ name: '', permissions: ['read'], expiresAt: '' });
        setShowCreateForm(false);

        // Show generated key (mock)
        const fullKey = `cfsmgr_live_${Math.random().toString(36).substr(2, 32)}`;
        alert(`API Key created successfully!\n\nKey: ${fullKey}\n\n⚠️ Please save this key securely. You won't be able to see it again.`);
    };

    const handleDeleteKey = (keyId) => {
        if (confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
            setApiKeys(apiKeys.filter(key => key.id !== keyId));
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200';
            case 'inactive': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200';
            case 'expired': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200';
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">API Keys</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Manage API keys for external integrations and automation
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                    + Create New Key
                </button>
            </div>

            {/* Create API Key Form */}
            {showCreateForm && (
                <div className="mb-6 p-6 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-4">Create New API Key</h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Key Name *
                            </label>
                            <input
                                type="text"
                                value={newKey.name}
                                onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                                placeholder="Enter a descriptive name for this key"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Permissions
                            </label>
                            <div className="space-y-2">
                                {permissions.map((permission) => (
                                    <label key={permission.value} className="flex items-start">
                                        <input
                                            type="checkbox"
                                            checked={newKey.permissions.includes(permission.value)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setNewKey({ ...newKey, permissions: [...newKey.permissions, permission.value] });
                                                } else {
                                                    setNewKey({ ...newKey, permissions: newKey.permissions.filter(p => p !== permission.value) });
                                                }
                                            }}
                                            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded"
                                        />
                                        <div className="ml-3">
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">{permission.label}</span>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">{permission.description}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Expiration Date (Optional)
                            </label>
                            <input
                                type="date"
                                value={newKey.expiresAt}
                                onChange={(e) => setNewKey({ ...newKey, expiresAt: e.target.value })}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Leave empty for no expiration
                            </p>
                        </div>

                        <div className="flex space-x-3 pt-4">
                            <button
                                onClick={handleCreateKey}
                                disabled={!newKey.name.trim() || newKey.permissions.length === 0}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Create API Key
                            </button>
                            <button
                                onClick={() => setShowCreateForm(false)}
                                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* API Keys List */}
            <div className="space-y-4">
                {apiKeys.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-4xl mb-3">🔑</div>
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No API keys</h4>
                        <p className="text-gray-600 dark:text-gray-400">Create your first API key to get started with integrations.</p>
                    </div>
                ) : (
                    apiKeys.map((key) => (
                        <div key={key.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                        <h4 className="font-medium text-gray-900 dark:text-white">{key.name}</h4>
                                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(key.status)}`}>
                                            {key.status}
                                        </span>
                                    </div>

                                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                        <div className="flex items-center space-x-4">
                                            <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                                {key.keyPrefix}••••••••
                                            </span>
                                            <span>Created: {key.created}</span>
                                            <span>Last used: {key.lastUsed}</span>
                                        </div>

                                        <div className="flex items-center space-x-4">
                                            <span>Permissions: {key.permissions.join(', ')}</span>
                                            {key.expiresAt && (
                                                <span className={new Date(key.expiresAt) < new Date() ? 'text-red-600' : ''}>
                                                    Expires: {key.expiresAt}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => {/* Handle edit */ }}
                                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                        title="Edit API key"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => handleDeleteKey(key.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Delete API key"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

// Backup Settings Component
const BackupSettings = () => {
    const [backupSettings, setBackupSettings] = useState({
        autoBackup: true,
        backupFrequency: 'daily',
        retentionDays: 30,
        includeSecrets: false,
        backupTime: '02:00'
    });
    const [saving, setSaving] = useState(false);
    const [backupHistory, setBackupHistory] = useState([
        {
            id: 1,
            type: 'automatic',
            created: '2024-02-10 02:00:00',
            size: '2.4 MB',
            zones: 3,
            status: 'completed'
        },
        {
            id: 2,
            type: 'manual',
            created: '2024-02-09 14:30:00',
            size: '2.1 MB',
            zones: 2,
            status: 'completed'
        },
        {
            id: 3,
            type: 'automatic',
            created: '2024-02-09 02:00:00',
            size: '2.3 MB',
            zones: 3,
            status: 'completed'
        }
    ]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            alert('Backup settings saved successfully!');
        } catch (error) {
            alert('Failed to save backup settings.');
        } finally {
            setSaving(false);
        }
    };

    const handleManualBackup = async () => {
        try {
            // Show loading state
            const newBackup = {
                id: Date.now(),
                type: 'manual',
                created: new Date().toISOString().replace('T', ' ').slice(0, 19),
                size: '2.5 MB',
                zones: 3,
                status: 'in_progress'
            };

            setBackupHistory([newBackup, ...backupHistory]);

            // Simulate backup process
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Update status to completed
            setBackupHistory(prev => prev.map(backup =>
                backup.id === newBackup.id
                    ? { ...backup, status: 'completed' }
                    : backup
            ));

            alert('Manual backup created successfully!');
        } catch (error) {
            alert('Failed to create backup.');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200';
            case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200';
            case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-200';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'completed': return '✅';
            case 'in_progress': return '⏳';
            case 'failed': return '❌';
            default: return '⚪';
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Backup Settings</h3>

            <div className="space-y-8">
                {/* Backup Configuration */}
                <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Backup Configuration</h4>
                    <div className="space-y-6">
                        {/* Auto Backup */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h5 className="text-sm font-medium text-gray-900 dark:text-white">Automatic Backups</h5>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Automatically backup your configurations</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={backupSettings.autoBackup}
                                    onChange={(e) => setBackupSettings({ ...backupSettings, autoBackup: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        {/* Backup Frequency */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Backup Frequency
                                </label>
                                <select
                                    value={backupSettings.backupFrequency}
                                    onChange={(e) => setBackupSettings({ ...backupSettings, backupFrequency: e.target.value })}
                                    disabled={!backupSettings.autoBackup}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                                >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Backup Time
                                </label>
                                <input
                                    type="time"
                                    value={backupSettings.backupTime}
                                    onChange={(e) => setBackupSettings({ ...backupSettings, backupTime: e.target.value })}
                                    disabled={!backupSettings.autoBackup}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {/* Retention Days */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Retention Period (Days)
                            </label>
                            <select
                                value={backupSettings.retentionDays}
                                onChange={(e) => setBackupSettings({ ...backupSettings, retentionDays: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value={7}>7 days</option>
                                <option value={14}>14 days</option>
                                <option value={30}>30 days</option>
                                <option value={60}>60 days</option>
                                <option value={90}>90 days</option>
                                <option value={365}>1 year</option>
                            </select>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Backups older than this will be automatically deleted
                            </p>
                        </div>

                        {/* Include Secrets */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h5 className="text-sm font-medium text-gray-900 dark:text-white">Include Sensitive Data</h5>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Include API tokens and other sensitive information in backups</p>
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">⚠️ Warning: This will include sensitive data in backup files</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={backupSettings.includeSecrets}
                                    onChange={(e) => setBackupSettings({ ...backupSettings, includeSecrets: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>
                </div>

                <hr className="border-gray-200 dark:border-gray-600" />

                {/* Action Buttons */}
                <div className="flex space-x-4">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? (
                            <div className="flex items-center">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                Saving...
                            </div>
                        ) : 'Save Settings'}
                    </button>

                    <button
                        onClick={handleManualBackup}
                        className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                    >
                        💾 Create Manual Backup
                    </button>
                </div>

                <hr className="border-gray-200 dark:border-gray-600" />

                {/* Backup History */}
                <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Recent Backups</h4>
                    <div className="space-y-3">
                        {backupHistory.map((backup) => (
                            <div key={backup.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                                <div className="flex items-center space-x-4">
                                    <span className="text-lg">{getStatusIcon(backup.status)}</span>
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {backup.type.charAt(0).toUpperCase() + backup.type.slice(1)} Backup
                                            </span>
                                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(backup.status)}`}>
                                                {backup.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">
                                            {backup.created} • {backup.size} • {backup.zones} zones
                                        </div>
                                    </div>
                                </div>

                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => alert('Download functionality would be implemented here')}
                                        disabled={backup.status !== 'completed'}
                                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        📥 Download
                                    </button>
                                    <button
                                        onClick={() => alert('Restore functionality would be implemented here')}
                                        disabled={backup.status !== 'completed'}
                                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        🔄 Restore
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Security Settings Component
const SecuritySettings = () => {
    const [securitySettings, setSecuritySettings] = useState({
        twoFactorAuth: false,
        sessionTimeout: 86400, // 24 hours in seconds
        loginNotifications: true,
        passwordPolicy: 'strong',
        allowedIPs: '',
        sessionManagement: true
    });
    const [saving, setSaving] = useState(false);

    const sessionTimeouts = [
        { value: 3600, label: '1 hour' },
        { value: 7200, label: '2 hours' },
        { value: 14400, label: '4 hours' },
        { value: 28800, label: '8 hours' },
        { value: 86400, label: '24 hours' },
        { value: 604800, label: '7 days' }
    ];

    const passwordPolicies = [
        { value: 'basic', label: 'Basic', description: 'Minimum 6 characters' },
        { value: 'strong', label: 'Strong', description: 'Minimum 8 characters, mixed case, numbers' },
        { value: 'very_strong', label: 'Very Strong', description: 'Minimum 12 characters, mixed case, numbers, symbols' }
    ];

    const handleSave = async () => {
        setSaving(true);
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            alert('Security settings saved successfully!');
        } catch (error) {
            alert('Failed to save security settings.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Security Settings</h3>

            <div className="space-y-8">
                {/* Two-Factor Authentication */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h4 className="text-md font-medium text-gray-900 dark:text-white">Two-Factor Authentication</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Add an extra layer of security to your account</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={securitySettings.twoFactorAuth}
                                onChange={(e) => setSecuritySettings({ ...securitySettings, twoFactorAuth: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    {securitySettings.twoFactorAuth && (
                        <div className="ml-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                                📱 Two-factor authentication is enabled. Use your authenticator app to generate codes.
                            </p>
                            <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                                View Recovery Codes
                            </button>
                        </div>
                    )}
                </div>

                {/* Session Management */}
                <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Session Management</h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Session Timeout
                            </label>
                            <select
                                value={securitySettings.sessionTimeout}
                                onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                {sessionTimeouts.map(timeout => (
                                    <option key={timeout.value} value={timeout.value}>
                                        {timeout.label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Automatically log out after this period of inactivity
                            </p>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <h5 className="text-sm font-medium text-gray-900 dark:text-white">Login Notifications</h5>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Get notified of new login sessions</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={securitySettings.loginNotifications}
                                    onChange={(e) => setSecuritySettings({ ...securitySettings, loginNotifications: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Password Policy */}
                <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">Password Policy</h4>
                    <div className="space-y-3">
                        {passwordPolicies.map((policy) => (
                            <label key={policy.value} className="flex items-start p-3 border border-gray-200 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                                <input
                                    type="radio"
                                    name="passwordPolicy"
                                    value={policy.value}
                                    checked={securitySettings.passwordPolicy === policy.value}
                                    onChange={(e) => setSecuritySettings({ ...securitySettings, passwordPolicy: e.target.value })}
                                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 mt-0.5"
                                />
                                <div className="ml-3">
                                    <span className="font-medium text-gray-900 dark:text-white">{policy.label}</span>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{policy.description}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* IP Restrictions */}
                <div>
                    <h4 className="text-md font-medium text-gray-900 dark:text-white mb-4">IP Access Control</h4>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Allowed IP Addresses (Optional)
                        </label>
                        <textarea
                            value={securitySettings.allowedIPs}
                            onChange={(e) => setSecuritySettings({ ...securitySettings, allowedIPs: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="192.168.1.1&#10;10.0.0.0/8&#10;172.16.0.0/12"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            One IP address or CIDR block per line. Leave empty to allow all IPs.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? (
                            <div className="flex items-center">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                Saving...
                            </div>
                        ) : 'Save Security Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Main Settings Page Component
const SettingsPage = () => {
    const [activeTab, setActiveTab] = useState('profile');
    const [user, setUser] = useState({
        username: 'john_doe',
        email: 'john@example.com'
    });
    const [notificationSettings, setNotificationSettings] = useState({});

    const tabs = [
        { id: 'profile', name: 'Profile', icon: '👤', description: 'Personal information and password' },
        { id: 'notifications', name: 'Notifications', icon: '🔔', description: 'Email and webhook preferences' },
        { id: 'security', name: 'Security', icon: '🔒', description: '2FA and access control' },
        { id: 'api', name: 'API Keys', icon: '🔑', description: 'Manage integration keys' },
        { id: 'backup', name: 'Backup', icon: '💾', description: 'Backup and restore settings' }
    ];

    const handleUserUpdate = (userData) => {
        setUser(prev => ({ ...prev, ...userData }));
    };

    const handleNotificationUpdate = (settings) => {
        setNotificationSettings(settings);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Manage your account preferences and application settings
                </p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === tab.id
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                        >
                            <div className="flex items-center space-x-2">
                                <span className="text-lg">{tab.icon}</span>
                                <div className="text-left">
                                    <div>{tab.name}</div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500 font-normal hidden sm:block">
                                        {tab.description}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[600px]">
                {activeTab === 'profile' && (
                    <ProfileSettings user={user} onUpdate={handleUserUpdate} />
                )}

                {activeTab === 'notifications' && (
                    <NotificationSettings
                        settings={notificationSettings}
                        onUpdate={handleNotificationUpdate}
                    />
                )}

                {activeTab === 'security' && (
                    <SecuritySettings />
                )}

                {activeTab === 'api' && (
                    <ApiKeysManagement />
                )}

                {activeTab === 'backup' && (
                    <BackupSettings />
                )}
            </div>
        </div>
    );
};

export default SettingsPage;