/**
 * Can this source run as a classic (non-module) script?
 *
 * import/export declarations, `import.meta` and top-level `await` are ALL
 * SyntaxErrors in script mode — so a single script-parse answers the
 * "is this file module-committed?" question without enumerating markers
 * (round 13; the enumeration approach diverged twice). Memoized on the source
 * text: rules may ask several times per file.
 *
 * TypeScript / JSX (`.ts`, `.tsx`, `.mts`, `.cts`, `.jsx`): espree cannot parse
 * type syntax or JSX, so a script-parse would fail on EVERY such file and call
 * it a module — which would keep `no-unused-vars` on a classic-script `.ts`
 * whose handlers are wired from HTML (false positives). For those files the
 * same question is answered on the typescript-eslint AST instead, by the exact
 * markers a script-parse rejects: an import/export statement (incl. TS
 * `export =` and `import x = require()`), `import.meta`, top-level `await`.
 * A file that does not parse at all is NOT a runnable script (false) — the
 * same answer the espree path gives — and ESLint reports the parse error.
 *
 * `filename` is optional: without it (the pre-TypeScript signature external
 * consumers call) the source is treated as JavaScript, exactly as before.
 */

const espree = require('espree');

const TS_OR_JSX = /\.(ts|tsx|mts|cts|jsx)$/i;

let lastKey = null;
let lastResult = false;

// Statements that only exist in module code (a TS file containing one is a
// module for the compiler too — tsc's own definition of "external module").
function isModuleStatement(stmt) {
  switch (stmt.type) {
    case 'ImportDeclaration':
    case 'ExportNamedDeclaration':
    case 'ExportDefaultDeclaration':
    case 'ExportAllDeclaration':
    case 'TSExportAssignment': // export = x
    case 'TSNamespaceExportDeclaration': // export as namespace X
      return true;
    case 'TSImportEqualsDeclaration': // import x = require('y'), not `import x = NS.y`
      return stmt.isExport === true || stmt.moduleReference.type === 'TSExternalModuleReference';
    default:
      return false;
  }
}

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
]);

/** `import.meta` anywhere, or `await` / `for await` outside every function. */
function hasModuleOnlyExpression(program) {
  const stack = [{ node: program, inFunction: false }];
  while (stack.length) {
    const { node, inFunction } = stack.pop();
    if (node.type === 'MetaProperty' && node.meta.name === 'import') return true;
    if (!inFunction && node.type === 'AwaitExpression') return true;
    if (!inFunction && node.type === 'ForOfStatement' && node.await) return true;
    // `await using res = …` is a declaration, not an AwaitExpression.
    if (!inFunction && node.type === 'VariableDeclaration' && node.kind === 'await using') {
      return true;
    }
    const childInFunction = inFunction || FUNCTION_TYPES.has(node.type);
    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item.type === 'string') {
            stack.push({ node: item, inFunction: childInFunction });
          }
        }
      } else if (value && typeof value.type === 'string') {
        stack.push({ node: value, inFunction: childInFunction });
      }
    }
  }
  return false;
}

function typeScriptParsesAsScript(sourceText, filename) {
  // Required on first use, not at module load. That saves nothing through the
  // package entry point — index.js loads the flat config, which requires
  // typescript-eslint up front — so the TypeScript toolchain is a hard
  // dependency of this package either way.
  // `parse` (not the parser's parseForESLint): the AST alone, no scope analysis.
  const { parse } = require('@typescript-eslint/typescript-estree');
  let program;
  try {
    program = parse(sourceText, { filePath: filename, jsx: /\.(tsx|jsx)$/i.test(filename) });
  } catch (error) {
    // Only a genuine parse error means "not runnable as a script". Anything
    // else is a bug here — rethrow it: swallowing it would call every TS file
    // a module, i.e. switch the false-positive filter off silently.
    if (error && error.name === 'TSError') return false;
    throw error;
  }
  return !program.body.some(isModuleStatement) && !hasModuleOnlyExpression(program);
}

function parsesAsScript(sourceText, filename) {
  const typed = typeof filename === 'string' && TS_OR_JSX.test(filename);
  const key = `${typed ? filename.slice(filename.lastIndexOf('.')).toLowerCase() : 'js'}\0${sourceText}`;
  if (key === lastKey) return lastResult;
  lastKey = key;
  if (typed) {
    lastResult = typeScriptParsesAsScript(sourceText, filename);
    return lastResult;
  }
  try {
    espree.parse(sourceText, { ecmaVersion: 'latest', sourceType: 'script' });
    lastResult = true;
  } catch {
    lastResult = false;
  }
  return lastResult;
}

module.exports = { parsesAsScript };
