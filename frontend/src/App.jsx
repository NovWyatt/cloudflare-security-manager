import React, { useState, useEffect } from 'react';

// Context Providers
const AuthContext = React.createContext();
const ThemeContext = React.createContext();
const CloudflareContext = React.createContext();

// Theme Provider
const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'light';
    });

    useEffect(() => {
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

// Auth Provider
const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for existing auth token
        const token = localStorage.getItem('auth_token');
        if (token) {
            // Verify token with backend
            verifyToken(token);
        } else {
            setLoading(false);
        }
    }, []);

    const verifyToken = async (token) => {
        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                setUser(userData.data.user);
            } else {
                localStorage.removeItem('auth_token');
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            localStorage.removeItem('auth_token');
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('auth_token', data.data.token);
                setUser(data.data.user);
                return { success: true };
            } else {
                return { success: false, message: data.message };
            }
        } catch (error) {
            return { success: false, message: 'Login failed. Please try again.' };
        }
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

// Cloudflare Provider
const CloudflareProvider = ({ children }) => {
    const [zones, setZones] = useState([]);
    const [selectedZone, setSelectedZone] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchZones = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/zones', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setZones(data.data.zones);
                if (data.data.zones.length > 0 && !selectedZone) {
                    setSelectedZone(data.data.zones[0]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch zones:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchZones();
    }, []);

    return (
        <CloudflareContext.Provider value={{
            zones,
            selectedZone,
            setSelectedZone,
            loading,
            fetchZones
        }}>
            {children}
        </CloudflareContext.Provider>
    );
};

// Custom hooks
const useAuth = () => {
    const context = React.useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

const useTheme = () => {
    const context = React.useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
};

const useCloudflare = () => {
    const context = React.useContext(CloudflareContext);
    if (!context) {
        throw new Error('useCloudflare must be used within CloudflareProvider');
    }
    return context;
};

// Loading Component
const Loading = ({ size = 'md', text = 'Loading...' }) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    };

    return (
        <div className="flex items-center justify-center p-4">
            <div className="flex flex-col items-center space-y-2">
                <div className={`${sizeClasses[size]} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin`}></div>
                {text && <p className="text-sm text-gray-600 dark:text-gray-400">{text}</p>}
            </div>
        </div>
    );
};

