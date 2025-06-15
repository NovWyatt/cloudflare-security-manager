#!/bin/bash

# Cloudflare Security Manager Setup Script

echo "🚀 Setting up Cloudflare Security Manager..."

# Create directory structure
echo "📁 Creating directory structure..."

# Backend directories
mkdir -p backend/{config,controllers,middleware,models,routes,services,utils,tests,logs,database}

# Frontend directories  
mkdir -p frontend/{public,src/{components,pages,hooks,services,context,utils,styles}}

# Shared directories
mkdir -p shared/{types,constants,utils}

# Other directories
mkdir -p {docs,scripts,docker}

echo "✅ Directory structure created!"

# Copy package.json files
echo "📦 Setting up package.json files..."

# Backend package.json already exists from previous artifacts

# Create basic README
echo "📝 Creating README.md..."
cat > README.md << 'EOF'
# Cloudflare Security Manager

A comprehensive tool to manage Cloudflare security settings with a beautiful web interface.

## Features

- 🛡️ Complete security settings management
- 📊 Real-time analytics and reporting  
- 🔧 Configuration import/export
- 📱 Responsive web interface
- 🔐 Secure API token encryption
- 📋 Comprehensive audit logging

## Quick Start

1. **Install dependencies:**
   ```bash
   npm run setup
   ```

2. **Configure environment:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Start development:**
   ```bash
   npm run dev
   ```

## Project Structure

```
cloudflare-security-manager/
├── backend/          # Node.js API server
├── frontend/         # React web application  
├── shared/           # Shared utilities
├── docs/            # Documentation
├── scripts/         # Setup scripts
└── docker/          # Docker configuration
```

## API Documentation

The API provides 41 endpoints across 5 main categories:
- Authentication (8 endpoints)
- Zone Management (15 endpoints) 
- Security Settings (8 endpoints)
- Analytics (6 endpoints)
- Configuration (7 endpoints)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details
EOF

echo "✅ README.md created!"

# Create .gitignore
echo "🚫 Creating .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Production builds
/frontend/dist/
/backend/build/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Database
/backend/database/*.db
/backend/database/*.sqlite

# Logs
/backend/logs/*.log
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Coverage
coverage/
*.lcov

# Temporary files
*.tmp
*.temp

# Backups
*.backup
*.bak

# Docker
.dockerignore
EOF

echo "✅ .gitignore created!"

# Make scripts executable
chmod +x scripts/*.sh

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. cd backend && npm install"
echo "2. cp backend/.env.example backend/.env"
echo "3. Edit backend/.env with your configuration"
echo "4. npm run dev"
echo ""
echo "Happy coding! 🚀"