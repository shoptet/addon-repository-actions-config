/**
 * E7. localStorage access must be wrapped in try/catch
 *
 * localStorage can throw (disabled, full, private mode), so every access must
 * be guarded. Flags localStorage method calls not enclosed in a try block.
 */

const STORAGE_METHODS = new Set(['getItem', 'setItem', 'removeItem', 'clear', 'key']);

function isLocalStorageCallee(callee) {
  if (callee.type !== 'MemberExpression' || !callee.property) return false;
  if (!STORAGE_METHODS.has(callee.property.name)) return false;

  const obj = callee.object;
  if (obj.type === 'Identifier' && obj.name === 'localStorage') return true;
  // window.localStorage.setItem(...)
  return (
    obj.type === 'MemberExpression' &&
    obj.property &&
    obj.property.name === 'localStorage'
  );
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require localStorage access to be wrapped in try/catch',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      wrap:
        'Wrap localStorage access in try/catch — it can throw when storage is disabled or full.',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        if (!isLocalStorageCallee(node.callee)) return;

        const ancestors = context.getAncestors();
        const insideTry = ancestors.some(
          (ancestor) => ancestor.type === 'TryStatement'
        );

        if (!insideTry) {
          context.report({ node, messageId: 'wrap' });
        }
      },
    };
  },
};