// Alert Component
const Alert = ({ type = 'info', title, message, onClose }) => {
    const typeStyles = {
        success: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/50 dark:border-green-700 dark:text-green-200',
        error: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/50 dark:border-red-700 dark:text-red-200',
        warning: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/50 dark:border-yellow-700 dark:text-yellow-200',
        info: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-200'
    };

    const iconMap = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    return (
        <div className={`border rounded-lg p-4 ${typeStyles[type]} transition-all duration-300 transform slide-in-right`}>
            <div className="flex items-start">
                <span className="text-lg mr-3">{iconMap[type]}</span>
                <div className="flex-1">
                    {title && <h4 className="font-semibold text-sm">{title}</h4>}
                    {message && <p className="text-sm mt-1">{message}</p>}
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
};

// Header Component
const Header = ({ sidebarOpen, setSidebarOpen, onAlert }) => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const handleLogout = () => {
        logout();
        onAlert({
            type: 'success',
            title: 'Logged Out',
            message: 'You have been successfully logged out.'
        });
    };

    return (
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 fixed w-full top-0 z-40">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <div className="w-6 h-6 flex flex-col justify-center space-y-1">
                            <div className="w-full h-0.5 bg-current"></div>
                            <div className="w-full h-0.5 bg-current"></div>
                            <div className="w-full h-0.5 bg-current"></div>
                        </div>
                    </button>

                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">CF</span>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                            Cloudflare Security Manager
                        </h1>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                    >
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="flex items-center space-x-2 p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                                <span className="text-white font-medium text-sm">
                                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                                </span>
                            </div>
                            <span className="hidden md:block font-medium">{user?.username}</span>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>

                        {dropdownOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                                <div className="py-1">
                                    <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                                        <p className="font-medium">{user?.username}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setDropdownOpen(false);
                                            // Navigate to settings
                                        }}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        ⚙️ Settings
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        🚪 Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

// Sidebar Component
const Sidebar = ({ open, setOpen }) => {
    const [currentPage, setCurrentPage] = useState('dashboard');

    const navigation = [
        { id: 'dashboard', name: 'Dashboard', icon: '📊' },
        { id: 'security', name: 'Security', icon: '🛡️' },
        { id: 'analytics', name: 'Analytics', icon: '📈' },
        { id: 'settings', name: 'Settings', icon: '⚙️' }
    ];

    return (
        <>
            {/* Mobile overlay */}
            {open && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed left-0 top-16 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 w-64 z-40 transform transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'
                } lg:translate-x-0`}>
                <nav className="p-4 space-y-2">
                    {navigation.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setCurrentPage(item.id);
                                setOpen(false);
                            }}
                            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${currentPage === item.id
                                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                        >
                            <span className="text-lg">{item.icon}</span>
                            <span className="font-medium">{item.name}</span>
                        </button>
                    ))}
                </nav>
            </div>
        </>
    );
};

// Login Page
const Login = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const result = await login(email, password);

        if (!result.success) {
            setError(result.message);
        }

        setLoading(false);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
                    <span className="text-white font-bold text-2xl">CF</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome Back</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Sign in to your account</p>
            </div>

            {error && (
                <Alert
                    type="error"
                    message={error}
                    onClose={() => setError('')}
                />
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Email Address
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Enter your email"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Password
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Enter your password"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                    {loading ? <Loading size="sm" text="" /> : 'Sign In'}
                </button>
            </form>

            <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Don't have an account? <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">Sign up</a>
                </p>
            </div>
        </div>
    );
};

// Dashboard Page
const Dashboard = () => {
    const { zones } = useCloudflare();
    const [stats, setStats] = useState({
        totalRequests: 0,
        totalThreats: 0,
        uniqueVisitors: 0,
        bandwidthSaved: 0
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    Last updated: {new Date().toLocaleString()}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                            <span className="text-2xl">📊</span>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Requests</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stats.totalRequests.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                        <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                            <span className="text-2xl">🛡️</span>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Threats Blocked</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stats.totalThreats.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                        <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                            <span className="text-2xl">👥</span>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Unique Visitors</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {stats.uniqueVisitors.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                            <span className="text-2xl">💾</span>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Bandwidth Saved</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">
                                {(stats.bandwidthSaved / 1024 / 1024 / 1024).toFixed(1)} GB
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Zones List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your Zones</h2>
                </div>
                <div className="p-6">
                    {zones.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="text-6xl mb-4">🌐</div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No zones found</h3>
                            <p className="text-gray-600 dark:text-gray-400">Connect your Cloudflare account to manage your zones.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {zones.map((zone) => (
                                <div key={zone.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="font-semibold text-gray-900 dark:text-white">{zone.name}</h3>
                                        <span className={`px-2 py-1 text-xs rounded-full ${zone.status === 'active'
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
                                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200'
                                            }`}>
                                            {zone.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                        Type: {zone.type || 'N/A'}
                                    </p>
                                    <div className="flex space-x-2">
                                        <button className="flex-1 bg-blue-600 text-white text-sm px-3 py-1 rounded hover:bg-blue-700 transition-colors">
                                            Manage
                                        </button>
                                        <button className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                                            Analytics
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Main App Component
const App = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [currentPage, setCurrentPage] = useState('login');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [alerts, setAlerts] = useState([]);

    const addAlert = (alert) => {
        const alertWithId = { ...alert, id: Date.now() };
        setAlerts(prev => [...prev, alertWithId]);

        // Auto remove after 5 seconds
        setTimeout(() => {
            removeAlert(alertWithId.id);
        }, 5000);
    };

    const removeAlert = (id) => {
        setAlerts(prev => prev.filter(alert => alert.id !== id));
    };

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Protected Route Logic
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <Loading size="lg" text="Loading application..." />
            </div>
        );
    }

    // Render login page if not authenticated
    if (!user) {
        return (
            <ThemeProvider>
                <AuthProvider>
                    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 flex items-center justify-center p-4">
                        <div className="w-full max-w-md">
                            <Login />
                        </div>
                    </div>
                </AuthProvider>
            </ThemeProvider>
        );
    }

    // Main app layout for authenticated users
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Offline Banner */}
            {!isOnline && (
                <div className="bg-red-500 text-white text-center py-2 px-4 text-sm font-medium">
                    🔴 You are currently offline. Some features may not work properly.
                </div>
            )}

            {/* Header */}
            <Header
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                onAlert={addAlert}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
            />

            {/* Alerts Container */}
            <div className="fixed top-20 right-4 z-50 space-y-2">
                {alerts.map(alert => (
                    <Alert
                        key={alert.id}
                        type={alert.type}
                        title={alert.title}
                        message={alert.message}
                        onClose={() => removeAlert(alert.id)}
                    />
                ))}
            </div>

            <div className="flex">
                {/* Sidebar */}
                <Sidebar
                    open={sidebarOpen}
                    setOpen={setSidebarOpen}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                />

                {/* Main Content */}
                <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'
                    } lg:ml-64 pt-16`}>
                    <div className="container mx-auto px-4 py-6">
                        <CloudflareProvider>
                            {currentPage === 'dashboard' && <Dashboard />}
                            {currentPage === 'security' && <div className="text-center py-8"><h1 className="text-2xl font-bold">Security Page</h1><p>Coming soon...</p></div>}
                            {currentPage === 'analytics' && <div className="text-center py-8"><h1 className="text-2xl font-bold">Analytics Page</h1><p>Coming soon...</p></div>}
                            {currentPage === 'settings' && <div className="text-center py-8"><h1 className="text-2xl font-bold">Settings Page</h1><p>Coming soon...</p></div>}
                        </CloudflareProvider>
                    </div>
                </main>
            </div>
        </div>
    );
};

