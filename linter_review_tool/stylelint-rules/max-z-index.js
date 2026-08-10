/**
 * H1. Excessive z-index
 *
 * Huge z-index values ("z-index war") fight the eshop and other addons. Flags
 * numeric z-index declarations above the configured maximum.
 */

const stylelint = require('stylelint');

const ruleName = 'shoptet/max-z-index';
const messages = stylelint.utils.ruleMessages(ruleName, {
  tooHigh: (value, max) =>
    `z-index ${value} exceeds the ${max} maximum — avoid z-index wars with the eshop/other addons.`,
});

const ruleFunction = (primary) => (root, result) => {
  const max = typeof primary === 'number' ? primary : 100;

  const validOptions = stylelint.utils.validateOptions(result, ruleName, {
    actual: primary,
    possible: [(value) => typeof value === 'number'],
  });
  if (!validOptions) return;

  root.walkDecls(/^z-index$/i, (decl) => {
    const value = parseFloat(decl.value); // parseInt would read '1e9' as 1
    if (!Number.isNaN(value) && value > max) {
      stylelint.utils.report({
        result,
        ruleName,
        node: decl,
        word: decl.value,
        message: messages.tooHigh(decl.value.trim(), max),
      });
    }
  });
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;

module.exports = stylelint.createPlugin(ruleName, ruleFunction);
