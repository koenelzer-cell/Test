// ESLint (npm run lint). De aanbevolen regels staan voorlopig op waarschuwing,
// tot de bestaande code eraan voldoet; wat al overal klopt, is een fout.
import js from '@eslint/js';
import globals from 'globals';

const waarschuwing = Object.fromEntries(Object.keys(js.configs.recommended.rules).map((r) => [r, 'warn']));

export default [
  { ignores: ['dist/', 'test/build/', 'release/', 'node_modules/', 'playwright-report/', 'test-results/', 'tools/beheer/'] },
  {
    files: ['**/*.{js,mjs,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...waarschuwing,
      'no-var': 'error',
    },
  },
  {
    files: ['src/**/*.{js,jsx}', 'e2e/**'],
    languageOptions: { globals: { ...globals.browser, ...globals.webextensions } },
  },
  {
    files: ['scripts/**', 'test/**', 'e2e/**/*.mjs', 'server/**', '*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  { files: ['server/**/*.js', 'e2e/nep-chrome.js'], languageOptions: { sourceType: 'script' } },
];
