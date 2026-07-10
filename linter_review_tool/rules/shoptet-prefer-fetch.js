/**
 * E2. Modern JS — prefer fetch over XMLHttpRequest
 *
 * Use fetch + async/await instead of the legacy XMLHttpRequest API.
 */

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
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'XMLHttpRequest'
        ) {
          context.report({ node, messageId: 'preferFetch' });
        }
      },
    };
  },
};
