/**
 * B5. Lifecycle / race conditions — no setTimeout "wait for the page/core" hack
 *
 * Corrected per shoptet-reference.md §4 (Oprava 2026-07-09):
 *   - Native `DOMContentLoaded` is the CORRECT hook for the first (non-AJAX)
 *     load — it is NOT flagged.
 *   - `$(document).ready` ≈ DOMContentLoaded for the first load — NOT flagged.
 *   - Combining DOMContentLoaded + ShoptetDOMContentLoaded is the recommended
 *     pattern, not an anti-pattern — NOT flagged.
 *
 * The real, statically detectable B5 smell is faking the lifecycle with a
 * setTimeout delay to "wait" for the page/core. Use the proper Shoptet
 * lifecycle event instead (and make AJAX-rerun handlers idempotent).
 *
 * Out of scope here:
 *   - setTimeout(fn, 0) — hard blocker handled by shoptet/no-settimeout-hack.
 *   - non-idempotent re-runs on ShoptetDOMContentLoaded — needs runtime/semantic
 *     analysis, not statically detectable.
 */

// Small fixed delays are almost always a "wait for the page to be ready" hack.
const LIFECYCLE_DELAY_THRESHOLD = 100;

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow setTimeout delays used to wait for the page/core lifecycle',
      category: 'Shoptet',
      recommended: true,
    },
    messages: {
      setTimeoutDelay:
        'setTimeout({{delay}}ms) looks like a "wait for the page/core" hack. Hook the proper Shoptet lifecycle event instead (DOMContentLoaded for first load, ShoptetDOMContentLoaded — idempotently — for AJAX content), not polling (B5).',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
        if (callee.type !== 'Identifier' || callee.name !== 'setTimeout') return;

        const delay = node.arguments[1];
        if (
          delay &&
          delay.type === 'Literal' &&
          typeof delay.value === 'number' &&
          delay.value > 0 &&
          delay.value <= LIFECYCLE_DELAY_THRESHOLD
        ) {
          context.report({
            node,
            messageId: 'setTimeoutDelay',
            data: { delay: delay.value },
          });
        }
      },
    };
  },
};
