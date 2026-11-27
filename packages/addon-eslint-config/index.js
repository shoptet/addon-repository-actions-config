/**
 * @shoptet/addon-eslint-config — package entry point.
 *
 * Exports the flat config (with the `shoptet` plugin already declared on it),
 * the plugin object standalone (for consumers that need it separately),
 * `parsesAsScript` (used independently of the plugin by
 * `linter_review_tool/linters/eslint-linter.js` to detect script-vs-module
 * files), `globalCommentLocations` / `isInsideComment` /
 * `isRedundantGlobalReport` / `isUnusedGlobalReport` (the parser-located
 * `/* global *\/` comments the runner drops redundant no-redeclare and
 * no-unused-vars reports in), `moduleSpecifiers` (the static import/require
 * specifiers `linter_review_tool/review.js` follows to lint a skipped test
 * file that production code imports), the ESLint slice of `RELIABLE_RULES`,
 * and `RUNNER_RULES` (the subset of that slice the runner — not this package
 * — has to emit).
 */

const flatConfig = require('./eslint.flat.config');
const plugin = require('./rules');
const { parsesAsScript } = require('./rules/script-detect');
const {
  globalCommentLocations,
  isInsideComment,
  isRedundantGlobalReport,
  isUnusedGlobalReport,
} = require('./rules/global-comments');
const { moduleSpecifiers } = require('./rules/module-specifiers');
const { RELIABLE_RULES, RUNNER_RULES } = require('./reliable-rules');

module.exports = {
  configs: {
    recommended: flatConfig,
  },
  plugin,
  parsesAsScript,
  globalCommentLocations,
  isInsideComment,
  isRedundantGlobalReport,
  isUnusedGlobalReport,
  moduleSpecifiers,
  RELIABLE_RULES,
  RUNNER_RULES,
};
