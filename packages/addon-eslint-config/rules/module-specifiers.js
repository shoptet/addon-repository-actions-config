/**
 * The module specifiers a source file imports UNCONDITIONALLY, read from the
 * PARSER's AST (not a regex): `import … from 'x'`, `import 'x'`,
 * `export … from 'x'`, TypeScript's `import x = require('x')`, and a
 * `require('x')` that runs whenever the file runs — a top-level statement,
 * a top-level declaration's initializer, a top-level assignment or
 * `export default`, also in the leading straight-line part of a top-level
 * IIFE (the classic-script wrapper), and `require('x').y` too. String literals only.
 *
 * Shared helper, not a rule. The runner uses it to lint a test file that
 * production code imports after all (CZ3TDR1-980): discovery skips
 * `*.test.*` / `__mocks__/` …, but a skipped file that ships through an import
 * must still go through the gate. Linting a file that does NOT ship would be a
 * false positive — a dev-only mock overwriting `window.shoptet` is normal test
 * code — so everything that may not run in production is left out, a false
 * negative by design:
 * - a dynamic `import('x')` and a `require()` inside a condition or a function
 *   (`if (import.meta.env.DEV) await import('./__mocks__/shoptet.js')` is
 *   dropped from the production build);
 * - type-only imports and exports (`import type …`, every specifier `type`,
 *   `import type X = require(…)`), which the compiler erases;
 * - every `require()` when the file binds its own `require` (a local helper,
 *   not the module loader);
 * - a specifier built at runtime (`require(path)`).
 *
 * Returns an array of specifier strings, or [] when the source does not
 * parse (the lint itself reports the parse error).
 */

const espree = require('espree');

const TS_OR_JSX = /\.(ts|tsx|mts|cts|jsx)$/i;

function parse(sourceText, filename) {
  if (typeof filename === 'string' && TS_OR_JSX.test(filename)) {
    const { parse: parseTs } = require('@typescript-eslint/typescript-estree');
    try {
      return parseTs(sourceText, { filePath: filename, jsx: /\.(tsx|jsx)$/i.test(filename) });
    } catch {
      return null;
    }
  }
  // module, then script (a classic script), then module with JSX — a `.js`
  // file with JSX is linted as JSX by the runner (CZ3TDR1-968), so its
  // imports must be followed too.
  const attempts = [
    { sourceType: 'module' },
    { sourceType: 'script' },
    { sourceType: 'module', ecmaFeatures: { jsx: true } },
  ];
  for (const options of attempts) {
    try {
      return espree.parse(sourceText, { ecmaVersion: 'latest', ...options });
    } catch {
      // next attempt
    }
  }
  return null;
}

function stringValue(node) {
  if (!node) return null;
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }
  return null;
}

/**
 * A TypeScript import/export the compiler erases, so nothing ships:
 * `import type { X } from …`, `export type { X } from …`, or one whose every
 * specifier is `type` (`import { type X } from …`). A side-effect import
 * (`import './x'`, no specifiers) always ships. Under `verbatimModuleSyntax`
 * the all-inline-`type` form keeps a bare `import {} from …`; the gate cannot
 * see the build's tsconfig, so it is treated as erased — a false negative.
 */
function isTypeOnly(node) {
  if (node.importKind === 'type' || node.exportKind === 'type') return true;
  const specifiers = node.specifiers || [];
  return (
    specifiers.length > 0 &&
    specifiers.every(
      (specifier) => specifier.importKind === 'type' || specifier.exportKind === 'type',
    )
  );
}

/** Identifiers a binding pattern declares (`a`, `{ a, b: c }`, `[d, ...e]`). */
function patternNames(pattern, names) {
  if (!pattern) return;
  switch (pattern.type) {
    case 'Identifier':
      names.add(pattern.name);
      break;
    case 'ObjectPattern':
      for (const property of pattern.properties) {
        patternNames(property.type === 'RestElement' ? property.argument : property.value, names);
      }
      break;
    case 'ArrayPattern':
      for (const element of pattern.elements) patternNames(element, names);
      break;
    case 'RestElement':
      patternNames(pattern.argument, names);
      break;
    case 'AssignmentPattern':
      patternNames(pattern.left, names);
      break;
    case 'TSParameterProperty':
      patternNames(pattern.parameter, names);
      break;
    default:
      break;
  }
}

