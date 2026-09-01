/**
 * Resolve the effective name of a global builtin call/constructor, whether it is
 * written bare (`setTimeout`) or via the global object — dotted
 * (`window.setTimeout`, `self.setTimeout`, `globalThis.setTimeout`) or computed
 * (`window['setTimeout']`). Prevents trivial rule bypasses like
 * `window.setTimeout(fn, 0)` or `new window['XMLHttpRequest']()`.
 *
 * Returns the builtin name, or null if the callee isn't a bare/global reference.
 *
 * Known limitation: does not follow aliases/bindings (`const st = window.setTimeout;
 * st(fn, 0)`), which would need data-flow analysis.
 */
const GLOBAL_OBJECTS = new Set(['window', 'self', 'globalThis']);

/** Property name of a member expression, for both `.foo` and `['foo']` forms. */
function memberName(node) {
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  if (node.computed && node.property.type === 'Literal' && typeof node.property.value === 'string') {
    return node.property.value;
  }
  return null;
}

function globalCalleeName(callee, scope) {
  if (!callee) return null;
  // A local binding shadowing the name (const self = this, a local setTimeout
  // helper, …) is NOT the global — scope-check both branches.
  if (callee.type === 'Identifier') {
    return isGlobalBinding(scope, callee.name) ? callee.name : null;
  }
  if (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    GLOBAL_OBJECTS.has(callee.object.name) &&
    isGlobalBinding(scope, callee.object.name)
  ) {
    return memberName(callee);
  }
  return null;
}

/**
 * True only when `name` is the GLOBAL binding in this scope — i.e. not declared
 * anywhere up the scope chain. A local variable/parameter of the same name must
 * not be treated as the browser/Shoptet global.
 */
function isGlobalBinding(scope, name) {
  for (let s = scope; s; s = s.upper) {
    const variable = s.variables.find((v) => v.name === name);
    if (variable) return variable.defs.length === 0;
  }
  return true;
}

module.exports = { globalCalleeName, GLOBAL_OBJECTS, memberName, isGlobalBinding };
