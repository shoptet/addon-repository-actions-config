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

// A media query targets print only when a clause starts with (optionally
// "only") print — "not print" targets everything EXCEPT print and must not
// exempt anything.
function targetsPrint(params) {
  return (params || '').split(',').some((clause) => /^\s*(only\s+)?print\b/i.test(clause));
}

function isInsidePrintContext(decl) {
  for (let node = decl.parent; node; node = node.parent) {
    if (node.type !== 'atrule' || typeof node.name !== 'string') continue;
    const name = node.name.toLowerCase();
    // @page is inherently a print context — pt is the conventional unit there.
    if (name === 'page') return true;
    if (name === 'media' && targetsPrint(node.params)) return true;
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
    // SCSS variables ($invoice-size: 11pt) are definitions, not applied styles
    // — where they are USED decides the print context. (postcss-scss parses
    // them as declarations; the identical LESS idiom is an atrule and never
    // reached this walk — this also restores SCSS/LESS parity.)
    if (decl.prop.startsWith('$')) return;
    // Strings and url() tokens are prose/filenames, not measurements.
    const measurable = decl.value.replace(/"[^"]*"|'[^']*'|url\(\s*[^)]*\)/gi, ' ');
    if (!PT_VALUE.test(measurable)) return;
    if (isInsidePrintContext(decl)) return;
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