/** Every name the file binds anywhere (declarations, parameters, imports). */
function boundNames(program) {
  const names = new Set();
  const stack = [program];
  while (stack.length) {
    const node = stack.pop();
    switch (node.type) {
      case 'VariableDeclaration':
        // `declare const require: NodeRequire` only types the real loader
        if (!node.declare) {
          for (const declarator of node.declarations) patternNames(declarator.id, names);
        }
        break;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        if (node.id) names.add(node.id.name);
        for (const param of node.params) patternNames(param, names);
        break;
      case 'ClassDeclaration':
      case 'ClassExpression':
        if (node.id) names.add(node.id.name);
        break;
      case 'CatchClause':
        patternNames(node.param, names);
        break;
      case 'ImportSpecifier':
      case 'ImportDefaultSpecifier':
      case 'ImportNamespaceSpecifier':
        names.add(node.local.name);
        break;
      case 'TSImportEqualsDeclaration':
        names.add(node.id.name);
        break;
      default:
        break;
    }
    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) if (item && typeof item.type === 'string') stack.push(item);
      } else if (value && typeof value.type === 'string') {
        stack.push(value);
      }
    }
  }
  return names;
}

/** `require('x')`, also as the object of `require('x').y` / `require('x')[k]`. */
function requireCallOf(node) {
  let current = node;
  while (current && current.type === 'MemberExpression') current = current.object;
  if (current && current.type === 'ChainExpression') return requireCallOf(current.expression);
  return current &&
    current.type === 'CallExpression' &&
    current.callee.type === 'Identifier' &&
    current.callee.name === 'require' &&
    current.arguments.length === 1
    ? current
    : null;
}

/**
 * The body of an immediately invoked function expression —
 * `(function () { … })()`, `(() => { … })()`, `!function () { … }()` — which
 * runs whenever the statement runs (the classic-script wrapper), or null.
 */
function iifeBody(expression) {
  let node = expression;
  if (node.type === 'UnaryExpression') node = node.argument;
  if (node.type !== 'CallExpression') return null;
  const callee = node.callee;
  if (
    (callee.type === 'FunctionExpression' || callee.type === 'ArrowFunctionExpression') &&
    !callee.async &&
    !callee.generator &&
    callee.body.type === 'BlockStatement'
  ) {
    return callee.body.body;
  }
  return null;
}

/**
 * The leading run of an IIFE body that certainly executes: expression
 * statements, variable and function declarations up to the first statement
 * that may leave the
 * function or steer control flow (`if`, `return`, `throw`, `try`, a loop …).
 * A `require()` after `if (process.env.NODE_ENV !== 'test') return;` runs
 * only in tests, so nothing after such a statement counts — a false negative
 * for a `require()` after a harmless `if`, never a false positive.
 */
// A function declaration (hoisted, runs nothing) and an empty statement do
// not steer control flow either, so they do not end the run.
const STRAIGHT_LINE = new Set([
  'ExpressionStatement',
  'VariableDeclaration',
  'FunctionDeclaration',
  'EmptyStatement',
]);

function leadingStraightLine(body) {
  const prefix = [];
  for (const statement of body) {
    if (!STRAIGHT_LINE.has(statement.type)) break;
    prefix.push(statement);
  }
  return prefix;
}

/** The expressions of a top-level statement that run whenever the file runs. */
function unconditionalExpressions(statement) {
  let node = statement;
  if (node.type === 'ExportNamedDeclaration' && node.declaration) node = node.declaration;
  if (node.type === 'ExportDefaultDeclaration') return [node.declaration];
  if (node.type === 'ExpressionStatement') {
    const { expression } = node;
    const body = iifeBody(expression);
    if (body) return leadingStraightLine(body).flatMap(unconditionalExpressions);
    return expression.type === 'AssignmentExpression' ? [expression.right] : [expression];
  }
  if (node.type === 'VariableDeclaration') {
    return node.declarations.map((declarator) => declarator.init).filter(Boolean);
  }
  return [];
}

function moduleSpecifiers(sourceText, filename) {
  const program = parse(sourceText, filename);
  if (!program) return [];
  const found = [];
  const add = (node) => {
    const value = stringValue(node);
    if (typeof value === 'string') found.push(value);
  };
  const followRequire = !boundNames(program).has('require');
  for (const statement of program.body) {
    switch (statement.type) {
      case 'ImportDeclaration':
      case 'ExportNamedDeclaration':
      case 'ExportAllDeclaration':
        if (statement.source && !isTypeOnly(statement)) add(statement.source);
        break;
      case 'TSImportEqualsDeclaration': // import x = require('x'), not `import type`
        if (
          statement.importKind !== 'type' &&
          statement.moduleReference.type === 'TSExternalModuleReference'
        ) {
          add(statement.moduleReference.expression);
        }
        break;
      default:
        break;
    }
    if (!followRequire) continue;
    for (const expression of unconditionalExpressions(statement)) {
      const call = requireCallOf(expression);
      if (call) add(call.arguments[0]);
    }
  }
  return found;
}

module.exports = { moduleSpecifiers };
