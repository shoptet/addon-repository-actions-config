/**
 * H3. Minimum font size
 *
 * Shoptet enlarges fonts, so addons should keep a readable minimum. Flags
 * `font-size` declarations below the configured minimum for absolute-ish
 * units: px directly, and rem/em against the 16px browser-default root.
 *
 * Deliberately out of scope (documented, not accidental): percentages and
 * keywords — they resolve against the parent's size, which is unknowable
 * statically. `pt` is caught separately by unit-disallowed-list.
 */

const stylelint = require('stylelint');

const ruleName = 'shoptet/min-font-size';
const messages = stylelint.utils.ruleMessages(ruleName, {
  tooSmall: (value, min) =>
    `Font size ${value} is below the ${min}px minimum — keep text readable (Shoptet enlarges fonts).`,
});

const SIZE_VALUE = /^(-?\d*\.?\d+)(px|rem|em)$/i;
// rem/em are compared against the 16px browser default root font size.
const ROOT_PX = 16;

const ruleFunction = (primary) => (root, result) => {
  const min = typeof primary === 'number' ? primary : 12;

  const validOptions = stylelint.utils.validateOptions(result, ruleName, {
    actual: primary,
    possible: [(value) => typeof value === 'number'],
  });
  if (!validOptions) return;

  root.walkDecls(/^font-size$/i, (decl) => {
    const match = SIZE_VALUE.exec(decl.value.trim());
    if (!match) return;

    const unit = match[2].toLowerCase();
    const px = unit === 'px' ? parseFloat(match[1]) : parseFloat(match[1]) * ROOT_PX;
    if (px < min) {
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
