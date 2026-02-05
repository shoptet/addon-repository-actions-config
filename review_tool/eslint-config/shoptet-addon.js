module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: "eslint:recommended",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  rules: {
    "no-console": "error",
    
    "no-var": "error",
    "prefer-const": "error",
    
    "no-unused-vars": ["error", {
      vars: "all",
      args: "after-used",
      ignoreRestSiblings: false
    }],
    "no-unreachable": "error",
    "no-unused-expressions": "error",
    
    "max-depth": ["error", 4],
    
    "no-global-assign": "warn",
    "no-native-reassign": "error",
    "no-extend-native": "error",
    "no-mixed-spaces-and-tabs": "warn",
    
    "no-undef": "error",
    "no-redeclare": "error",
    "complexity": ["warn", 10],
    "max-lines-per-function": ["warn", {
      max: 50,
      skipBlankLines: true,
      skipComments: true
    }]
  },
  globals: {
    Shoptet: "readonly",
    shoptet: "readonly",
    dataLayer: "readonly",
    $: "readonly",
    jQuery: "readonly"
  },
  overrides: [
    {
      files: ["*.config.js", "webpack.config.js"],
      env: {
        node: true
      },
      rules: {
        "no-console": "off"
      }
    }
  ]
};
