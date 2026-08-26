import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import js from '@eslint/js'

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        require: 'readonly',
        fetch: 'readonly',
        AbortSignal: 'readonly',
        Thenable: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // Start from ts-eslint recommended, which overrides base js rules
      // (e.g. no-undef is redundant under TS parser).
      ...tseslint.configs['eslint-recommended'].overrides?.[0]?.rules ?? {},
      ...tseslint.configs.recommended.rules,

      'semi': ['error', 'never'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      // Files using require() for optional native deps (tree-sitter, better-sqlite3)
      '@typescript-eslint/no-require-imports': 'off',
      'no-useless-assignment': 'off',
      // Webview template literals contain double-escaped regex for runtime JS
      'no-useless-escape': 'off',
    },
  },
  {
    ignores: ['dist/', 'out/', 'node_modules/', '*.js', '*.mjs', '.vscode-test/', 'coverage/'],
  },
]
