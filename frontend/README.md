# 🛡️ Cloudflare Security Manager - Frontend

A modern, responsive React application for managing Cloudflare security settings, analytics, and zone configurations.

## ✨ Features

### 🔐 **Security Management**
- **Security Level Control** - From Off to Under Attack Mode
- **SSL/TLS Configuration** - Flexible to Full (Strict) modes
- **Bot Protection** - Fight Mode and Super Bot Fight Mode
- **Firewall Rules** - Create, edit, and manage custom rules
- **Real-time Security Analytics** - Threat monitoring and reporting

### 📊 **Analytics Dashboard**
- **Traffic Analytics** - Requests, bandwidth, and visitor metrics
- **Performance Monitoring** - Cache hit ratios and response times
- **Threat Analytics** - Security event breakdown and trends
- **Geographic Data** - Top visitor countries and regions
- **Export Functionality** - CSV/JSON data export

### ⚙️ **Settings & Configuration**
- **Profile Management** - User account and password settings
- **Notification Preferences** - Email, Slack, Discord integrations
- **API Key Management** - Create and manage integration keys
- **Backup & Restore** - Automatic and manual configuration backups
- **Security Controls** - 2FA, session management, IP restrictions

### 🎨 **Modern UI/UX**
- **Dark/Light Mode** - Automatic theme switching
- **Responsive Design** - Mobile-first approach
- **Real-time Updates** - Live status indicators
- **Accessibility** - WCAG 2.1 compliant
- **Performance Optimized** - Code splitting and lazy loading

## 🚀 Quick Start

### Prerequisites

- **Node.js** 16.0.0 or higher
- **npm** 8.0.0 or higher (or **yarn** 1.22.0+)
- **Git** for version control

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/cloudflare-security-manager.git
   cd cloudflare-security-manager/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your configuration:
   ```env
   VITE_API_URL=http://localhost:5000/api
   VITE_APP_NAME=Cloudflare Security Manager
   VITE_APP_VERSION=1.0.0
   ```

4. **Start development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 📁 Project Structure

```
frontend/
├── 📄 index.html                    # HTML entry point
├── 📄 package.json                  # Dependencies and scripts
├── 📄 vite.config.js                # Vite configuration
├── 📄 tailwind.config.js            # Tailwind CSS config
├── 📄 postcss.config.js             # PostCSS configuration
├── 📄 .eslintrc.cjs                 # ESLint rules
├── 📄 .prettierrc                   # Prettier formatting
├── 📄 .gitignore                    # Git ignore rules
└── src/
    ├── 📄 main.jsx                  # Application entry point
    ├── 📄 App.jsx                   # Main application component
    ├── pages/
    │   ├── 📄 Security.jsx          # Security management page
    │   ├── 📄 Analytics.jsx         # Analytics dashboard
    │   └── 📄 Settings.jsx          # Settings and preferences
    └── styles/
        └── 📄 globals.css           # Global styles and Tailwind
```

## 🛠️ Development

### Available Scripts

- **`npm run dev`** - Start development server
- **`npm run build`** - Build for production
- **`npm run preview`** - Preview production build
- **`npm run lint`** - Run ESLint
- **`npm run lint:fix`** - Fix ESLint issues
- **`npm run format`** - Format code with Prettier
- **`npm run format:check`** - Check code formatting

### Development Guidelines

#### **Code Style**
- Use **functional components** with hooks
- Follow **camelCase** for variables and functions
- Use **PascalCase** for component names
- Prefer **arrow functions** for consistency
- Use **destructuring** for props and state

#### **Component Structure**
```jsx
import React, { useState, useEffect } from 'react';

const MyComponent = ({ prop1, prop2 }) => {
  const [state, setState] = useState(initialValue);

  useEffect(() => {
    // Side effects
  }, [dependencies]);

  const handleAction = () => {
    // Event handlers
  };

  return (
    <div className="component-container">
      {/* JSX content */}
    </div>
  );
};

export default MyComponent;
```

#### **Styling Guidelines**
- Use **Tailwind CSS** utility classes
- Follow **mobile-first** responsive design
- Use **dark mode** classes when needed
- Keep components **self-contained**

```jsx
// Good: Responsive with dark mode
<div className="p-4 bg-white dark:bg-gray-800 md:p-6 lg:p-8">
  <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
    Title
  </h1>
</div>
```

## 🏗️ Architecture

### **State Management**
- **React Context** for global state
- **useState/useReducer** for component state
- **Custom hooks** for reusable logic

