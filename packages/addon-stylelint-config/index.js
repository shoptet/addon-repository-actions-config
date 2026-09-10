/**
 * @shoptet/addon-stylelint-config — package entry point.
 *
 * Exports the stylelint config (plugins declared as required objects, see
 * `stylelint.config.js`) and the stylelint slice of `RELIABLE_RULES`.
 */

const config = require('./stylelint.config');
const { RELIABLE_RULES } = require('./reliable-rules');

module.exports = {
  configs: {
    recommended: config,
  },
  RELIABLE_RULES,
};
