/**
 * Shoptet ESLint Plugin
 * Custom rules for Shoptet addon development.
 * Each rule maps to a section of PRIRUCKA.md (the review handbook).
 *
 * Only deterministic (near-zero-false-positive) rules live here — heuristic /
 * contextual checks are handled by the AI review skill, not the linter.
 */

module.exports = {
  rules: {
    'require-cache-path': require('./shoptet-require-cache'), // G6 cache
    'no-core-overwrite': require('./shoptet-no-core-overwrite'), // B6
    'no-redundant-checks': require('./shoptet-no-redundant-checks'), // B4
    'no-settimeout-hack': require('./shoptet-no-settimeout-hack'), // B5
    'no-testid-selector': require('./shoptet-no-testid-selector'), // B7
    'prefer-fetch': require('./shoptet-prefer-fetch'), // E2
    'no-czech-comments': require('./shoptet-no-czech-comments'), // I1
  },
};
