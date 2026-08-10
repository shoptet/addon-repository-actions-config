/**
 * B4. Unnecessary checks of always-available Shoptet objects
 *
 * shoptet, dataLayer and screen are always defined in the browser, so guarding
 * them with `typeof x === 'undefined'` style checks is dead defensive code.
 */

const { isGlobalBinding } = require('./global-callee');

const ALWAYS_DEFINED = new Set(['shoptet', 'dataLayer', 'screen']);

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow redundant existence checks of always-defined Shoptet objects',
      category: 'Shoptet',
      recommended: true,
    },
    messages: {
      redundant:
        '`{{name}}` is always defined in the browser — this existence check is redundant and can be removed.',
    },
    schema: [],
  },

  create(context) {
    return {
      UnaryExpression(node) {
        if (
          node.operator === 'typeof' &&
          node.argument.type === 'Identifier' &&
          ALWAYS_DEFINED.has(node.argument.name) &&
          // A local variable/parameter named e.g. `screen` is not the global —
          // guarding it is legitimate, not redundant.
          isGlobalBinding(context.getScope(), node.argument.name)
        ) {
          context.report({
            node,
            messageId: 'redundant',
            data: { name: node.argument.name },
          });
        }
      },
    };
  },
};
