/**
 * H3. Minimum font size
 *
 * Shoptet enlarges fonts, so addons should keep a readable minimum. Flags
 * `font-size` declarations below the configured minimum for units that are
 * statically resolvable: px directly, and rem against the 16px browser-default
 * root (rem is always root-relative).
 *
 * Deliberately out of scope (documented, not accidental): `em` (for font-size
 * it resolves against the PARENT's size — a fixed root assumption produces
 * false positives, e.g. 0.5em under a 40px parent is 20px), percentages and
 * keywords (parent-relative too). `pt` is caught by shoptet/no-pt-unit.
 */

const stylelint = require('stylelint');

const ruleName = 'shoptet/min-font-size';
const messages = stylelint.utils.ruleMessages(ruleName, {
  tooSmall: (value, min) =>
    `Font size ${value} is below the ${min}px minimum — keep text readable (Shoptet enlarges fonts).`,
});

const SIZE_VALUE = /^(-?\d*\.?\d+)(px|rem)$/i;
// rem is compared against the 16px browser default root font size.
const ROOT_PX = 16;

const ruleFunction = (primary) => (root, result) => {
  const min = typeof primary === 'number' ? primary : 12;

  const validOptions = stylelint.utils.validateOptions(result, ruleName, {
    actual: primary,
    possible: [(value) => typeof value === 'number'],
  });
  if (!validOptions) return;

  function checkSize(decl, rawValue) {
    const match = SIZE_VALUE.exec(rawValue);
    if (!match) return;

    const unit = match[2].toLowerCase();
    const px = unit === 'px' ? parseFloat(match[1]) : parseFloat(match[1]) * ROOT_PX; // unit === 'rem'
    if (px < min) {
      stylelint.utils.report({
        result,
        ruleName,
        node: decl,
        word: rawValue,
        message: messages.tooSmall(rawValue, min),
      });
    }
  }

  root.walkDecls(/^font-size$/i, (decl) => {
    checkSize(decl, decl.value.trim());
  });

  // The `font` shorthand sets the size too (`font: 8px Arial`) — the size is
  // the first length token, optionally with a /line-height suffix.
  root.walkDecls(/^font$/i, (decl) => {
    for (const token of decl.value.trim().split(/\s+/)) {
      const sizePart = token.split('/')[0];
      if (SIZE_VALUE.test(sizePart)) {
        checkSize(decl, sizePart);
        break;
      }
    }
  });
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;

module.exports = stylelint.createPlugin(ruleName, ruleFunction);
