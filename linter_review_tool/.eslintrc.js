module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: 'eslint:recommended',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['shoptet'],
  rules: {
    // ─────────────────────────────────────────────────────────────
    // Custom Shoptet rules (error → blocker, warn → recommendation)
    // ─────────────────────────────────────────────────────────────
    'shoptet/require-cache-path': 'error', // G6
    'shoptet/no-testid-selector': 'error', // B7 ❌
    'shoptet/no-settimeout-hack': 'error', // B5 ❌
    'shoptet/no-czech-comments': 'error', // I1 ❌
    'shoptet/no-core-overwrite': 'error', // B6 ❌
    'shoptet/prefer-fetch': 'warn', // E2 ⚠️
    'shoptet/no-redundant-checks': 'warn', // B4 ⚠️

    // ─────────────────────────────────────────────────────────────
    // Security & correctness (❌)
    // ─────────────────────────────────────────────────────────────
    'no-eval': 'error', // A1
    'no-implied-eval': 'error', // A1
    'no-script-url': 'error', // A1
    'no-param-reassign': ['error', { props: false }], // A3
    'eqeqeq': ['error', 'always'], // E4
    'no-console': 'error', // F3
    'no-unused-vars': [
      'error',
      { vars: 'all', args: 'after-used', ignoreRestSiblings: false },
    ], // F2
    'no-unreachable': 'error', // F2
    'no-unused-expressions': 'error', // F2
    // TDZ / use-before-define (catches ReferenceError on const/let/class used early)
    'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
    'no-var': 'error', // D1
    'no-implicit-globals': 'error', // D1
    'no-redeclare': 'error', // D1

    // ─────────────────────────────────────────────────────────────
    // Structure & complexity (C — mostly ⚠️, deep nesting ❌)
    // ─────────────────────────────────────────────────────────────
    'max-depth': ['error', 4], // C4 ❌
    'max-nested-callbacks': ['error', 3], // C4 ❌
    'max-lines': [
      'error',
      { max: 200, skipBlankLines: true, skipComments: true },
    ], // C1 ❌
    'max-lines-per-function': [
      'warn',
      { max: 50, skipBlankLines: true, skipComments: true },
    ], // C2
    'max-statements': ['warn', 20], // C2
    'complexity': ['warn', 10], // C2

    // ─────────────────────────────────────────────────────────────
    // JS best practices (E — ⚠️/💡)
    // ─────────────────────────────────────────────────────────────
    'prefer-const': 'warn', // D2
    'prefer-template': 'warn', // E1
    'no-useless-concat': 'warn', // E1
    'radix': 'warn', // E9
    'camelcase': ['warn', { properties: 'never' }], // I3

    // ─────────────────────────────────────────────────────────────
    // Misc safety nets
    // ─────────────────────────────────────────────────────────────
    'no-empty': 'off',
    'no-mixed-spaces-and-tabs': 'warn',
    'no-unexpected-multiline': 'off',
    'no-undef': 'off',
    'no-extend-native': 'warn', // B6-ish
    'no-global-assign': 'warn',
  },
  globals: {
    Shoptet: 'readonly',
    shoptet: 'readonly',
    dataLayer: 'readonly',
    screen: 'readonly',
    getShoptetDataLayer: 'readonly',
    $: 'readonly',
    jQuery: 'readonly',
  },
  overrides: [
    {
      files: ['*.config.js', 'webpack.config.js'],
      env: {
        node: true,
      },
      rules: {
        'no-console': 'off',
      },
    },
  ],
};
