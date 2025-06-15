const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

// Middleware imports
const { errorHandler } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
const logger = require('./utils/logger');

// Route imports
const authRoutes = require('./routes/auth');
const zoneRoutes = require('./routes/zones');
const securityRoutes = require('./routes/security');
const analyticsRoutes = require('./routes/analytics');
const configRoutes = require('./routes/config');

const app = express();

// Trust proxy (for Heroku, Railway, etc.)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            process.env.CORS_ORIGIN,
            'http://localhost:3000',
            'http://localhost:5173',
            'http://localhost:5174'
        ].filter(Boolean);

        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn(`🚫 CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Request logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', {
        stream: {
            write: (message) => logger.info(message.trim())
        }
    }));
}

// Body parsing middleware
app.use(express.json({
    limit: '10mb',
    strict: true
}));
app.use(express.urlencoded({
    extended: true,
    limit: '10mb'
}));

// Rate limiting
app.use('/api/', generalLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0'
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/config', configRoutes);

// Welcome route
app.get('/', (req, res) => {
    res.json({
        message: '🛡️ Cloudflare Security Manager API',
        version: '1.0.0',
        documentation: '/api/docs',
        health: '/health',
        timestamp: new Date().toISOString()
    });
});

// API documentation route
app.get('/api/docs', (req, res) => {
    res.json({
        title: 'Cloudflare Security Manager API',
        version: '1.0.0',
        endpoints: {
            auth: {
                'POST /api/auth/login': 'User login',
                'POST /api/auth/register': 'User registration',
                'POST /api/auth/refresh': 'Refresh token',
                'POST /api/auth/logout': 'User logout'
            },
            zones: {
                'GET /api/zones': 'Get user zones',
                'GET /api/zones/:zoneId': 'Get zone details',
                'POST /api/zones': 'Add new zone'
            },
            security: {
                'GET /api/security/:zoneId': 'Get security settings',
                'PATCH /api/security/:zoneId/:setting': 'Update security setting',
                'POST /api/security/:zoneId/bulk': 'Bulk update settings'
            },
            analytics: {
                'GET /api/analytics/:zoneId/overview': 'Get analytics overview',
                'GET /api/analytics/:zoneId/threats': 'Get threat statistics',
                'GET /api/analytics/:zoneId/performance': 'Get performance metrics'
            },
            config: {
                'GET /api/config/:zoneId/export': 'Export configuration',
                'POST /api/config/:zoneId/import': 'Import configuration',
                'GET /api/config/:zoneId/backup': 'Create backup'
            }
        }
    });
});

// 404 handler for API routes
app.all('/api/*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: `The endpoint ${req.method} ${req.path} does not exist`,
        availableEndpoints: '/api/docs'
    });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;