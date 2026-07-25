import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * One flat config for the whole monorepo. Each package's `lint` script runs
 * `eslint src` from its own directory; ESLint walks up to find this file, so
 * there is a single source of truth for rules.
 *
 * Type-aware linting is deliberately off: it would need a project service per
 * package and roughly triples lint time, and `pnpm typecheck` already runs the
 * real compiler over every package.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.d.ts',
      'gallery/**',
      'botanical-gallery/**',
      'packages/web/public/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // The codebase leans on leading-underscore names for deliberately
      // unused bindings (destructured rest, interface-shaped callbacks).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // `any` is used at a few genuine boundaries (the heterogeneous module
      // registry, worker message payloads) and each is already annotated with
      // an inline disable explaining why. Keep it an error so new ones argue
      // for themselves.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // Web: React hooks rules, browser globals, and worker files.
  {
    files: ['packages/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser, ...globals.worker },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Node-only surfaces.
  {
    files: ['packages/cli/**/*.ts', 'scripts/**/*.mjs', '*.js', '*.mjs'],
    languageOptions: { globals: globals.node },
  },

  // Tests may reach for looser typing when building fixtures.
  {
    files: ['**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
