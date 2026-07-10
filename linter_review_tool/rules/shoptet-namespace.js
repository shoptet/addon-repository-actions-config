/**
 * D4. Namespace / prefix / collisions
 *
 * - `window.<x> = …` global assignments leak addon state into the global scope
 *   and collide with other addons / the eshop. Use a namespaced module instead.
 * - localStorage keys without a unique prefix collide across addons. Keys should
 *   carry a namespace prefix (e.g. `elevate_recentlyViewed`).
 */

// Standard writable window handlers that are not addon globals.
const ALLOWED_WINDOW_PROPS = new Set([
  'location',
  'name',
  'onload',
  'onresize',
  'onscroll',
  'onbeforeunload',
  'onmessage',
  'onpopstate',
  'onhashchange',
]);

const STORAGE_METHODS = new Set(['setItem', 'getItem', 'removeItem']);
// A namespaced key contains a separator prefix, e.g. elevate_x / elevate:x / elevate.x
const PREFIXED_KEY = /^[a-z0-9]+[_:.-]/i;

function isLocalStorage(objectNode) {
  if (objectNode.type === 'Identifier') return objectNode.name === 'localStorage';
  return (
    objectNode.type === 'MemberExpression' &&
    objectNode.property &&
    objectNode.property.name === 'localStorage'
  );
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require namespacing: no window globals, prefixed localStorage keys',
      category: 'Shoptet',
      recommended: true,
    },
    messages: {
      windowGlobal:
        'Avoid `window.{{name}} = …` — global assignments collide with other addons. Use a namespaced module.',
      storagePrefix:
        'localStorage key "{{key}}" has no namespace prefix. Prefix it (e.g. "elevate_{{key}}") to avoid collisions (D4).',
    },
    schema: [],
  },

  create(context) {
    return {
      AssignmentExpression(node) {
        if (
          node.left.type === 'MemberExpression' &&
          node.left.object.type === 'Identifier' &&
          node.left.object.name === 'window' &&
          node.left.property &&
          node.left.property.type === 'Identifier' &&
          !ALLOWED_WINDOW_PROPS.has(node.left.property.name)
        ) {
          context.report({
            node,
            messageId: 'windowGlobal',
            data: { name: node.left.property.name },
          });
        }
      },

      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type === 'MemberExpression' &&
          callee.property &&
          STORAGE_METHODS.has(callee.property.name) &&
          isLocalStorage(callee.object) &&
          node.arguments.length &&
          node.arguments[0].type === 'Literal' &&
          typeof node.arguments[0].value === 'string'
        ) {
          const key = node.arguments[0].value;
          if (!PREFIXED_KEY.test(key)) {
            context.report({
              node: node.arguments[0],
              messageId: 'storagePrefix',
              data: { key },
            });
          }
        }
      },
    };
  },
};
