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
  rules: {
    'no-console': 'error',

    'no-var': 'warn',
    'prefer-const': 'warn',

    'no-unused-vars': [
      'error',
      {
        vars: 'all',
        args: 'after-used',
        ignoreRestSiblings: false,
      },
    ],
    'no-unreachable': 'error',
    'no-unused-expressions': 'error',
    'no-empty': 'off',
    'max-depth': ['error', 5],

    'no-global-assign': 'warn',
    'no-native-reassign': 'warn',
    'no-extend-native': 'warn',
    'no-mixed-spaces-and-tabs': 'warn',
    'no-unexpected-multiline': 'off',
    'no-undef': 'warn',
    'no-redeclare': 'warn',
    complexity: ['warn', 10],
    'max-lines-per-function': [
      'warn',
      {
        max: 50,
        skipBlankLines: true,
        skipComments: true,
      },
    ],
  },
  globals: {
    Shoptet: 'readonly',
    shoptet: 'readonly',
    dataLayer: 'readonly',
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
