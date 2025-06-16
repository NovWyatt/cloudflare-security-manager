import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/globals.css'

// Error boundary component
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true }
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo
        })

        // Log error to monitoring service
        console.error('Application Error:', error, errorInfo)

        // In production, you would send this to your error tracking service
        if (import.meta.env.PROD) {
            // Example: Sentry.captureException(error, { extra: errorInfo })
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                            Something went wrong
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            We apologize for the inconvenience. The application has encountered an unexpected error.
                        </p>

                        {!import.meta.env.PROD && this.state.error && (
                            <details className="text-left bg-gray-100 dark:bg-gray-700 p-4 rounded mb-4">
                                <summary className="cursor-pointer font-medium text-gray-900 dark:text-white mb-2">
                                    Error Details (Development)
                                </summary>
                                <div className="text-sm text-red-600 dark:text-red-400 font-mono">
                                    {this.state.error.toString()}
                                </div>
                                {this.state.errorInfo.componentStack && (
                                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                                        {this.state.errorInfo.componentStack}
                                    </div>
                                )}
                            </details>
                        )}

                        <div className="space-y-3">
                            <button
                                onClick={() => window.location.reload()}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                            >
                                🔄 Reload Application
                            </button>

                            <button
                                onClick={() => {
                                    localStorage.clear()
                                    sessionStorage.clear()
                                    window.location.reload()
                                }}
                                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                            >
                                🗑️ Clear Data & Reload
                            </button>

                            <a
                                href="mailto:support@cloudflare-security-manager.com"
                                className="w-full inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors text-decoration-none"
                            >
                                📧 Contact Support
                            </a>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

// Performance monitoring
if (import.meta.env.PROD) {
    // Monitor Core Web Vitals
    function reportWebVitals() {
        if ('web-vitals' in window) {
            const { getCLS, getFID, getFCP, getLCP, getTTFB } = window.webVitals

            getCLS(console.log)
            getFID(console.log)
            getFCP(console.log)
            getLCP(console.log)
            getTTFB(console.log)
        }
    }

    // Report web vitals after page load
    if (document.readyState === 'complete') {
        reportWebVitals()
    } else {
        window.addEventListener('load', reportWebVitals)
    }
}

// Development helpers
if (import.meta.env.DEV) {
    // React DevTools
    if (typeof window !== 'undefined') {
        window.React = React
    }

    // Development console banner
    console.log(
        '%cCloudflare Security Manager%c\n' +
        'Development Mode\n' +
        'Version: ' + (import.meta.env.VITE_APP_VERSION || '1.0.0') + '\n' +
        'Build: ' + (import.meta.env.VITE_BUILD_DATE || 'local'),
        'color: #3b82f6; font-size: 18px; font-weight: bold;',
        'color: #6b7280; font-size: 12px;'
    )
}

// Initialize application
const root = ReactDOM.createRoot(document.getElementById('root'))

root.render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>
)

// Hot module replacement for development
if (import.meta.hot) {
    import.meta.hot.accept('./App.jsx', () => {
        // Re-render the app when App.jsx changes
        root.render(
            <React.StrictMode>
                <ErrorBoundary>
                    <App />
                </ErrorBoundary>
            </React.StrictMode>
        )
    })
}

// Service worker registration for production
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js')
            console.log('SW registered: ', registration)

            // Handle service worker updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New content available, show update notification
                        if (confirm('A new version is available. Would you like to update?')) {
                            window.location.reload()
                        }
                    }
                })
            })
        } catch (error) {
            console.log('SW registration failed: ', error)
        }
    })
}

// Handle online/offline events
window.addEventListener('online', () => {
    console.log('Application is back online')
    // You could dispatch a global event here to update UI state
    document.dispatchEvent(new CustomEvent('app:online'))
})

window.addEventListener('offline', () => {
    console.log('Application is offline')
    // You could dispatch a global event here to update UI state
    document.dispatchEvent(new CustomEvent('app:offline'))
})

// Prevent zoom on iOS Safari double-tap
document.addEventListener('touchstart', function (event) {
    if (event.touches.length > 1) {
        event.preventDefault()
    }
}, { passive: false })

let lastTouchEnd = 0
document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime()
    if (now - lastTouchEnd <= 300) {
        event.preventDefault()
    }
    lastTouchEnd = now
}, false)

// Global error handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error)

    if (import.meta.env.PROD) {
        // Send to error tracking service
        // Example: Sentry.captureException(event.error)
    }
})

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason)

    if (import.meta.env.PROD) {
        // Send to error tracking service
        // Example: Sentry.captureException(event.reason)
    }

    // Prevent the default browser behavior
    event.preventDefault()
})