/**
 * B7. Disallow binding to data-testid attributes — stylesheet counterpart of
 * the ESLint rule of the same name. A CSS selector `[data-testid="x"]` binds
 * to a testid just as effectively as a querySelector call; Shoptet does not
 * guarantee testid stability, so addon styles must target regular classes.
 */

const stylelint = require('stylelint');

const ruleName = 'shoptet/no-testid-selector';
const messages = stylelint.utils.ruleMessages(ruleName, {
  testid:
    'Do not bind styles to data-testid — its stability is not guaranteed. Use a regular CSS class instead.',
});

const TESTID_PATTERN = /\[\s*data-testid/i;

const ruleFunction = (primary) => (root, result) => {
  const validOptions = stylelint.utils.validateOptions(result, ruleName, {
    actual: primary,
    possible: [true],
  });
  if (!validOptions) return;

  root.walkRules((rule) => {
    if (TESTID_PATTERN.test(rule.selector)) {
      stylelint.utils.report({
        result,
        ruleName,
        node: rule,
        message: messages.testid,
      });
    }
  });
};

ruleFunction.ruleName = ruleName;
ruleFunction.messages = messages;

module.exports = stylelint.createPlugin(ruleName, ruleFunction);
