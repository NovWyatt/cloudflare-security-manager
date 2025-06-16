import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],

    // Development server configuration
    server: {
        port: 3000,
        host: true, // Expose to network
        open: true, // Auto open browser
        cors: true,
        proxy: {
            // Proxy API requests to backend
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
                secure: false,
                timeout: 60000,
                configure: (proxy, _options) => {
                    proxy.on('error', (err, _req, _res) => {
                        console.log('Proxy error', err);
                    });
                    proxy.on('proxyReq', (proxyReq, req, _res) => {
                        console.log('Sending Request to the Target:', req.method, req.url);
                    });
                    proxy.on('proxyRes', (proxyRes, req, _res) => {
                        console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
                    });
                },
            }
        }
    },

    // Preview server configuration (for production build testing)
    preview: {
        port: 4173,
        host: true,
        cors: true
    },

    // Build configuration
    build: {
        outDir: 'dist',
        sourcemap: true,
        minify: 'terser',
        target: 'es2015',
        rollupOptions: {
            output: {
                manualChunks: {
                    // Vendor chunk for React and related libraries
                    vendor: ['react', 'react-dom'],
                    // UI chunk for common UI components
                    ui: ['lucide-react']
                }
            }
        },
        // Bundle size warnings
        chunkSizeWarningLimit: 1000,
        // Asset handling
        assetsDir: 'assets',
        // Copy public files
        copyPublicDir: true
    },

    // Path resolution
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
            '@components': resolve(__dirname, './src/components'),
            '@pages': resolve(__dirname, './src/pages'),
            '@hooks': resolve(__dirname, './src/hooks'),
            '@services': resolve(__dirname, './src/services'),
            '@utils': resolve(__dirname, './src/utils'),
            '@styles': resolve(__dirname, './src/styles'),
            '@context': resolve(__dirname, './src/context'),
            '@assets': resolve(__dirname, './src/assets')
        }
    },

    // CSS configuration
    css: {
        modules: {
            localsConvention: 'camelCase'
        },
        preprocessorOptions: {
            scss: {
                additionalData: `@import "@/styles/variables.scss";`
            }
        },
        postcss: {
            plugins: [
                require('tailwindcss'),
                require('autoprefixer')
            ]
        }
    },

    // Environment variables
    define: {
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
        __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    },

    // Optimization
    optimizeDeps: {
        include: [
            'react',
            'react-dom'
        ],
        exclude: []
    },

    // ESBuild configuration
    esbuild: {
        logOverride: { 'this-is-undefined-in-esm': 'silent' }
    }
})