/**
 * F3. Zero-console policy — global-object counterpart of core `no-console`.
 *
 * ESLint's `no-console` matches only the bare `console` global, so
 * `window.console.log(...)`, `globalThis['console'].warn(...)` or aliasing
 * `const c = window.console` would bypass the blocker. This rule flags ANY
 * reference to `console` reached through a global object (dotted or computed),
 * closing the same bypass class handled by global-callee for other rules.
 */

const { GLOBAL_OBJECTS, memberName } = require('./global-callee');

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow console access via the global object (window.console etc.)',
      category: 'Shoptet',
      recommended: true,
    },
    messages: {
      globalConsole:
        'Do not access the console through the global object (`{{path}}`) — production addons must not produce console output.',
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.getSourceCode();

    return {
      MemberExpression(node) {
        if (
          node.object.type === 'Identifier' &&
          GLOBAL_OBJECTS.has(node.object.name) &&
          memberName(node) === 'console'
        ) {
          context.report({
            node,
            messageId: 'globalConsole',
            data: { path: sourceCode.getText(node) },
          });
        }
      },
    };
  },
};
