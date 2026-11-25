/**
 * The typescript-eslint extension rules the TypeScript/JSX block uses, narrowed
 * to this gate's zero-false-positive bar.
 *
 * Shared helper, not a `shoptet/*` rule: the config registers these under the
 * upstream ids (`@typescript-eslint/no-unused-vars`, …), so findings read
 * exactly like upstream and a partner's `eslint-disable` comment works with
 * EITHER id — the upstream one natively, the core one through
 * core-id-directives.js (a `.jsx` author writes `no-unused-vars`, not
 * `@typescript-eslint/no-unused-vars`).
 *
 * `no-unused-vars` additionally drops reports TypeScript itself does not
 * consider unused (no TS6133 under `noUnusedLocals`), plus the JSX factory:
 *   - a value used only in type positions (`messageId: 'usedOnlyAsType'`):
 *     `declare const brand: unique symbol` used as `typeof brand`,
 *     `const TABLE = {…}` used as `keyof typeof TABLE`;
 *   - an unused AMBIENT declaration (`declare const shoptetConfig: X`,
 *     `declare function track(): void`): it emits no code, it only describes
 *     a global — leftover from a refactor, never dead runtime code;
 *   - an unused TYPE PARAMETER (`type Branded<T, Tag>`): tsc reports it only
 *     under --noUnusedParameters, like an unused argument (`args: 'none'`);
 *   - an unused DECORATED class: the decorator registers it at runtime
 *     (`@customElement('x')`), so it is not dead code;
 *   - a `_`-prefixed binding tsc exempts: in a for-of / for-in head, or one
 *     introduced by renaming a destructured property (`{ id: _id }`);
 *   - in `.tsx/.jsx`, an unused IMPORT that may be the JSX factory compiled
 *     JSX calls: one named by a `@jsx` / `@jsxFrag` pragma TypeScript or
 *     Babel would read (see LEADING_PRAGMA / LINE_PRAGMA), or one of the
 *     common factory names (`h`, `Fragment`, `jsx`, `createElement`), since
 *     a factory set in tsconfig/babel is invisible here. Only import
 *     bindings — `const h = 5` is still reported. The default `React`
 *     factory is already counted as used by the parser.
 *
 * `no-use-before-define` drops a reference to an AMBIENT declaration
 * (`declare const SHOP_CFG`, `declare class Lib`) and one in the computed key
 * of an interface / type-literal member (`[Ev.Open]: …`): no emitted code,
 * no TDZ.
 */

const { findVariable } = require('@eslint-community/eslint-utils');
const { honoringCoreDirectives } = require('./core-id-directives');
const { isAmbientDef } = require('./global-callee');

const COMMON_JSX_FACTORIES = ['h', 'Fragment', 'jsx', 'createElement'];
// The pragma forms the two compilers actually read (measured):
//  - TypeScript: `@jsx X` anywhere in a line, in the file's LEADING comments;
//  - Babel (plugin-transform-react-jsx): ANY comment, but the line must hold
//    the pragma alone (` * @jsx X`).
// Their union, so no pragma either compiler honours is missed. `X` may be a
// member path (`React.createElement`): the binding is its first segment.
const LEADING_PRAGMA = /@jsx(?:Frag)?\s+([A-Za-z_$][\w$]*)/g;
const LINE_PRAGMA = /^\s*(?:\*\s*)?@jsx(?:Frag)?\s+([A-Za-z_$][\w$]*)\S*\s*$/gm;
const JSX_FILE = /\.(tsx|jsx)$/i;

/** Factory names this file's compiled JSX may call. Memoized per file. */
function jsxFactoryNames(sourceCode, cache) {
  if (cache.names) return cache.names;
  const names = new Set(COMMON_JSX_FACTORIES);
  const firstToken = sourceCode.ast.tokens[0];
  const leadingEnd = firstToken ? firstToken.range[0] : Infinity;
  for (const comment of sourceCode.getAllComments()) {
    const pattern = comment.range[1] <= leadingEnd ? LEADING_PRAGMA : LINE_PRAGMA;
    for (const match of comment.value.matchAll(pattern)) names.add(match[1]);
  }
  cache.names = names;
  return names;
}

function isDecoratedClassDef(def) {
  return (
    def.node &&
    (def.node.type === 'ClassDeclaration' || def.node.type === 'ClassExpression') &&
    Array.isArray(def.node.decorators) &&
    def.node.decorators.length > 0
  );
}

