const { sequelize } = require("../config/database");

// Import models
const User = require("./User");
const Zone = require("./Zone");
const SecurityConfig = require("./SecurityConfig");
const AuditLog = require("./AuditLog");

// Define associations
const defineAssociations = () => {
    // User associations
    User.hasMany(Zone, {
        foreignKey: "user_id",
        as: "zones",
        onDelete: "CASCADE",
    });

    User.hasMany(AuditLog, {
        foreignKey: "user_id",
        as: "audit_logs",
        onDelete: "CASCADE",
    });

    // Zone associations
    Zone.belongsTo(User, {
        foreignKey: "user_id",
        as: "user",
    });

    Zone.hasOne(SecurityConfig, {
        foreignKey: "zone_id",
        as: "security_config",
        onDelete: "CASCADE",
    });

    Zone.hasMany(AuditLog, {
        foreignKey: "zone_id",
        as: "audit_logs",
        onDelete: "CASCADE",
    });

    // SecurityConfig associations
    SecurityConfig.belongsTo(Zone, {
        foreignKey: "zone_id",
        as: "zone",
    });

    SecurityConfig.belongsTo(User, {
        foreignKey: "last_modified_by",
        as: "last_modifier",
    });

    // AuditLog associations
    AuditLog.belongsTo(User, {
        foreignKey: "user_id",
        as: "user",
    });

    AuditLog.belongsTo(Zone, {
        foreignKey: "zone_id",
        as: "zone",
    });
};

// Initialize associations
defineAssociations();

// Sync models (only in development)
const syncModels = async () => {
    try {
        if (process.env.NODE_ENV === "development") {
            await sequelize.sync({ alter: true });
            console.log("📊 All models synchronized successfully");
        }
    } catch (error) {
        console.error("❌ Error synchronizing models:", error);
        throw error;
    }
};

// Export models and utilities
module.exports = {
    // Database instance
    sequelize,

    // Models
    User,
    Zone,
    SecurityConfig,
    AuditLog,

    // Utilities
    syncModels,
    defineAssociations,
};
