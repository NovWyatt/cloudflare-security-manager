module.exports = {
    root: true,
    env: {
        browser: true,
        es2020: true,
        node: true
    },
    extends: [
        'eslint:recommended',
        '@typescript-eslint/recommended',
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
    ],
    ignorePatterns: [
        'dist',
        '.eslintrc.cjs',
        'node_modules',
        'coverage',
        'build',
        '*.config.js',
        '*.config.ts'
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
            jsx: true
        }
    },
    settings: {
        react: {
            version: '18.2'
        }
    },
    plugins: [
        'react-refresh',
        '@typescript-eslint',
        'react',
        'react-hooks'
    ],
    rules: {
        // React specific rules
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off', // We use TypeScript for prop validation
        'react/display-name': 'off',
        'react/no-unescaped-entities': 'warn',
        'react/jsx-uses-react': 'off',
        'react/jsx-uses-vars': 'error',
        'react/jsx-key': 'error',
        'react/jsx-no-duplicate-props': 'error',
        'react/jsx-no-undef': 'error',
        'react/jsx-pascal-case': 'warn',
        'react/no-array-index-key': 'warn',
        'react/no-children-prop': 'error',
        'react/no-danger-with-children': 'error',
        'react/no-deprecated': 'warn',
        'react/no-direct-mutation-state': 'error',
        'react/no-find-dom-node': 'warn',
        'react/no-is-mounted': 'error',
        'react/no-render-return-value': 'error',
        'react/no-string-refs': 'error',
        'react/no-unknown-property': 'error',
        'react/no-unsafe': 'warn',
        'react/require-render-return': 'error',
        'react/self-closing-comp': 'warn',

        // React Hooks rules
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',

        // React Refresh
        'react-refresh/only-export-components': [
            'warn',
            { allowConstantExport: true },
        ],

        // TypeScript specific rules
        '@typescript-eslint/no-unused-vars': [
            'warn',
            {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                ignoreRestSiblings: true
            }
        ],
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-non-null-assertion': 'warn',
        '@typescript-eslint/ban-ts-comment': 'warn',
        '@typescript-eslint/prefer-const': 'error',
        '@typescript-eslint/no-var-requires': 'off',

        // General JavaScript/TypeScript rules
        'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
        'no-alert': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'no-unused-vars': 'off', // Use TypeScript version instead
        'no-undef': 'off', // TypeScript handles this
        'no-redeclare': 'off', // TypeScript handles this
        'no-dupe-class-members': 'off', // TypeScript handles this
        'no-unreachable': 'error',
        'no-constant-condition': 'warn',
        'no-empty': 'warn',
        'no-extra-boolean-cast': 'warn',
        'no-extra-semi': 'error',
        'no-irregular-whitespace': 'error',
        'no-sparse-arrays': 'error',
        'use-isnan': 'error',
        'valid-typeof': 'error',

        // Code style rules
        'indent': ['warn', 2, { SwitchCase: 1 }],
        'quotes': ['warn', 'single', { avoidEscape: true }],
        'semi': ['error', 'always'],
        'comma-dangle': ['warn', 'never'],
        'comma-spacing': ['warn', { before: false, after: true }],
        'comma-style': ['warn', 'last'],
        'computed-property-spacing': ['warn', 'never'],
        'eol-last': 'warn',
        'func-call-spacing': ['warn', 'never'],
        'key-spacing': ['warn', { beforeColon: false, afterColon: true }],
        'keyword-spacing': 'warn',
        'no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1 }],
        'no-trailing-spaces': 'warn',
        'object-curly-spacing': ['warn', 'always'],
        'space-before-blocks': 'warn',
        'space-before-function-paren': ['warn', {
            anonymous: 'always',
            named: 'never',
            asyncArrow: 'always'
        }],
        'space-in-parens': ['warn', 'never'],
        'space-infix-ops': 'warn',
        'space-unary-ops': 'warn',

        // Best practices
        'array-callback-return': 'error',
        'block-scoped-var': 'error',
        'consistent-return': 'warn',
        'curly': ['error', 'multi-line'],
        'default-case': 'warn',
        'dot-notation': 'warn',
        'eqeqeq': ['error', 'smart'],
        'guard-for-in': 'warn',
        'no-caller': 'error',
        'no-case-declarations': 'error',
        'no-div-regex': 'warn',
        'no-else-return': 'warn',
        'no-empty-function': 'warn',
        'no-empty-pattern': 'error',
        'no-eval': 'error',
        'no-extend-native': 'error',
        'no-extra-bind': 'warn',
        'no-fallthrough': 'error',
        'no-floating-decimal': 'warn',
        'no-global-assign': 'error',
        'no-implied-eval': 'error',
        'no-iterator': 'error',
        'no-labels': 'error',
        'no-lone-blocks': 'warn',
        'no-loop-func': 'warn',
        'no-multi-spaces': 'warn',
        'no-multi-str': 'warn',
        'no-new': 'warn',
        'no-new-func': 'error',
        'no-new-wrappers': 'error',
        'no-octal': 'error',
        'no-octal-escape': 'error',
        'no-proto': 'error',
        'no-return-assign': 'error',
        'no-script-url': 'error',
        'no-self-assign': 'error',
        'no-self-compare': 'error',
        'no-sequences': 'error',
        'no-throw-literal': 'error',
        'no-unmodified-loop-condition': 'warn',
        'no-unused-expressions': 'warn',
        'no-useless-call': 'warn',
        'no-useless-concat': 'warn',
        'no-useless-escape': 'warn',
        'no-void': 'error',
        'no-with': 'error',
        'prefer-promise-reject-errors': 'warn',
        'radix': 'warn',
        'wrap-iife': 'error',
        'yoda': 'warn',

        // ES6+ rules
        'arrow-spacing': 'warn',
        'constructor-super': 'error',
        'no-class-assign': 'error',
        'no-const-assign': 'error',
        'no-dupe-args': 'error',
        'no-dupe-keys': 'error',
        'no-duplicate-case': 'error',
        'no-duplicate-imports': 'warn',
        'no-new-symbol': 'error',
        'no-this-before-super': 'error',
        'no-useless-computed-key': 'warn',
        'no-useless-constructor': 'warn',
        'no-useless-rename': 'warn',
        'no-var': 'error',
        'object-shorthand': 'warn',
        'prefer-arrow-callback': 'warn',
        'prefer-const': 'error',
        'prefer-destructuring': ['warn', {
            array: false,
            object: true
        }],
        'prefer-rest-params': 'warn',
        'prefer-spread': 'warn',
        'prefer-template': 'warn',
        'rest-spread-spacing': 'warn',
        'template-curly-spacing': 'warn'
    },

    // Override rules for specific file patterns
    overrides: [
        {
            files: ['*.js'],
            rules: {
                '@typescript-eslint/no-var-requires': 'off'
            }
        },
        {
            files: ['*.test.js', '*.test.jsx', '*.test.ts', '*.test.tsx'],
            env: {
                jest: true
            },
            rules: {
                'no-console': 'off'
            }
        },
        {
            files: ['vite.config.*', 'tailwind.config.*', 'postcss.config.*'],
            rules: {
                '@typescript-eslint/no-var-requires': 'off',
                'no-undef': 'off'
            }
        }
    ]
};