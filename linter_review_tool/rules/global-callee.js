/**
 * Resolve the effective name of a global builtin call/constructor, whether it is
 * written bare (`setTimeout`) or via the global object (`window.setTimeout`,
 * `self.setTimeout`, `globalThis.setTimeout`). Prevents trivial rule bypasses
 * like `window.setTimeout(fn, 0)` or `new window.XMLHttpRequest()`.
 *
 * Returns the builtin name, or null if the callee isn't a bare/global reference.
 */
const GLOBAL_OBJECTS = new Set(['window', 'self', 'globalThis']);

function globalCalleeName(callee) {
  if (!callee) return null;
  if (callee.type === 'Identifier') return callee.name;
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    GLOBAL_OBJECTS.has(callee.object.name) &&
    callee.property.type === 'Identifier'
  ) {
    return callee.property.name;
  }
  return null;
}

module.exports = { globalCalleeName };
