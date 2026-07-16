/**
 * B5. Lifecycle / race conditions — no setTimeout(fn, 0) hacks
 *
 * Initialization must not bypass the Shoptet lifecycle via setTimeout with a
 * zero (or missing) delay. Such hacks run before the DOM/content is ready and
 * cause race conditions. Hook the proper lifecycle event instead:
 * DOMContentLoaded for the first load, ShoptetDOMContentLoaded (idempotently)
 * for AJAX-loaded content. See shoptet-reference.md §4.
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
        'Avoid setTimeout(fn, 0) lifecycle hacks. Hook the proper lifecycle event instead — DOMContentLoaded for first load, ShoptetDOMContentLoaded (idempotently) for AJAX content (B5).',
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
