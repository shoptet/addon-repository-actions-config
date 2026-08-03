/**
 * E2. Modern JS — prefer fetch over XMLHttpRequest
 *
 * Use fetch + async/await instead of the legacy XMLHttpRequest API.
 */

const { globalCalleeName } = require('./global-callee');

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer fetch over XMLHttpRequest',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      preferFetch:
        'Prefer fetch + async/await over XMLHttpRequest (and check response.ok).',
    },
    schema: [],
  },

  create(context) {
    return {
      NewExpression(node) {
        if (globalCalleeName(node.callee) === 'XMLHttpRequest') {
          context.report({ node, messageId: 'preferFetch' });
        }
      },
    };
  },
};
