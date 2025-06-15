#!/usr/bin/env node

/**
 * Database Setup Script for Cloudflare Security Manager
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

console.log('🗄️  Setting up Cloudflare Security Manager Database...');

const DB_PATH = path.join(__dirname, '../backend/database/app.db');
const SCHEMA_PATH = path.join(__dirname, '../database/migrations/001_initial.sql');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log('📁 Created database directory');
}

// Read schema file
let schema;
try {
    schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    console.log('📋 Schema file loaded');
} catch (error) {
    console.error('❌ Failed to read schema file:', error.message);
    process.exit(1);
}

// Create and setup database
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Failed to create database:', err.message);
        process.exit(1);
    }
    console.log('✅ Database connection established');
});

// Execute schema
db.exec(schema, (err) => {
    if (err) {
        console.error('❌ Failed to execute schema:', err.message);
        process.exit(1);
    }
    console.log('✅ Database schema created successfully');

    // Verify tables created
    db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
        if (err) {
            console.error('❌ Failed to verify tables:', err.message);
            process.exit(1);
        }

        console.log('📊 Tables created:');
        tables.forEach(table => {
            console.log(`   - ${table.name}`);
        });

        // Close database
        db.close((err) => {
            if (err) {
                console.error('❌ Failed to close database:', err.message);
                process.exit(1);
            }

            console.log('');
            console.log('🎉 ===============================================');
            console.log('✅ Database setup completed successfully!');
            console.log('🎉 ===============================================');
            console.log(`📍 Database location: ${DB_PATH}`);
            console.log('📊 Tables: users, zones, security_configs, audit_logs');
            console.log('👤 Default admin user created:');
            console.log('   Email: admin@cloudflare-manager.local');
            console.log('   Password: admin123');
            console.log('📋 Security templates installed');
            console.log('===============================================');
        });
    });
});