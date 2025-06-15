const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logs
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`;

        // Add metadata if present
        if (Object.keys(meta).length > 0) {
            log += `\n${JSON.stringify(meta, null, 2)}`;
        }

        return log;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: {
        service: 'cloudflare-security-manager',
        version: process.env.npm_package_version || '1.0.0'
    },
    transports: [
        // File transport for errors
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: parseInt(process.env.LOG_MAX_SIZE) || 10485760, // 10MB
            maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
            tailable: true
        }),

        // File transport for all logs
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: parseInt(process.env.LOG_MAX_SIZE) || 10485760, // 10MB
            maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
            tailable: true
        }),

        // File transport for API requests
        new winston.transports.File({
            filename: path.join(logsDir, 'api.log'),
            level: 'info',
            maxsize: parseInt(process.env.LOG_MAX_SIZE) || 10485760, // 10MB
            maxFiles: parseInt(process.env.LOG_MAX_FILES) || 3,
            tailable: true,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    // Only log API-related messages
                    if (meta.type === 'api' || message.includes('API') || meta.endpoint) {
                        return JSON.stringify({ timestamp, level, message, ...meta });
                    }
                    return false;
                })
            )
        })
    ],

    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
            maxsize: 10485760,
            maxFiles: 3
        })
    ],

    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
            maxsize: 10485760,
            maxFiles: 3
        })
    ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat,
        level: 'debug'
    }));
}

// Custom logging methods
const customLogger = {
    ...logger,

    // API request logging
    apiRequest: (req, res, duration) => {
        logger.info('API Request', {
            type: 'api',
            method: req.method,
            endpoint: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.userId || 'anonymous',
            timestamp: new Date().toISOString()
        });
    },

    // Cloudflare API logging
    cloudflareApi: (action, zoneId, success, details = {}) => {
        logger.info('Cloudflare API Call', {
            type: 'cloudflare',
            action,
            zoneId,
            success,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Security event logging
    security: (event, details = {}) => {
        logger.warn('Security Event', {
            type: 'security',
            event,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Authentication logging
    auth: (action, userId, success, details = {}) => {
        logger.info('Authentication Event', {
            type: 'auth',
            action,
            userId,
            success,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Database operation logging
    database: (operation, table, success, details = {}) => {
        logger.debug('Database Operation', {
            type: 'database',
            operation,
            table,
            success,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Performance logging
    performance: (operation, duration, details = {}) => {
        const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
        logger[level]('Performance Metric', {
            type: 'performance',
            operation,
            duration: `${duration}ms`,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // User activity logging
    userActivity: (userId, action, details = {}) => {
        logger.info('User Activity', {
            type: 'activity',
            userId,
            action,
            ...details,
            timestamp: new Date().toISOString()
        });
    },

    // Business logic logging
    business: (event, details = {}) => {
        logger.info('Business Event', {
            type: 'business',
            event,
            ...details,
            timestamp: new Date().toISOString()
        });
    }
};

// Log rotation cleanup (runs daily)
if (process.env.NODE_ENV === 'production') {
    setInterval(() => {
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        const now = Date.now();

        fs.readdir(logsDir, (err, files) => {
            if (err) return;

            files.forEach(file => {
                const filePath = path.join(logsDir, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) return;

                    if (now - stats.mtime.getTime() > maxAge) {
                        fs.unlink(filePath, (err) => {
                            if (!err) {
                                logger.info(`Deleted old log file: ${file}`);
                            }
                        });
                    }
                });
            });
        });
    }, 24 * 60 * 60 * 1000); // Run daily
}

module.exports = customLogger;