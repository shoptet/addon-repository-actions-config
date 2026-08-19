/**
 * B5. Zero-delay setTimeout is banned in addons — period.
 *
 * A deterministic rule cannot tell a lifecycle hack from a "harmless" deferral,
 * so the policy is a blanket ban (confirmed decision, review round 7): for
 * init, hook the lifecycle events; to defer work until after render, use
 * requestAnimationFrame. Both alternatives are named in the message.
 */

const { globalCalleeName } = require('./global-callee');

/**
 * A delay argument that effectively runs at 0 at runtime: numeric values < 1
 * (browsers floor sub-1ms and clamp negatives to 0), '0'/'' strings, null,
 * false, undefined, void 0, empty array (ToNumber([]) === 0).
 */
function isZeroDelay(node) {
  if (!node) return false;
  if (node.type === 'Literal') {
    if (node.value === null || node.value === false) return true;
    if (typeof node.value === 'number') return node.value < 1;
    return typeof node.value === 'string' && Number(node.value) < 1 && !Number.isNaN(Number(node.value));
  }
  if (node.type === 'Identifier' && node.name === 'undefined') return true;
  // `0` — an expression-less template coerces exactly like a string literal.
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    const cooked = node.quasis[0] && node.quasis[0].value.cooked;
    return typeof cooked === 'string' && Number(cooked) < 1 && !Number.isNaN(Number(cooked));
  }
  if (node.type === 'ArrayExpression' && node.elements.length === 0) return true; // ToNumber([]) → 0
  if (node.type === 'UnaryExpression') {
    if (node.operator === 'void') return true; // void <anything> → undefined → 0
    // Any negated numeric literal is clamped to 0 by the browser.
    if (node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') return true;
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
        'Zero-delay setTimeout is not allowed in addons. For initialization hook the lifecycle — DOMContentLoaded for first load, ShoptetDOMContentLoaded (idempotently) for AJAX content; to defer work until after render use requestAnimationFrame (B5).',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        if (globalCalleeName(node.callee, context.getScope()) !== 'setTimeout') {
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
