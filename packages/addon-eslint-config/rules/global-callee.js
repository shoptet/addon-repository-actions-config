/**
 * Resolve the effective name of a global builtin call/constructor, whether it is
 * written bare (`setTimeout`) or via the global object — dotted
 * (`window.setTimeout`, `self.setTimeout`, `globalThis.setTimeout`) or computed
 * (`window['setTimeout']`). Prevents trivial rule bypasses like
 * `window.setTimeout(fn, 0)` or `new window['XMLHttpRequest']()`.
 *
 * Returns the builtin name, or null if the callee isn't a bare/global reference.
 *
 * TypeScript: type-only wrappers around an expression (`(window as any)`,
 * `window!`, `<any>window`, `window satisfies X`) are erased at compile time and
 * change nothing at runtime, so every node is compared through `unwrapTS()` —
 * otherwise `(window as any).setTimeout(fn, 0)` would bypass the rule.
 *
 * Known limitation: does not follow aliases/bindings (`const st = window.setTimeout;
 * st(fn, 0)`), which would need data-flow analysis.
 */
const GLOBAL_OBJECTS = new Set(['window', 'self', 'globalThis']);

// Expression wrappers that exist only in the type system. The runtime value is
// always the wrapped `expression`.
const TS_WRAPPERS = new Set([
  'TSAsExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSSatisfiesExpression',
]);

/** Strip type-only wrappers (any depth): `((x as any)!)` → `x`. Non-TS ASTs pass through. */
function unwrapTS(node) {
  let current = node;
  while (current && TS_WRAPPERS.has(current.type)) current = current.expression;
  return current;
}

/**
 * Strip type-only wrappers AND optional-chain wrappers (`shoptet?.x` arrives as
 * a ChainExpression) in any order: `(shoptet?.x)!` → the MemberExpression.
 */
function unwrapExpr(node) {
  let current = node;
  while (current && (TS_WRAPPERS.has(current.type) || current.type === 'ChainExpression')) {
    current = current.expression;
  }
  return current;
}

/** Property name of a member expression, for both `.foo` and `['foo']` forms. */
function memberName(node) {
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  const property = node.computed ? unwrapTS(node.property) : null;
  if (property && property.type === 'Literal' && typeof property.value === 'string') {
    return property.value;
  }
  return null;
}

function globalCalleeName(rawCallee, scope) {
  const callee = unwrapTS(rawCallee);
  if (!callee) return null;
  // A local binding shadowing the name (const self = this, a local setTimeout
  // helper, …) is NOT the global — scope-check both branches.
  if (callee.type === 'Identifier') {
    return isGlobalBinding(scope, callee.name) ? callee.name : null;
  }
  if (callee.type === 'MemberExpression') {
    const object = unwrapTS(callee.object);
    if (
      object.type === 'Identifier' &&
      GLOBAL_OBJECTS.has(object.name) &&
      isGlobalBinding(scope, object.name)
    ) {
      return memberName(callee);
    }
  }
  return null;
}

/**
 * Is this definition ambient — TypeScript `declare` (`declare const shoptet: X`,
 * `declare function f(): void`, or anything inside a `declare global {}` /
 * `declare module` block)? Ambient declarations emit no code: they only tell
 * the compiler the value already exists at runtime, i.e. they describe the
 * global, they do not shadow it.
 */
function isAmbientDef(def) {
  for (let node = def.node; node; node = node.parent) {
    if (node.declare === true) return true;
    if (node.type === 'Program') return false;
  }
  return false;
}

/**
 * True only when `name` is the GLOBAL binding in this scope — i.e. not declared
 * anywhere up the scope chain. A local variable/parameter of the same name must
 * not be treated as the browser/Shoptet global.
 *
 * TypeScript: a type-only binding (`import type { Shoptet }`, `interface
 * shoptet`) lives in the type namespace and cannot shadow a runtime value, and
 * an ambient `declare const shoptet: X` describes the very global it names —
 * neither makes the identifier local. (`isValueVariable` exists only on
 * typescript-eslint's scope manager; plain ESLint variables are always values.)
 */
function isGlobalBinding(scope, name) {
  for (let s = scope; s; s = s.upper) {
    const variable = s.variables.find((v) => v.name === name && v.isValueVariable !== false);
    if (variable) return variable.defs.every(isAmbientDef);
  }
  return true;
}

module.exports = {
  globalCalleeName,
  GLOBAL_OBJECTS,
  TS_WRAPPERS,
  memberName,
  isGlobalBinding,
  isAmbientDef,
  unwrapTS,
  unwrapExpr,
};
