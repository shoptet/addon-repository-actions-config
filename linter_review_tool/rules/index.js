/**
 * Shoptet ESLint Plugin
 * Custom rules for Shoptet addon development.
 * Each rule maps to a section of PRIRUCKA.md (the review handbook).
 */

module.exports = {
  rules: {
    'require-cache-path': require('./shoptet-require-cache'), // G6 cache
    'no-xss': require('./shoptet-no-xss'), // A1
    'no-attribute-injection': require('./shoptet-no-attribute-injection'), // A1 (attrs)
    'no-target-blank': require('./shoptet-no-target-blank'), // A5
    'no-core-overwrite': require('./shoptet-no-core-overwrite'), // B6
    'no-redundant-checks': require('./shoptet-no-redundant-checks'), // B4
    'no-settimeout-hack': require('./shoptet-no-settimeout-hack'), // B5
    'prefer-shoptet-init': require('./shoptet-prefer-shoptet-init'), // B5
    'no-testid-selector': require('./shoptet-no-testid-selector'), // B7
    'hardcoded-breakpoints': require('./shoptet-hardcoded-breakpoints'), // B2
    'prefer-fetch': require('./shoptet-prefer-fetch'), // E2
    'require-response-ok': require('./shoptet-require-response-ok'), // E8
    'localstorage-try-catch': require('./shoptet-localstorage-try-catch'), // E7
    'namespace': require('./shoptet-namespace'), // D4
    'no-commented-code': require('./shoptet-no-commented-code'), // F1
    'no-czech-comments': require('./shoptet-no-czech-comments'), // I1
    'no-czech-strings': require('./shoptet-no-czech-strings'), // I2/I4
    'a11y-html-strings': require('./shoptet-a11y-html-strings'), // J/H2
  },
};