/**
 * no-use-before-define: a reference to an AMBIENT declaration
 * (`declare const SHOP_CFG`, `declare class Lib`, `declare namespace`)
 * cannot hit the TDZ — the declaration emits no code, the value already
 * exists at runtime. A real enum used early is still reported.
 */
function useBeforeDefineSkip(descriptor, context) {
  const node = descriptor.node;
  if (!node || node.type !== 'Identifier') return false;
  if (insideTypeMemberKey(node)) return true;
  const variable = findVariable(context.sourceCode.getScope(node), node);
  return Boolean(variable && variable.defs.length && variable.defs.every(isAmbientDef));
}

/**
 * A computed key of an interface or type-literal member (`[Ev.Open]: …`,
 * `{ [TAG]: true }`) is a type position: it emits nothing, so a reference to
 * a value declared further down cannot hit the TDZ (tsc is clean). A class
 * member's computed key (`abstract [KEY]: string`) is NOT covered — class
 * bodies are evaluated, and that one is a real error (TS2448).
 */
function insideTypeMemberKey(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === 'TSInterfaceBody' || current.type === 'TSTypeLiteral') return true;
    if (current.type === 'ClassBody' || current.type === 'Program') return false;
  }
  return false;
}

/**
 * tsc's own `_` exemptions under --noUnusedLocals: a `_`-prefixed binding in
 * the head of a for-of / for-in (`for (const _ of items)` — "repeat N times")
 * and one introduced by RENAMING a destructured property (`{ id: _id }`).
 * A shorthand `{ _id }` is reported by tsc, and so here.
 */
function isTscUnderscoreExempt(def) {
  if (!def.name || !def.name.name || !def.name.name.startsWith('_')) return false;
  const declaration = def.parent;
  if (
    def.type === 'Variable' &&
    declaration &&
    declaration.parent &&
    (declaration.parent.type === 'ForOfStatement' ||
      declaration.parent.type === 'ForInStatement') &&
    declaration.parent.left === declaration
  ) {
    return true;
  }
  let target = def.name;
  if (
    target.parent &&
    target.parent.type === 'AssignmentPattern' &&
    target.parent.left === target
  ) {
    target = target.parent; // `{ id: _id = fallback }`
  }
  const property = target.parent;
  return Boolean(
    property &&
    property.type === 'Property' &&
    property.value === target &&
    !property.shorthand &&
    property.parent &&
    property.parent.type === 'ObjectPattern',
  );
}

function unusedVarsSkip() {
  const cache = {};
  return (descriptor, context) => {
    if (descriptor.messageId === 'usedOnlyAsType') return true;
    const node = descriptor.node;
    if (!node || node.type !== 'Identifier') return false;
    const variable = findVariable(context.sourceCode.getScope(node), node);
    if (!variable || variable.defs.length === 0) return false;
    if (variable.defs.every(isAmbientDef)) return true;
    // An unused type parameter (`type Branded<T, Tag>`, `class Repo<Entity>`)
    // is reported by tsc only under --noUnusedParameters — the same bucket as
    // unused function arguments, which this profile exempts (`args: 'none'`).
    if (variable.defs.every((def) => def.node && def.node.type === 'TSTypeParameter')) {
      return true;
    }
    // A decorated class is registered by its decorator at runtime
    // (`@customElement('x') class Widget …`) — used even if nothing names it.
    if (variable.defs.every(isDecoratedClassDef)) return true;
    if (variable.defs.every(isTscUnderscoreExempt)) return true;
    return (
      JSX_FILE.test(context.filename) &&
      variable.defs.every((def) => def.type === 'ImportBinding') &&
      jsxFactoryNames(context.sourceCode, cache).has(variable.name)
    );
  };
}

/** `{ 'no-unused-vars': rule, … }` to merge into the typescript-eslint plugin's rules. */
function typescriptExtensionRules(upstreamRules) {
  const unusedVars = upstreamRules['no-unused-vars'];
  return {
    'no-unused-vars': {
      ...unusedVars,
      // A fresh skip (and cache) per file: create() runs once per linted file.
      create(context) {
        return honoringCoreDirectives(unusedVars, 'no-unused-vars', unusedVarsSkip()).create(
          context,
        );
      },
    },
    'no-use-before-define': honoringCoreDirectives(
      upstreamRules['no-use-before-define'],
      'no-use-before-define',
      useBeforeDefineSkip,
    ),
    'no-unused-expressions': honoringCoreDirectives(
      upstreamRules['no-unused-expressions'],
      'no-unused-expressions',
    ),
  };
}

module.exports = { typescriptExtensionRules, COMMON_JSX_FACTORIES };
