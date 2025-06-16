import React, { useState, useEffect } from 'react';

// Time Range Selector Component
const TimeRangeSelector = ({ selectedRange, onRangeChange }) => {
    const ranges = [
        { value: '1h', label: 'Last Hour' },
        { value: '6h', label: 'Last 6 Hours' },
        { value: '24h', label: 'Last 24 Hours' },
        { value: '7d', label: 'Last 7 Days' },
        { value: '30d', label: 'Last 30 Days' }
    ];

    return (
        <div className="flex space-x-2">
            {ranges.map(range => (
                <button
                    key={range.value}
                    onClick={() => onRangeChange(range.value)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${selectedRange === range.value
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                >
                    {range.label}
                </button>
            ))}
        </div>
    );
};

// Metric Card Component
const MetricCard = ({ title, value, change, changeType, icon, color }) => {
    const getChangeColor = () => {
        if (changeType === 'positive') return 'text-green-600';
        if (changeType === 'negative') return 'text-red-600';
        return 'text-gray-600';
    };

    const getChangeIcon = () => {
        if (changeType === 'positive') return '↗️';
        if (changeType === 'negative') return '↘️';
        return '➡️';
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
                    {change && (
                        <p className={`text-sm mt-1 ${getChangeColor()}`}>
                            <span className="mr-1">{getChangeIcon()}</span>
                            {change}
                        </p>
                    )}
                </div>
                <div className={`p-3 rounded-lg ${color}`}>
                    <span className="text-2xl">{icon}</span>
                </div>
            </div>
        </div>
    );
};

// Simple Chart Component (using CSS for visualization)
const SimpleLineChart = ({ data, title, color = 'blue' }) => {
    const maxValue = Math.max(...data.map(d => d.value));
    const minValue = Math.min(...data.map(d => d.value));
    const range = maxValue - minValue || 1;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
            <div className="relative h-64">
                <div className="absolute inset-0 flex items-end justify-between space-x-1">
                    {data.map((point, index) => {
                        const height = ((point.value - minValue) / range) * 100;
                        return (
                            <div key={index} className="flex-1 flex flex-col items-center">
                                <div
                                    className={`w-full bg-${color}-500 rounded-t transition-all duration-300 hover:bg-${color}-600`}
                                    style={{ height: `${Math.max(height, 5)}%` }}
                                    title={`${point.label}: ${point.value.toLocaleString()}`}
                                ></div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 mt-2 transform -rotate-45 origin-left">
                                    {point.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// Traffic Analytics Component
const TrafficAnalytics = ({ data, timeRange }) => {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SimpleLineChart
                data={data.requests}
                title="Requests Over Time"
                color="blue"
            />
            <SimpleLineChart
                data={data.bandwidth}
                title="Bandwidth Usage"
                color="green"
            />
        </div>
    );
};

// Security Analytics Component
const SecurityAnalytics = ({ data }) => {
    const threatsByType = [
        { type: 'Bot Traffic', count: 1250, percentage: 45, color: 'bg-red-500' },
        { type: 'Malicious IPs', count: 850, percentage: 30, color: 'bg-orange-500' },
        { type: 'SQL Injection', count: 420, percentage: 15, color: 'bg-yellow-500' },
        { type: 'XSS Attempts', count: 280, percentage: 10, color: 'bg-purple-500' }
    ];

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Threat Breakdown</h3>
            <div className="space-y-4">
                {threatsByType.map((threat, index) => (
                    <div key={index} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className={`w-4 h-4 rounded ${threat.color}`}></div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{threat.type}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                            <span className="text-sm text-gray-600 dark:text-gray-400">{threat.count.toLocaleString()}</span>
                            <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${threat.color} transition-all duration-300`}
                                    style={{ width: `${threat.percentage}%` }}
                                ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white w-8">{threat.percentage}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Top Countries Component
const TopCountries = ({ data }) => {
    const countries = [
        { name: 'United States', code: 'US', requests: 45320, flag: '🇺🇸' },
        { name: 'Germany', code: 'DE', requests: 23150, flag: '🇩🇪' },
        { name: 'United Kingdom', code: 'GB', requests: 18900, flag: '🇬🇧' },
        { name: 'France', code: 'FR', requests: 15670, flag: '🇫🇷' },
        { name: 'Canada', code: 'CA', requests: 12340, flag: '🇨🇦' }
    ];

    const totalRequests = countries.reduce((sum, country) => sum + country.requests, 0);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Countries</h3>
            <div className="space-y-3">
                {countries.map((country, index) => {
                    const percentage = (country.requests / totalRequests) * 100;
                    return (
                        <div key={country.code} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <span className="text-2xl">{country.flag}</span>
                                <div>
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{country.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{country.code}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {country.requests.toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{percentage.toFixed(1)}%</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Performance Metrics Component
const PerformanceMetrics = ({ data }) => {
    const metrics = [
        { name: 'Cache Hit Ratio', value: '89.2%', target: '85%', status: 'good' },
        { name: 'Average Response Time', value: '45ms', target: '<100ms', status: 'good' },
        { name: 'Error Rate', value: '0.12%', target: '<1%', status: 'good' },
        { name: 'Bandwidth Saved', value: '2.4 TB', target: '2.0 TB', status: 'excellent' }
    ];

    const getStatusColor = (status) => {
        switch (status) {
            case 'excellent': return 'text-green-600 bg-green-100 dark:bg-green-900/50';
            case 'good': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/50';
            case 'warning': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/50';
            case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/50';
            default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900/50';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'excellent': return '🟢';
            case 'good': return '🔵';
            case 'warning': return '🟡';
            case 'critical': return '🔴';
            default: return '⚪';
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Performance Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metrics.map((metric, index) => (
                    <div key={index} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{metric.name}</span>
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(metric.status)}`}>
                                {getStatusIcon(metric.status)} {metric.status}
                            </span>
                        </div>
                        <div className="flex items-end justify-between">
                            <span className="text-2xl font-bold text-gray-900 dark:text-white">{metric.value}</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">Target: {metric.target}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Real-time Activity Feed Component
const ActivityFeed = () => {
    const [activities, setActivities] = useState([
        { id: 1, type: 'security', message: 'Blocked 15 malicious requests from 203.0.113.1', time: '2 min ago' },
        { id: 2, type: 'performance', message: 'Cache hit ratio improved to 89.2%', time: '5 min ago' },
        { id: 3, type: 'security', message: 'New firewall rule activated', time: '8 min ago' },
        { id: 4, type: 'traffic', message: 'Traffic spike detected: +45% requests', time: '12 min ago' },
        { id: 5, type: 'ssl', message: 'SSL certificate renewed for example.com', time: '1 hour ago' }
    ]);

    const getActivityIcon = (type) => {
        switch (type) {
            case 'security': return '🛡️';
            case 'performance': return '⚡';
            case 'traffic': return '📈';
            case 'ssl': return '🔒';
            default: return 'ℹ️';
        }
    };

    const getActivityColor = (type) => {
        switch (type) {
            case 'security': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
            case 'performance': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
            case 'traffic': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
            case 'ssl': return 'text-purple-600 bg-purple-50 dark:bg-purple-900/20';
            default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20';
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Real-time Activity</h3>
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">Live</span>
                </div>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
                {activities.map((activity) => (
                    <div key={activity.id} className={`p-3 rounded-lg ${getActivityColor(activity.type)}`}>
                        <div className="flex items-start space-x-3">
                            <span className="text-lg">{getActivityIcon(activity.type)}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900 dark:text-white">{activity.message}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{activity.time}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Zone Selector Component
const ZoneSelector = ({ zones, selectedZone, onZoneChange }) => {
    return (
        <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Zone:
            </label>
            <select
                value={selectedZone?.id || ''}
                onChange={(e) => {
                    const zone = zones.find(z => z.id === e.target.value);
                    onZoneChange(zone);
                }}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
                <option value="">All Zones</option>
                {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                        {zone.name}
                    </option>
                ))}
            </select>
        </div>
    );
};

// Export Button Component
const ExportButton = ({ onExport, loading }) => {
    return (
        <button
            onClick={onExport}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
            {loading ? '📤 Exporting...' : '📤 Export Data'}
        </button>
    );
};

// Main Analytics Page Component
const AnalyticsPage = () => {
    const [selectedZone, setSelectedZone] = useState(null);
    const [timeRange, setTimeRange] = useState('24h');
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [analyticsData, setAnalyticsData] = useState({
        overview: {
            totalRequests: 1254782,
            totalThreats: 3542,
            uniqueVisitors: 45231,
            bandwidthSaved: 2400000000000 // bytes
        },
        traffic: {
            requests: Array.from({ length: 24 }, (_, i) => ({
                label: `${i}:00`,
                value: Math.floor(Math.random() * 10000) + 5000
            })),
            bandwidth: Array.from({ length: 24 }, (_, i) => ({
                label: `${i}:00`,
                value: Math.floor(Math.random() * 1000) + 500
            }))
        }
    });

    // Mock zones data
    const zones = [
        { id: '1', name: 'example.com', status: 'active' },
        { id: '2', name: 'test.com', status: 'active' },
        { id: '3', name: 'demo.org', status: 'pending' }
    ];

    useEffect(() => {
        loadAnalyticsData();
    }, [selectedZone, timeRange]);

    const loadAnalyticsData = async () => {
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Update mock data based on time range
            setAnalyticsData(prev => ({
                ...prev,
                overview: {
                    totalRequests: Math.floor(Math.random() * 2000000) + 500000,
                    totalThreats: Math.floor(Math.random() * 5000) + 1000,
                    uniqueVisitors: Math.floor(Math.random() * 100000) + 20000,
                    bandwidthSaved: Math.floor(Math.random() * 5000000000000) + 1000000000000
                }
            }));
        } catch (error) {
            console.error('Failed to load analytics data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            // Simulate export
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Create mock CSV data
            const csvData = `Date,Requests,Threats,Visitors\n${analyticsData.traffic.requests.map((item, index) =>
                `${item.label},${item.value},${Math.floor(Math.random() * 100)},${Math.floor(Math.random() * 1000)}`
            ).join('\n')
                }`;

            // Download CSV
            const blob = new Blob([csvData], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics-${selectedZone?.name || 'all-zones'}-${timeRange}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert('Analytics data exported successfully!');
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Monitor your website performance and security metrics
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                    <ZoneSelector
                        zones={zones}
                        selectedZone={selectedZone}
                        onZoneChange={setSelectedZone}
                    />
                    <ExportButton onExport={handleExport} loading={exporting} />
                </div>
            </div>

            {/* Time Range Selector */}
            <div className="flex justify-center lg:justify-start">
                <TimeRangeSelector
                    selectedRange={timeRange}
                    onRangeChange={setTimeRange}
                />
            </div>

            {loading ? (
                <div className="text-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading analytics data...</p>
                </div>
            ) : (
                <>
                    {/* Overview Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <MetricCard
                            title="Total Requests"
                            value={analyticsData.overview.totalRequests.toLocaleString()}
                            change="+12.5% from yesterday"
                            changeType="positive"
                            icon="📊"
                            color="bg-blue-100 dark:bg-blue-900/50"
                        />
                        <MetricCard
                            title="Threats Blocked"
                            value={analyticsData.overview.totalThreats.toLocaleString()}
                            change="-5.2% from yesterday"
                            changeType="positive"
                            icon="🛡️"
                            color="bg-red-100 dark:bg-red-900/50"
                        />
                        <MetricCard
                            title="Unique Visitors"
                            value={analyticsData.overview.uniqueVisitors.toLocaleString()}
                            change="+8.1% from yesterday"
                            changeType="positive"
                            icon="👥"
                            color="bg-green-100 dark:bg-green-900/50"
                        />
                        <MetricCard
                            title="Bandwidth Saved"
                            value={`${(analyticsData.overview.bandwidthSaved / 1024 / 1024 / 1024 / 1024).toFixed(1)} TB`}
                            change="+15.3% from yesterday"
                            changeType="positive"
                            icon="💾"
                            color="bg-purple-100 dark:bg-purple-900/50"
                        />
                    </div>

                    {/* Traffic Analytics */}
                    <TrafficAnalytics data={analyticsData.traffic} timeRange={timeRange} />

                    {/* Secondary Analytics */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <SecurityAnalytics data={analyticsData} />
                        <TopCountries data={analyticsData} />
                    </div>

                    {/* Performance and Activity */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <PerformanceMetrics data={analyticsData} />
                        <ActivityFeed />
                    </div>
                </>
            )}
        </div>
    );
};

export default AnalyticsPage;