// Update Header to handle navigation
const HeaderWithNav = ({ sidebarOpen, setSidebarOpen, onAlert, currentPage, setCurrentPage }) => {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const handleLogout = () => {
        logout();
        onAlert({
            type: 'success',
            title: 'Logged Out',
            message: 'You have been successfully logged out.'
        });
    };

    return (
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 fixed w-full top-0 z-40">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="lg:hidden p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <div className="w-6 h-6 flex flex-col justify-center space-y-1">
                            <div className="w-full h-0.5 bg-current"></div>
                            <div className="w-full h-0.5 bg-current"></div>
                            <div className="w-full h-0.5 bg-current"></div>
                        </div>
                    </button>

                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">CF</span>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                            Cloudflare Security Manager
                        </h1>
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                    >
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="flex items-center space-x-2 p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                                <span className="text-white font-medium text-sm">
                                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                                </span>
                            </div>
                            <span className="hidden md:block font-medium">{user?.username}</span>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>

                        {dropdownOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                                <div className="py-1">
                                    <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                                        <p className="font-medium">{user?.username}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setDropdownOpen(false);
                                            setCurrentPage('settings');
                                        }}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        ⚙️ Settings
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                        🚪 Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

// Update Sidebar to handle navigation
const SidebarWithNav = ({ open, setOpen, currentPage, setCurrentPage }) => {
    const navigation = [
        { id: 'dashboard', name: 'Dashboard', icon: '📊' },
        { id: 'security', name: 'Security', icon: '🛡️' },
        { id: 'analytics', name: 'Analytics', icon: '📈' },
        { id: 'settings', name: 'Settings', icon: '⚙️' }
    ];

    return (
        <>
            {/* Mobile overlay */}
            {open && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed left-0 top-16 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 w-64 z-40 transform transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'
                } lg:translate-x-0`}>
                <nav className="p-4 space-y-2">
                    {navigation.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setCurrentPage(item.id);
                                setOpen(false);
                            }}
                            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${currentPage === item.id
                                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                        >
                            <span className="text-lg">{item.icon}</span>
                            <span className="font-medium">{item.name}</span>
                        </button>
                    ))}
                </nav>
            </div>
        </>
    );
};

// Main export with all providers
export default function CloudflareSecurityManager() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <App />
            </AuthProvider>
        </ThemeProvider>
    );
}