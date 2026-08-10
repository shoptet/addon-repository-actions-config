/**
 * B5. Lifecycle / race conditions — no setTimeout(fn, 0) hacks
 *
 * Initialization must not bypass the Shoptet lifecycle via setTimeout with a
 * zero (or missing) delay. Such hacks run before the DOM/content is ready and
 * cause race conditions. Hook the proper lifecycle event instead:
 * DOMContentLoaded for the first load, ShoptetDOMContentLoaded (idempotently)
 * for AJAX-loaded content.
 */

const { globalCalleeName } = require('./global-callee');

/**
 * A delay argument that is (or coerces to) 0 at runtime:
 * 0, '0', '', ' ', null, false, undefined, void 0, -0, +0.
 */
function isZeroDelay(node) {
  if (!node) return false;
  if (node.type === 'Literal') {
    if (node.value === 0 || node.value === null || node.value === false) return true;
    return typeof node.value === 'string' && Number(node.value) === 0;
  }
  if (node.type === 'Identifier' && node.name === 'undefined') return true;
  if (node.type === 'UnaryExpression') {
    if (node.operator === 'void') return true; // void <anything> → undefined → 0
    if (node.operator === '-' || node.operator === '+') return isZeroDelay(node.argument);
  }
  return false;
}

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
        if (globalCalleeName(node.callee) !== 'setTimeout') {
          return;
        }

        // setTimeout(...args) — the single argument is a spread, not a callback
        // with an omitted delay; the real delay is unknown, so don't flag.
        if (node.arguments[0] && node.arguments[0].type === 'SpreadElement') {
          return;
        }

        // Zero (or omitted) delay — including forms that coerce to 0 at runtime
        // ('0', '', null, false, undefined, void 0, -0), so the blocker can't
        // be evaded by respelling.
        const hasZeroDelay =
          node.arguments.length === 1 || isZeroDelay(node.arguments[1]);

        if (hasZeroDelay) {
          context.report({ node, messageId: 'zeroTimeout' });
        }
      },
    };
  },
};
