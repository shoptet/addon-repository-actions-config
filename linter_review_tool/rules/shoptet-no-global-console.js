/**
 * F3. Zero-console policy — global-object counterpart of core `no-console`.
 *
 * ESLint's `no-console` matches only the bare `console` global, so
 * `window.console.log(...)` or `globalThis['console'].warn(...)` would bypass
 * the blocker. This rule flags member ACCESS on a console reached through a
 * global object (dotted or computed) — mirroring core no-console semantics:
 * a bare reference (feature detection `if (window.console)`) produces no
 * output and is not flagged, and aliasing the console object itself
 * (`const c = window.console`) is an accepted false negative on both sides
 * (core no-console does not catch `const c = console` either).
 */

const { GLOBAL_OBJECTS, memberName, isGlobalBinding } = require('./global-callee');

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
        'Do not access the console through the global object (`{{path}}`) — production addons must not access or tamper with the console.',
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.getSourceCode();

    // window.console / globalThis['console'] — the console slot itself.
    function isGlobalConsoleRef(node) {
      return (
        node &&
        node.type === 'MemberExpression' &&
        node.object.type === 'Identifier' &&
        GLOBAL_OBJECTS.has(node.object.name) &&
        isGlobalBinding(context.getScope(), node.object.name) &&
        memberName(node) === 'console'
      );
    }

    function reportTamper(node, target) {
      context.report({
        node,
        messageId: 'globalConsole',
        data: { path: sourceCode.getText(target) },
      });
    }

    return {
      // Tampering: window.console = fake (feature detection `if (window.console)`
      // is a bare read and stays clean — pinned by good-console-detection.js).
      AssignmentExpression(node) {
        if (isGlobalConsoleRef(node.left)) reportTamper(node, node.left);
      },
      // Tampering: delete window.console
      UnaryExpression(node) {
        if (node.operator === 'delete' && isGlobalConsoleRef(node.argument)) {
          reportTamper(node, node.argument);
        }
      },
      MemberExpression(node) {
        if (
          node.object.type === 'Identifier' &&
          GLOBAL_OBJECTS.has(node.object.name) &&
          // const self = this — a local binding is not the global object
          isGlobalBinding(context.getScope(), node.object.name) &&
          memberName(node) === 'console' &&
          // Only property/method access ON the console (window.console.log —
          // called or not); a bare reference is a read, not output.
          node.parent.type === 'MemberExpression' &&
          node.parent.object === node
        ) {
          context.report({
            node: node.parent,
            messageId: 'globalConsole',
            data: { path: sourceCode.getText(node.parent) },
          });
        }
      },
    };
  },
};
