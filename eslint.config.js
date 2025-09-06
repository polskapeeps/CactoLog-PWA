import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 2021,
      globals: { ...globals.browser, BarcodeDetector: 'readonly' }
    }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: { sourceType: 'module', ecmaVersion: 2021, globals: globals.node }
  }
];
