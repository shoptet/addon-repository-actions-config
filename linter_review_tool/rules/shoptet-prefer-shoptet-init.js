/**
 * B5. Initialize via ShoptetDOMContentLoaded
 *
 * Addons should hook into the Shoptet lifecycle event ShoptetDOMContentLoaded
 * rather than:
 *   - the raw DOMContentLoaded event,
 *   - jQuery's $(document).ready,
 *   - a setTimeout with a small fixed delay used to "wait" for the page/core.
 *
 * (A zero-delay setTimeout hack is a hard blocker handled by
 * shoptet/no-settimeout-hack.)
 */

// Small fixed delays are almost always "wait for the page to be ready" hacks.
const LIFECYCLE_DELAY_THRESHOLD = 100;

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer ShoptetDOMContentLoaded over DOMContentLoaded / ready / setTimeout delays',
      category: 'Shoptet',
      recommended: true,
    },
    messages: {
      domContentLoaded:
        'Use the ShoptetDOMContentLoaded event instead of DOMContentLoaded — the core may not be ready yet.',
      jqueryReady:
        'Use the ShoptetDOMContentLoaded event instead of $(document).ready — the core may not be ready yet.',
      setTimeoutDelay:
        'setTimeout({{delay}}ms) looks like a "wait for the page/core" hack. Initialize in ShoptetDOMContentLoaded instead (B5).',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;

        // setTimeout(fn, <small positive delay>)
        if (callee.type === 'Identifier' && callee.name === 'setTimeout') {
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
          return;
        }

        if (callee.type !== 'MemberExpression' || !callee.property) return;

        // addEventListener('DOMContentLoaded', ...)
        if (
          callee.property.name === 'addEventListener' &&
          node.arguments.length &&
          node.arguments[0].type === 'Literal' &&
          node.arguments[0].value === 'DOMContentLoaded'
        ) {
          context.report({ node: node.arguments[0], messageId: 'domContentLoaded' });
          return;
        }

        // $(document).ready(...) or $(...).ready(...)
        if (
          callee.property.name === 'ready' &&
          callee.object.type === 'CallExpression' &&
          callee.object.callee.type === 'Identifier' &&
          (callee.object.callee.name === '$' || callee.object.callee.name === 'jQuery')
        ) {
          context.report({ node, messageId: 'jqueryReady' });
        }
      },
    };
  },
};
