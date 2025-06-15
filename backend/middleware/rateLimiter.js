const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * Create rate limiter with custom configuration
 */
const createRateLimiter = (options = {}) => {
    const defaultOptions = {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per windowMs
        message: {
            error: 'Too many requests',
            message: 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
        },
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers

        // Custom key generator based on IP and user ID
        keyGenerator: (req) => {
            return req.userId ? `user:${req.userId}` : `ip:${req.ip}`;
        },

        // Custom handler for rate limit exceeded
        handler: (req, res) => {
            logger.warn(`Rate limit exceeded`, {
                ip: req.ip,
                userId: req.userId || 'anonymous',
                userAgent: req.get('User-Agent'),
                endpoint: req.path
            });

            res.status(429).json({
                error: 'Too many requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: Math.ceil(options.windowMs || 15 * 60 * 1000) / 1000,
                timestamp: new Date().toISOString()
            });
        },

        // Skip rate limiting for certain conditions
        skip: (req) => {
            // Skip for health check
            if (req.path === '/health') return true;

            // Skip in test environment
            if (process.env.NODE_ENV === 'test') return true;

            return false;
        }
    };

    return rateLimit({ ...defaultOptions, ...options });
};

// General API rate limiter
const generalLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    message: {
        error: 'Too many requests',
        message: 'General rate limit exceeded. Please try again later.'
    }
});

// Strict rate limiter for sensitive endpoints
const strictLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per 15 minutes
    message: {
        error: 'Too many requests',
        message: 'Strict rate limit exceeded. Please try again later.'
    }
});

// Authentication rate limiter
const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per 15 minutes
    skipSuccessfulRequests: true, // Don't count successful requests
    message: {
        error: 'Too many login attempts',
        message: 'Too many failed login attempts. Please try again later.'
    }
});

// Cloudflare API rate limiter (more restrictive)
const cloudflareApiLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute (Cloudflare allows much more, but being conservative)
    message: {
        error: 'Too many API requests',
        message: 'Cloudflare API rate limit exceeded. Please try again later.'
    }
});

// Password reset rate limiter
const passwordResetLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset attempts per hour
    message: {
        error: 'Too many password reset attempts',
        message: 'Too many password reset attempts. Please try again later.'
    }
});

// File upload rate limiter
const uploadLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 uploads per 15 minutes
    message: {
        error: 'Too many uploads',
        message: 'Upload rate limit exceeded. Please try again later.'
    }
});

// Export configuration rate limiter
const exportLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 exports per 5 minutes
    message: {
        error: 'Too many exports',
        message: 'Export rate limit exceeded. Please try again later.'
    }
});

// Analytics rate limiter
const analyticsLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: {
        error: 'Too many analytics requests',
        message: 'Analytics rate limit exceeded. Please try again later.'
    }
});

// Dynamic rate limiter based on user role
const dynamicLimiter = (req, res, next) => {
    let limits = {
        windowMs: 15 * 60 * 1000,
        max: 100 // Default limit
    };

    // Adjust limits based on user role
    if (req.user) {
        switch (req.user.role) {
            case 'admin':
                limits.max = 1000; // Higher limit for admins
                break;
            case 'premium':
                limits.max = 500; // Higher limit for premium users
                break;
            case 'user':
                limits.max = 100; // Standard limit
                break;
            default:
                limits.max = 50; // Lower limit for others
        }
    } else {
        limits.max = 50; // Lower limit for unauthenticated users
    }

    const limiter = createRateLimiter(limits);
    return limiter(req, res, next);
};

// IP-based rate limiter for suspicious activity
const suspiciousActivityLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Very restrictive
    skipSuccessfulRequests: false,
    message: {
        error: 'Suspicious activity detected',
        message: 'Too many requests detected. Access temporarily restricted.'
    }
});

module.exports = {
    generalLimiter,
    strictLimiter,
    authLimiter,
    cloudflareApiLimiter,
    passwordResetLimiter,
    uploadLimiter,
    exportLimiter,
    analyticsLimiter,
    dynamicLimiter,
    suspiciousActivityLimiter,
    createRateLimiter
};