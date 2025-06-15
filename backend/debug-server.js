/**
 * Debug version of server.js - step by step loading
 */

console.log('🔍 DEBUG: Starting server debug process...');

// Step 1: Load environment
console.log('📋 Step 1: Loading environment...');
require('dotenv').config();
console.log('✅ Environment loaded');
console.log('   NODE_ENV:', process.env.NODE_ENV);
console.log('   PORT:', process.env.PORT);

// Step 2: Test each module loading
console.log('📋 Step 2: Testing module imports...');

try {
  console.log('   🔧 Loading Express...');
  const express = require('express');
  console.log('   ✅ Express OK');
  
  console.log('   🔧 Loading CORS...');
  const cors = require('cors');
  console.log('   ✅ CORS OK');
  
  console.log('   🔧 Loading Helmet...');
  const helmet = require('helmet');
  console.log('   ✅ Helmet OK');
  
  console.log('   🔧 Loading compression...');
  const compression = require('compression');
  console.log('   ✅ Compression OK');
  
  console.log('   🔧 Loading morgan...');
  const morgan = require('morgan');
  console.log('   ✅ Morgan OK');
  
} catch (error) {
  console.error('❌ Basic module loading failed:', error);
  process.exit(1);
}

// Step 3: Test custom modules
console.log('📋 Step 3: Testing custom modules...');

try {
  console.log('   🔧 Loading logger...');
  const logger = require('./utils/logger');
  console.log('   ✅ Logger OK');
} catch (error) {
  console.error('   ❌ Logger failed:', error.message);
}

try {
  console.log('   🔧 Loading database config...');
  const { sequelize } = require('./config/database');
  console.log('   ✅ Database config OK');
} catch (error) {
  console.error('   ❌ Database config failed:', error.message);
}

try {
  console.log('   🔧 Loading error handler...');
  const { errorHandler } = require('./middleware/errorHandler');
  console.log('   ✅ Error handler OK');
} catch (error) {
  console.error('   ❌ Error handler failed:', error.message);
}

try {
  console.log('   🔧 Loading models...');
  const models = require('./models');
  console.log('   ✅ Models OK');
} catch (error) {
  console.error('   ❌ Models failed:', error.message);
}

// Step 4: Test app loading
console.log('📋 Step 4: Testing app.js...');

try {
  console.log('   🔧 Loading app.js...');
  const app = require('./app');
  console.log('   ✅ App.js loaded successfully!');
  
  // Start server
  const PORT = process.env.PORT || 3000;
  
  app.listen(PORT, () => {
    console.log('');
    console.log('🎉 ================================');
    console.log('✅ DEBUG SERVER STARTED!');
    console.log('🎉 ================================');
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log('✅ Main app.js works correctly!');
    console.log('================================');
  });
  
} catch (error) {
  console.error('❌ App.js loading failed:', error);
  console.error('📍 Error details:', error.message);
  console.log('📍 Stack trace:', error.stack);
}