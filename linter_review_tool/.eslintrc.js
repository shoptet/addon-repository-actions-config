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
    'shoptet/no-testid-selector': 'error', // B7 ❌
    'shoptet/no-settimeout-hack': 'error', // B5 ❌
    'shoptet/no-core-overwrite': 'error', // B6 ❌
    'shoptet/no-czech-comments': 'warn', // I1 ⚠️ (heuristic — reduced FP, non-gating)
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
    // F3 ❌ — window./globalThis./self.console would bypass core no-console
    'shoptet/no-global-console': 'error',
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
    // C1 ⚠️ per the catalog: length alone does not block — the monolith call
    // (cohesion, structure) belongs to the AI/human pass.
    'max-lines': [
      'warn',
      { max: 400, skipBlankLines: true, skipComments: true },
    ],
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
    // Deliberately off despite catalog D1: detection is deterministic, but a
    // positive finding is only as true as the globals list below — and the
    // Shoptet runtime injects globals (core functions, per-template) that we
    // cannot enumerate exhaustively. That breaks the zero-false-positive bar
    // required for this profile ("too many undefs" — original main).
    'no-undef': 'off',
    'no-extend-native': 'warn', // B6-ish
    // B6 ❌ — `shoptet = {}` (replacing the whole core object) must gate just
    // like overwriting a single property does (shoptet/no-core-overwrite).
    'no-global-assign': 'error',
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
};
