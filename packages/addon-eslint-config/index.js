/**
 * @shoptet/addon-eslint-config — package entry point.
 *
 * Exports the flat config (with the `shoptet` plugin already declared on it),
 * the plugin object standalone (for consumers that need it separately),
 * `parsesAsScript` (used independently of the plugin by
 * `linter_review_tool/linters/eslint-linter.js` to detect script-vs-module
 * files), the ESLint slice of `RELIABLE_RULES`, and `RUNNER_RULES` (the
 * subset of that slice the runner — not this package — has to emit).
 */

const flatConfig = require('./eslint.flat.config');
const plugin = require('./rules');
const { parsesAsScript } = require('./rules/script-detect');
const { RELIABLE_RULES, RUNNER_RULES } = require('./reliable-rules');

module.exports = {
  configs: {
    recommended: flatConfig,
  },
  plugin,
  parsesAsScript,
  RELIABLE_RULES,
  RUNNER_RULES,
};