### **API Integration**
- **Fetch API** with error handling
- **JWT Authentication** with auto-refresh
- **Request/Response interceptors**
- **Loading and error states**

### **Performance Optimization**
- **Code splitting** with React.lazy()
- **Image optimization** with lazy loading
- **Memoization** with React.memo()
- **Bundle analysis** with webpack-bundle-analyzer

## 🎨 Theming & Customization

### **Color Scheme**
```css
:root {
  --primary-blue: #3b82f6;
  --primary-purple: #8b5cf6;
  --success-green: #10b981;
  --warning-yellow: #f59e0b;
  --danger-red: #ef4444;
}
```

### **Typography**
- **Primary Font**: Inter (Google Fonts)
- **Monospace Font**: Fira Code
- **Font Sizes**: 2xs to 9xl scale
- **Font Weights**: 300-900

### **Custom Components**
All components support:
- ✅ Dark mode variants
- ✅ Responsive breakpoints
- ✅ Accessibility features
- ✅ Loading states
- ✅ Error boundaries

## 🧪 Testing

### **Testing Strategy**
- **Unit Tests**: Component functionality
- **Integration Tests**: User workflows
- **E2E Tests**: Critical user paths
- **Visual Tests**: Component snapshots

### **Testing Commands**
```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- MyComponent.test.jsx
```

## 🚀 Deployment

### **Production Build**
```bash
# Build for production
npm run build

# Preview production build locally
npm run preview
```

### **Environment Variables**
```env
# Production
VITE_API_URL=https://api.yourapp.com
VITE_APP_ENV=production

# Staging
VITE_API_URL=https://staging-api.yourapp.com
VITE_APP_ENV=staging
```

### **Deployment Platforms**

#### **Vercel** (Recommended)
```bash
npm install -g vercel
vercel --prod
```

#### **Netlify**
```bash
npm run build
# Upload dist/ folder to Netlify
```

#### **Static Hosting**
```bash
npm run build
# Upload dist/ folder to your hosting provider
```

## 🔧 Configuration

### **Vite Configuration**
- **Hot Module Replacement** for fast development
- **Proxy setup** for API calls
- **Bundle optimization** for production
- **Asset handling** and compression

### **Tailwind Configuration**
- **Custom color palette** with dark mode variants
- **Extended spacing** and typography scales
- **Custom animations** and utilities
- **Plugin ecosystem** integration

### **ESLint & Prettier**
- **React-specific rules** for best practices
- **TypeScript support** (ready for migration)
- **Import sorting** and organization
- **Consistent formatting** across team

## 📚 API Integration

### **Authentication**
```javascript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

// Authenticated requests
const token = localStorage.getItem('auth_token');
const response = await fetch('/api/zones', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### **Error Handling**
```javascript
try {
  const response = await fetch('/api/endpoint');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  return data;
} catch (error) {
  console.error('API Error:', error);
  // Handle error appropriately
}
```

## 🐛 Troubleshooting

### **Common Issues**

#### **Development Server Won't Start**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

#### **Build Fails**
```bash
# Check for type errors
npm run type-check

# Check for linting errors
npm run lint

# Clear Vite cache
rm -rf node_modules/.vite
npm run build
```

#### **API Connection Issues**
- Check `VITE_API_URL` in environment variables
- Verify backend server is running
- Check browser developer tools for CORS errors

#### **Styling Issues**
- Ensure Tailwind CSS is properly imported
- Check for conflicting CSS rules
- Verify dark mode classes are applied correctly

## 🤝 Contributing

### **Development Workflow**
1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Make** your changes
4. **Test** your changes (`npm test`)
5. **Lint** your code (`npm run lint:fix`)
6. **Commit** your changes (`git commit -m 'Add amazing feature'`)
7. **Push** to the branch (`git push origin feature/amazing-feature`)
8. **Open** a Pull Request

### **Commit Guidelines**
```
type(scope): description

Examples:
feat(auth): add two-factor authentication
fix(dashboard): resolve mobile layout issue
docs(readme): update installation instructions
style(components): format with prettier
refactor(api): simplify error handling
test(security): add firewall rule tests
```

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **React Team** for the amazing framework
- **Vite Team** for the fast build tool
- **Tailwind CSS** for the utility-first CSS framework
- **Cloudflare** for the inspiration and API

## 📞 Support

- **Documentation**: [GitHub Wiki](https://github.com/yourusername/cloudflare-security-manager/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/cloudflare-security-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/cloudflare-security-manager/discussions)
- **Email**: support@cloudflare-security-manager.com

---

**Built with Wyatt by the Cloudflare Security Manager Team**