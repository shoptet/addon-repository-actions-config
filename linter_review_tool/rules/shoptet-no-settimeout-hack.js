/**
 * B5. Lifecycle / race conditions — no setTimeout(fn, 0) hacks
 *
 * Initialization must not bypass the Shoptet lifecycle via setTimeout with a
 * zero (or missing) delay. Such hacks run before the core is ready and cause
 * race conditions. Initialize in ShoptetDOMContentLoaded instead.
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow setTimeout(fn, 0) lifecycle hacks',
      category: 'Shoptet',
      recommended: true,
    },
    messages: {
      zeroTimeout:
        'Avoid setTimeout(fn, 0) lifecycle hacks. Initialize in ShoptetDOMContentLoaded to avoid race conditions.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          node.callee.name !== 'setTimeout'
        ) {
          return;
        }

        const delay = node.arguments[1];
        const hasZeroDelay =
          node.arguments.length === 1 ||
          (delay && delay.type === 'Literal' && delay.value === 0);

        if (hasZeroDelay) {
          context.report({ node, messageId: 'zeroTimeout' });
        }
      },
    };
  },
};
