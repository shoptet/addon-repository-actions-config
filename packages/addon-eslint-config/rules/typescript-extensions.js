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
 *   - in `.tsx/.jsx`, an unused IMPORT that may be the JSX factory compiled
 *     JSX calls: one named by a `@jsx` / `@jsxFrag` pragma TypeScript or
 *     Babel would read (see LEADING_PRAGMA / LINE_PRAGMA), or one of the common factory names (`h`, `Fragment`, `jsx`,
 *     `createElement`), since a factory set in tsconfig/babel is invisible
 *     here. Only import bindings — `const h = 5` is still reported. The
 *     default `React` factory is already counted as used by the parser.
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

function unusedVarsSkip() {
  const cache = {};
  return (descriptor, context) => {
    if (descriptor.messageId === 'usedOnlyAsType') return true;
    const node = descriptor.node;
    if (!node || node.type !== 'Identifier') return false;
    const variable = findVariable(context.sourceCode.getScope(node), node);
    if (!variable || variable.defs.length === 0) return false;
    if (variable.defs.every(isAmbientDef)) return true;
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
    ),
    'no-unused-expressions': honoringCoreDirectives(
      upstreamRules['no-unused-expressions'],
      'no-unused-expressions',
    ),
  };
}

module.exports = { typescriptExtensionRules, COMMON_JSX_FACTORIES };
