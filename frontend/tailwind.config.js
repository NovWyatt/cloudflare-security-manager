/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class', // Enable class-based dark mode
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                    950: '#172554',
                },
                secondary: {
                    50: '#faf5ff',
                    100: '#f3e8ff',
                    200: '#e9d5ff',
                    300: '#d8b4fe',
                    400: '#c084fc',
                    500: '#a855f7',
                    600: '#9333ea',
                    700: '#7c3aed',
                    800: '#6b21a8',
                    900: '#581c87',
                    950: '#3b0764',
                },
                success: {
                    50: '#ecfdf5',
                    100: '#d1fae5',
                    200: '#a7f3d0',
                    300: '#6ee7b7',
                    400: '#34d399',
                    500: '#10b981',
                    600: '#059669',
                    700: '#047857',
                    800: '#065f46',
                    900: '#064e3b',
                    950: '#022c22',
                },
                warning: {
                    50: '#fffbeb',
                    100: '#fef3c7',
                    200: '#fde68a',
                    300: '#fcd34d',
                    400: '#fbbf24',
                    500: '#f59e0b',
                    600: '#d97706',
                    700: '#b45309',
                    800: '#92400e',
                    900: '#78350f',
                    950: '#451a03',
                },
                danger: {
                    50: '#fef2f2',
                    100: '#fee2e2',
                    200: '#fecaca',
                    300: '#fca5a5',
                    400: '#f87171',
                    500: '#ef4444',
                    600: '#dc2626',
                    700: '#b91c1c',
                    800: '#991b1b',
                    900: '#7f1d1d',
                    950: '#450a0a',
                },
                gray: {
                    50: '#f9fafb',
                    100: '#f3f4f6',
                    200: '#e5e7eb',
                    300: '#d1d5db',
                    400: '#9ca3af',
                    500: '#6b7280',
                    600: '#4b5563',
                    700: '#374151',
                    800: '#1f2937',
                    900: '#111827',
                    950: '#030712',
                }
            },
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                mono: ['Fira Code', 'ui-monospace', 'monospace'],
            },
            fontSize: {
                '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
                'xs': ['0.75rem', { lineHeight: '1rem' }],
                'sm': ['0.875rem', { lineHeight: '1.25rem' }],
                'base': ['1rem', { lineHeight: '1.5rem' }],
                'lg': ['1.125rem', { lineHeight: '1.75rem' }],
                'xl': ['1.25rem', { lineHeight: '1.75rem' }],
                '2xl': ['1.5rem', { lineHeight: '2rem' }],
                '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
                '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
                '5xl': ['3rem', { lineHeight: '1' }],
                '6xl': ['3.75rem', { lineHeight: '1' }],
                '7xl': ['4.5rem', { lineHeight: '1' }],
                '8xl': ['6rem', { lineHeight: '1' }],
                '9xl': ['8rem', { lineHeight: '1' }],
            },
            spacing: {
                '18': '4.5rem',
                '88': '22rem',
                '128': '32rem',
                '144': '36rem',
            },
            maxWidth: {
                '8xl': '88rem',
                '9xl': '96rem',
            },
            zIndex: {
                '60': '60',
                '70': '70',
                '80': '80',
                '90': '90',
                '100': '100',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-in-out',
                'fade-out': 'fadeOut 0.5s ease-in-out',
                'slide-in-right': 'slideInRight 0.3s ease-out',
                'slide-in-left': 'slideInLeft 0.3s ease-out',
                'slide-in-up': 'slideInUp 0.3s ease-out',
                'slide-in-down': 'slideInDown 0.3s ease-out',
                'bounce-slow': 'bounce 2s infinite',
                'pulse-slow': 'pulse 3s infinite',
                'spin-slow': 'spin 3s linear infinite',
                'wiggle': 'wiggle 1s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                fadeOut: {
                    '0%': { opacity: '1' },
                    '100%': { opacity: '0' },
                },
                slideInRight: {
                    '0%': { transform: 'translateX(100%)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                slideInLeft: {
                    '0%': { transform: 'translateX(-100%)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
                slideInUp: {
                    '0%': { transform: 'translateY(100%)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideInDown: {
                    '0%': { transform: 'translateY(-100%)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                wiggle: {
                    '0%, 100%': { transform: 'rotate(-3deg)' },
                    '50%': { transform: 'rotate(3deg)' },
                },
            },
            boxShadow: {
                'inner-lg': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.1)',
                'outline-blue': '0 0 0 3px rgba(59, 130, 246, 0.5)',
                'outline-red': '0 0 0 3px rgba(239, 68, 68, 0.5)',
                'outline-green': '0 0 0 3px rgba(16, 185, 129, 0.5)',
                'glow': '0 0 20px rgba(59, 130, 246, 0.3)',
                'glow-lg': '0 0 40px rgba(59, 130, 246, 0.4)',
            },
            backdropBlur: {
                xs: '2px',
                '3xl': '64px',
            },
            borderRadius: {
                '4xl': '2rem',
                '5xl': '2.5rem',
                '6xl': '3rem',
            },
            screens: {
                'xs': '475px',
                'sm': '640px',
                'md': '768px',
                'lg': '1024px',
                'xl': '1280px',
                '2xl': '1536px',
                '3xl': '1920px',
            },
            aspectRatio: {
                '4/3': '4 / 3',
                '3/2': '3 / 2',
                '2/3': '2 / 3',
                '9/16': '9 / 16',
            },
            gridTemplateColumns: {
                '13': 'repeat(13, minmax(0, 1fr))',
                '14': 'repeat(14, minmax(0, 1fr))',
                '15': 'repeat(15, minmax(0, 1fr))',
                '16': 'repeat(16, minmax(0, 1fr))',
            },
            gridTemplateRows: {
                '7': 'repeat(7, minmax(0, 1fr))',
                '8': 'repeat(8, minmax(0, 1fr))',
                '9': 'repeat(9, minmax(0, 1fr))',
                '10': 'repeat(10, minmax(0, 1fr))',
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/typography'),
        require('@tailwindcss/aspect-ratio'),
        // Custom plugin for additional utilities
        function ({ addUtilities, theme }) {
            const newUtilities = {
                '.text-gradient': {
                    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                    '-webkit-background-clip': 'text',
                    '-webkit-text-fill-color': 'transparent',
                    'background-clip': 'text',
                },
                '.gradient-primary': {
                    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                },
                '.gradient-success': {
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                },
                '.gradient-warning': {
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                },
                '.gradient-danger': {
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                },
                '.backdrop-blur-custom': {
                    'backdrop-filter': 'blur(12px)',
                    '-webkit-backdrop-filter': 'blur(12px)',
                },
                '.glass': {
                    background: 'rgba(255, 255, 255, 0.1)',
                    'backdrop-filter': 'blur(10px)',
                    '-webkit-backdrop-filter': 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                },
                '.glass-dark': {
                    background: 'rgba(0, 0, 0, 0.1)',
                    'backdrop-filter': 'blur(10px)',
                    '-webkit-backdrop-filter': 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                },
                '.scrollbar-hide': {
                    '-ms-overflow-style': 'none',
                    'scrollbar-width': 'none',
                    '&::-webkit-scrollbar': {
                        display: 'none',
                    },
                },
                '.scrollbar-custom': {
                    '&::-webkit-scrollbar': {
                        width: '8px',
                        height: '8px',
                    },
                    '&::-webkit-scrollbar-track': {
                        background: theme('colors.gray.100'),
                        'border-radius': '4px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        background: theme('colors.gray.300'),
                        'border-radius': '4px',
                        '&:hover': {
                            background: theme('colors.gray.400'),
                        },
                    },
                },
                '.focus-ring': {
                    '&:focus': {
                        outline: 'none',
                        'box-shadow': '0 0 0 3px rgba(59, 130, 246, 0.5)',
                    },
                },
                '.btn-base': {
                    display: 'inline-flex',
                    'align-items': 'center',
                    'justify-content': 'center',
                    'border-radius': theme('borderRadius.lg'),
                    'font-weight': theme('fontWeight.medium'),
                    'transition-property': 'all',
                    'transition-duration': '200ms',
                    'transition-timing-function': 'ease-in-out',
                    '&:focus': {
                        outline: 'none',
                        'box-shadow': '0 0 0 3px rgba(59, 130, 246, 0.5)',
                    },
                    '&:disabled': {
                        opacity: '0.5',
                        cursor: 'not-allowed',
                    },
                },
            };

            addUtilities(newUtilities);
        },
    ],
}