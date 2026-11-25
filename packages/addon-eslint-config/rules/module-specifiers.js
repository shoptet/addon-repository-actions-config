/**
 * The static module specifiers a source file imports, read from the PARSER's
 * AST (not a regex): `import … from 'x'`, `import 'x'`, `export … from 'x'`,
 * a dynamic `import('x')` and `require('x')` with a string literal, and
 * TypeScript's `import x = require('x')`. Type-only imports and exports
 * (`import type …`, every specifier `type`) are erased by the compiler, ship
 * nothing, and are not returned.
 *
 * Shared helper, not a rule. The runner uses it to lint a test file that
 * production code imports after all (CZ3TDR1-980): discovery skips
 * `*.test.*` / `__mocks__/` …, but a skipped file that ships through an import
 * must still go through the gate. A specifier built at runtime
 * (`import(name)`, `require(path)`) is not a string literal and is not
 * returned — a false negative, never a false positive.
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
  for (const sourceType of ['module', 'script']) {
    try {
      return espree.parse(sourceText, { ecmaVersion: 'latest', sourceType });
    } catch {
      // a classic script may fail the module parse — try script
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
 * (`import './x'`, no specifiers) always ships.
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

function moduleSpecifiers(sourceText, filename) {
  const program = parse(sourceText, filename);
  if (!program) return [];
  const found = [];
  const add = (node) => {
    const value = stringValue(node);
    if (typeof value === 'string') found.push(value);
  };
  const stack = [program];
  while (stack.length) {
    const node = stack.pop();
    switch (node.type) {
      case 'ImportDeclaration':
      case 'ExportNamedDeclaration':
      case 'ExportAllDeclaration':
        if (node.source && !isTypeOnly(node)) add(node.source);
        break;
      case 'ImportExpression':
        add(node.source);
        break;
      case 'CallExpression':
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require' &&
          node.arguments.length === 1
        ) {
          add(node.arguments[0]);
        }
        break;
      case 'TSExternalModuleReference': // import x = require('x')
        add(node.expression);
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
  return found;
}

module.exports = { moduleSpecifiers };
