import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import unusedImports from 'eslint-plugin-unused-imports';

const config = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.cache/**',
      'drizzle/**',
      'supabase/**',
      'testing/reports/**',
      'testing/data/**',
      'testing/temp/**',
      '**/*.d.ts',
      '**/*.config.js',
      '**/*.config.ts',
      'pnpm-lock.yaml',
      'package.json',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'unused-imports': unusedImports,
    },
    rules: {
      // Unused variables detection
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      
      // Unused imports detection
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      
      // No unused expressions
      '@typescript-eslint/no-unused-expressions': 'error',
      
      // Prefer const for variables that are never reassigned
      'prefer-const': 'error',
      
      // No var declarations
      'no-var': 'error',
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'unused-imports/no-unused-imports': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
];

export default config; 