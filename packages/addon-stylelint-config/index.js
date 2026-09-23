/**
 * @shoptet/addon-stylelint-config — package entry point.
 *
 * Exports the stylelint config (plugins declared as required objects, see
 * `stylelint.config.js`), the stylelint slice of `RELIABLE_RULES`, and
 * `RUNNER_RULES` (the subset of that slice the runner — not this package —
 * has to emit).
 */

const config = require('./stylelint.config');
const { RELIABLE_RULES, RUNNER_RULES } = require('./reliable-rules');

module.exports = {
  configs: {
    recommended: config,
  },
  RELIABLE_RULES,
  RUNNER_RULES,
};
