#!/usr/bin/env node

/**
 * Cloudflare Security Manager - Backend Server
 * Entry point for the application
 */

// Load environment variables first
require('dotenv').config();

console.log('🚀 Starting Cloudflare Security Manager Backend...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('🔧 Port:', process.env.PORT || 3000);

// Import modules
let app, logger, sequelize;

try {
    console.log('📦 Loading modules...');

    app = require('./app');
    console.log('✅ Express app loaded');

    // Try to load logger with fallback
    try {
        logger = require('./utils/logger');
        console.log('✅ Logger loaded');
    } catch (loggerError) {
        console.warn('⚠️  Logger failed to load:', loggerError.message);
        // Create fallback logger
        logger = {
            info: console.log,
            error: console.error,
            warn: console.warn,
            debug: console.log
        };
        console.log('✅ Fallback logger created');
    }

    // Try to load database
    try {
        const { sequelize: db } = require('./config/database');
        sequelize = db;
        console.log('✅ Database config loaded');
    } catch (dbError) {
        console.warn('⚠️  Database config failed to load:', dbError.message);
        sequelize = null;
    }

} catch (error) {
    console.error('❌ Failed to load modules:', error.message);
    process.exit(1);
}

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Initialize database connection
 */
async function initializeDatabase() {
    if (!sequelize) {
        console.log('⚠️  Skipping database initialization (not configured)');
        return;
    }

    try {
        console.log('🔗 Connecting to database...');
        await sequelize.authenticate();
        console.log('✅ Database connection established successfully');

        // Safe logger call
        if (logger && typeof logger.info === 'function') {
            logger.info('✅ Database connection established successfully');
        }

        if (NODE_ENV === 'development') {
            console.log('🔄 Syncing database models...');
            await sequelize.sync({ alter: true });
            console.log('📊 Database synchronized');

            if (logger && typeof logger.info === 'function') {
                logger.info('📊 Database synchronized');
            }
        }
    } catch (error) {
        console.error('❌ Unable to connect to database:', error.message);

        // Safe logger call
        if (logger && typeof logger.error === 'function') {
            logger.error('❌ Unable to connect to database:', error);
        }

        // Don't exit in development, continue without database
        if (NODE_ENV === 'production') {
            process.exit(1);
        } else {
            console.log('⚠️  Continuing without database in development mode');
        }
    }
}

/**
 * Start the server
 */
async function startServer() {
    try {
        console.log('🔧 Initializing application...');

        // Initialize database
        await initializeDatabase();

        // Start server
        const server = app.listen(PORT, () => {
            console.log('');
            console.log('🎉 ===============================================');
            console.log('🚀 Cloudflare Security Manager Backend Started!');
            console.log('🎉 ===============================================');
            console.log(`📡 Server URL: http://localhost:${PORT}`);
            console.log(`🌍 Environment: ${NODE_ENV}`);
            console.log(`📅 Started at: ${new Date().toLocaleString()}`);
            console.log('');
            console.log('📋 Available endpoints:');
            console.log('   GET  / - Welcome message');
            console.log('   GET  /health - Health check');
            console.log('   GET  /api/docs - API documentation');
            console.log('');
            console.log('🔄 Watching for changes...');
            console.log('===============================================');

            // Safe logger call
            if (logger && typeof logger.info === 'function') {
                logger.info(`🚀 Server running on port ${PORT} in ${NODE_ENV} mode`);

                if (NODE_ENV === 'development') {
                    logger.info('🔧 Development mode - Auto-reload enabled');
                }
            }
        });

        // Graceful shutdown
        const gracefulShutdown = (signal) => {
            console.log(`\n📤 Received ${signal}. Starting graceful shutdown...`);
            if (logger && typeof logger.info === 'function') {
                logger.info(`📤 Received ${signal}. Starting graceful shutdown...`);
            }

            server.close(async () => {
                console.log('🔒 HTTP server closed');
                if (logger && typeof logger.info === 'function') {
                    logger.info('🔒 HTTP server closed');
                }

                try {
                    if (sequelize) {
                        await sequelize.close();
                        console.log('📊 Database connections closed');
                        if (logger && typeof logger.info === 'function') {
                            logger.info('📊 Database connections closed');
                        }
                    }

                    console.log('✅ Graceful shutdown completed');
                    if (logger && typeof logger.info === 'function') {
                        logger.info('✅ Graceful shutdown completed');
                    }
                    process.exit(0);
                } catch (error) {
                    console.error('❌ Error during shutdown:', error.message);
                    if (logger && typeof logger.error === 'function') {
                        logger.error('❌ Error during shutdown:', error);
                    }
                    process.exit(1);
                }
            });
        };

        // Handle shutdown signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('💥 Uncaught Exception:', error.message);
            if (logger && typeof logger.error === 'function') {
                logger.error('💥 Uncaught Exception:', error);
            }
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            if (logger && typeof logger.error === 'function') {
                logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
            }
            process.exit(1);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        if (logger && typeof logger.error === 'function') {
            logger.error('❌ Failed to start server:', error);
        }
        process.exit(1);
    }
}

// Handle module loading errors
process.on('warning', (warning) => {
    console.warn('⚠️  Warning:', warning.message);
});

// Start the application
console.log('🔄 Initializing server...');
startServer().catch((error) => {
    console.error('💥 Failed to start application:', error.message);
    process.exit(1);
});