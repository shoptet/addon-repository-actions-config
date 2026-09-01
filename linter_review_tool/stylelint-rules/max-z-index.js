/**
 * H1. Excessive z-index
 *
 * Huge z-index values ("z-index war") fight the eshop and other addons. Flags
 * numeric z-index declarations above the configured maximum.
 *
 * Deliberately NOT exempt inside @keyframes (unlike min-font-size): a z-index
 * in a keyframe is a real stacking value while the animation runs — an
 * animated jump above the cap still covers the shop's UI. A keyframe
 * font-size, by contrast, interpolates toward a resting value that is checked
 * where it is declared (decision, round 13).
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

  // Compare only when the WHOLE value is numeric — parseFloat would read just
  // the leading number of SCSS/LESS arithmetic ('200 - 150' → 200) and
  // false-positive on expressions that compute below the max.
  const NUMERIC_VALUE = /^[+-]?\d*\.?\d+(e\d+)?$/i;

  root.walkDecls(/^z-index$/i, (decl) => {
    const raw = decl.value.trim();
    if (!NUMERIC_VALUE.test(raw)) return;
    const value = parseFloat(raw);
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
