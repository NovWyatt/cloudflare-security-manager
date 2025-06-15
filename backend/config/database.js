const { Sequelize } = require('sequelize');
const path = require('path');
const logger = require('../utils/logger');

// Database configuration based on environment
const config = {
    development: {
        dialect: 'sqlite',
        storage: path.join(__dirname, '../database/development.db'),
        logging: (msg) => logger.debug(msg),
        define: {
            timestamps: true,
            underscored: true,
            freezeTableName: true
        }
    },
    test: {
        dialect: 'sqlite',
        storage: ':memory:',
        logging: false,
        define: {
            timestamps: true,
            underscored: true,
            freezeTableName: true
        }
    },
    production: {
        dialect: process.env.DB_DIALECT || 'postgres',
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        logging: false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            timestamps: true,
            underscored: true,
            freezeTableName: true
        },
        dialectOptions: {
            ssl: process.env.DB_SSL === 'true' ? {
                require: true,
                rejectUnauthorized: false
            } : false
        }
    }
};

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Create Sequelize instance
const sequelize = new Sequelize(dbConfig);

// Test database connection
async function testConnection() {
    try {
        await sequelize.authenticate();
        logger.info(`✅ Database connection established successfully (${env})`);
        return true;
    } catch (error) {
        logger.error('❌ Unable to connect to database:', error);
        return false;
    }
}

// Initialize database
async function initializeDatabase() {
    try {
        // Create database directory if using SQLite
        if (dbConfig.dialect === 'sqlite' && dbConfig.storage !== ':memory:') {
            const fs = require('fs');
            const dbDir = path.dirname(dbConfig.storage);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
                logger.info(`📁 Created database directory: ${dbDir}`);
            }
        }

        // Test connection
        await testConnection();

        // Sync models in development
        if (env === 'development') {
            await sequelize.sync({ alter: true });
            logger.info('🔄 Database models synchronized');
        }

        return sequelize;
    } catch (error) {
        logger.error('❌ Database initialization failed:', error);
        throw error;
    }
}

// Close database connection
async function closeDatabase() {
    try {
        await sequelize.close();
        logger.info('🔒 Database connection closed');
    } catch (error) {
        logger.error('❌ Error closing database:', error);
        throw error;
    }
}

// Export for use in other modules
module.exports = {
    sequelize,
    Sequelize,
    initializeDatabase,
    closeDatabase,
    testConnection
};