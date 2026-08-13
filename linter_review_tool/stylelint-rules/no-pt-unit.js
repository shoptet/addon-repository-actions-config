/**
 * H1. Consistent units — no pt outside print styles.
 *
 * Replaces the stock unit-disallowed-list for `pt`: inside `@media print`
 * the point is the CORRECT unit, so a blanket ban false-positives on
 * legitimate print stylesheets. Everywhere else, use px.
 */

const stylelint = require('stylelint');

const ruleName = 'shoptet/no-pt-unit';
const messages = stylelint.utils.ruleMessages(ruleName, {
  noPt: 'Unexpected unit "pt" — use px (pt is allowed only inside @media print).',
});

// A number immediately followed by the pt unit (12pt, .5pt, 1.25pt).
const PT_VALUE = /(^|[\s,(/])[+-]?\d*\.?\d+pt(?![\w])/i;

function isInsidePrintMedia(decl) {
  for (let node = decl.parent; node; node = node.parent) {
    if (
      node.type === 'atrule' &&
      typeof node.name === 'string' &&
      node.name.toLowerCase() === 'media' &&
      /\bprint\b/i.test(node.params || '')
    ) {
      return true;
    }
  }
  return false;
}

const ruleFunction = (primary) => (root, result) => {
  const validOptions = stylelint.utils.validateOptions(result, ruleName, {
    actual: primary,
    possible: [true],
  });
  if (!validOptions) return;

  root.walkDecls((decl) => {
    if (!PT_VALUE.test(decl.value)) return;
    if (isInsidePrintMedia(decl)) return;
    stylelint.utils.report({
      result,
      ruleName,
      node: decl,
      word: decl.value,
      message: messages.noPt,
    });
  });
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;

module.exports = stylelint.createPlugin(ruleName, ruleFunction);
