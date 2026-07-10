/**
 * H3. Minimum font size
 *
 * Shoptet enlarges fonts, so addons should keep a readable minimum. Flags
 * `font-size` declarations with a px value below the configured minimum.
 */

const stylelint = require('stylelint');

const ruleName = 'shoptet/min-font-size';
const messages = stylelint.utils.ruleMessages(ruleName, {
  tooSmall: (value, min) =>
    `Font size ${value} is below the ${min}px minimum — keep text readable (Shoptet enlarges fonts).`,
});

const PX_VALUE = /^(-?\d*\.?\d+)px$/i;

const ruleFunction = (primary) => (root, result) => {
  const min = typeof primary === 'number' ? primary : 12;

  const validOptions = stylelint.utils.validateOptions(result, ruleName, {
    actual: primary,
    possible: [(value) => typeof value === 'number'],
  });
  if (!validOptions) return;

  root.walkDecls(/^font-size$/i, (decl) => {
    const match = PX_VALUE.exec(decl.value.trim());
    if (!match) return;

    if (parseFloat(match[1]) < min) {
      stylelint.utils.report({
        result,
        ruleName,
        node: decl,
        word: decl.value,
        message: messages.tooSmall(decl.value.trim(), min),
      });
    }
  });
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;

module.exports = stylelint.createPlugin(ruleName, ruleFunction);
