const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },

    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: {
                msg: 'Please provide a valid email address'
            },
            len: {
                args: [5, 255],
                msg: 'Email must be between 5 and 255 characters'
            }
        }
    },

    password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: {
                args: [6, 255],
                msg: 'Password must be at least 6 characters long'
            }
        }
    },

    name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: {
                args: [2, 100],
                msg: 'Name must be between 2 and 100 characters'
            }
        }
    },

    role: {
        type: DataTypes.ENUM('user', 'premium', 'admin'),
        defaultValue: 'user',
        allowNull: false
    },

    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },

    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },

    verification_token: {
        type: DataTypes.STRING,
        allowNull: true
    },

    reset_password_token: {
        type: DataTypes.STRING,
        allowNull: true
    },

    reset_password_expires: {
        type: DataTypes.DATE,
        allowNull: true
    },

    last_login: {
        type: DataTypes.DATE,
        allowNull: true
    },

    login_attempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    },

    locked_until: {
        type: DataTypes.DATE,
        allowNull: true
    },

    preferences: {
        type: DataTypes.JSON,
        defaultValue: {
            theme: 'light',
            notifications: {
                email: true,
                security_alerts: true,
                weekly_reports: false
            },
            dashboard: {
                default_view: 'overview',
                auto_refresh: true,
                refresh_interval: 30
            }
        }
    },

    api_usage: {
        type: DataTypes.JSON,
        defaultValue: {
            requests_today: 0,
            requests_this_month: 0,
            last_reset: new Date().toISOString()
        }
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',

    // Indexes for performance
    indexes: [
        {
            unique: true,
            fields: ['email']
        },
        {
            fields: ['is_active']
        },
        {
            fields: ['role']
        },
        {
            fields: ['verification_token']
        },
        {
            fields: ['reset_password_token']
        }
    ],

    // Hooks
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
                user.password = await bcrypt.hash(user.password, salt);
            }
        },

        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

// Instance methods
User.prototype.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Password comparison failed');
    }
};

User.prototype.generateAuthToken = function () {
    const payload = {
        userId: this.id,
        email: this.email,
        role: this.role
    };

    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
};

User.prototype.generateRefreshToken = function () {
    const payload = {
        userId: this.id,
        type: 'refresh'
    };

    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
    });
};

User.prototype.generatePasswordResetToken = function () {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    this.reset_password_token = token;
    this.reset_password_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    return token;
};

User.prototype.generateVerificationToken = function () {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    this.verification_token = token;

    return token;
};

User.prototype.isLocked = function () {
    return this.locked_until && this.locked_until > new Date();
};

User.prototype.incrementLoginAttempts = async function () {
    const maxAttempts = 5;
    const lockTime = 30 * 60 * 1000; // 30 minutes

    // If we have a previous lock that has expired, restart at 1
    if (this.locked_until && this.locked_until < new Date()) {
        return this.update({
            login_attempts: 1,
            locked_until: null
        });
    }

    const updates = { login_attempts: this.login_attempts + 1 };

    // If we just hit the max attempts and don't have a lock, set one
    if (updates.login_attempts >= maxAttempts && !this.isLocked()) {
        updates.locked_until = new Date(Date.now() + lockTime);
    }

    return this.update(updates);
};

User.prototype.resetLoginAttempts = async function () {
    return this.update({
        login_attempts: 0,
        locked_until: null,
        last_login: new Date()
    });
};

User.prototype.updateApiUsage = async function () {
    const now = new Date();
    const today = now.toDateString();
    const usage = this.api_usage || {};

    // Reset daily counter if it's a new day
    if (usage.last_reset && new Date(usage.last_reset).toDateString() !== today) {
        usage.requests_today = 0;
    }

    // Reset monthly counter if it's a new month
    if (usage.last_reset && new Date(usage.last_reset).getMonth() !== now.getMonth()) {
        usage.requests_this_month = 0;
    }

    usage.requests_today = (usage.requests_today || 0) + 1;
    usage.requests_this_month = (usage.requests_this_month || 0) + 1;
    usage.last_reset = now.toISOString();

    return this.update({ api_usage: usage });
};

User.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());

    // Remove sensitive fields
    delete values.password;
    delete values.reset_password_token;
    delete values.verification_token;

    return values;
};

// Class methods
User.findByEmail = function (email) {
    return this.findOne({
        where: { email: email.toLowerCase() }
    });
};

User.findByResetToken = function (token) {
    return this.findOne({
        where: {
            reset_password_token: token,
            reset_password_expires: {
                [sequelize.Sequelize.Op.gt]: new Date()
            }
        }
    });
};

User.findByVerificationToken = function (token) {
    return this.findOne({
        where: {
            verification_token: token,
            is_verified: false
        }
    });
};

module.exports = User;