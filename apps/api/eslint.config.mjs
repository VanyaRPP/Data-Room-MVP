// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { baseRules } from '@dataroom/config/eslint-base.mjs';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  baseRules,
  {
    // CLI scripts (seeding, etc.), not request-handling code - console
    // output here is the intended interface, not a debugging leftover.
    files: ['prisma/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // `declare global { namespace Express { ... } }` is the standard way
      // to augment Express's Request type (see src/auth/decorators.ts) -
      // an ambient declaration, not the namespace-as-module anti-pattern
      // this rule targets.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
);
