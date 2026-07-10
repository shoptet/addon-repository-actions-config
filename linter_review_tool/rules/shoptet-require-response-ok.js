/**
 * E8. Check response.ok / status before reading a fetch body
 *
 * Heuristic: flags fetch responses whose body is read (.json/.text/.blob/…)
 * without checking .ok or .status. Covers the two common shapes:
 *   - direct chain:  fetch(url).then(r => r.json())  /  (await fetch(url)).json()
 *   - .then chain:   fetch(url).then(r => …)  where the callback never reads .ok
 */

const BODY_METHODS = new Set(['json', 'text', 'blob', 'arrayBuffer', 'formData']);

function isFetchCall(node) {
  return (
    node &&
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'fetch'
  );
}

// Unwrap `await fetch(...)` / `(fetch(...))`.
function unwrap(node) {
  let current = node;
  while (
    current &&
    (current.type === 'AwaitExpression' || current.type === 'ChainExpression')
  ) {
    current = current.argument || current.expression;
  }
  return current;
}

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require response.ok/status check before reading a fetch body',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      checkOk:
        'Reading the fetch body without checking response.ok (or status). Handle non-2xx responses (E8).',
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.getSourceCode();

    return {
      // res.json() where res is a fetch() result read directly
      MemberExpression(node) {
        if (!node.property || !BODY_METHODS.has(node.property.name)) return;
        const obj = unwrap(node.object);
        if (isFetchCall(obj)) {
          context.report({ node, messageId: 'checkOk' });
        }
      },

      // fetch(url).then(cb) where cb never references .ok / .status
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== 'MemberExpression' ||
          !callee.property ||
          callee.property.name !== 'then' ||
          !isFetchCall(unwrap(callee.object))
        ) {
          return;
        }

        const cb = node.arguments[0];
        if (
          cb &&
          (cb.type === 'ArrowFunctionExpression' || cb.type === 'FunctionExpression')
        ) {
          const body = sourceCode.getText(cb.body);
          if (!/\.(ok|status)\b/.test(body)) {
            context.report({ node, messageId: 'checkOk' });
          }
        }
      },
    };
  },
};
