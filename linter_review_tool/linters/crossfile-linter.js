/**
 * C3. Cross-file duplication (DRY) — ESLint is per-file and cannot see it.
 *
 * Parses every JS file and reports symbols defined in more than one file:
 *   - top-level function declarations of the same name
 *   - `window.<name> = …` global assignments of the same name
 *
 * Both are the classic "same helper / same global copied across files" smell.
 */

const fs = require('fs');
const espree = require('espree');

const PARSE_OPTIONS = {
  ecmaVersion: 'latest',
  loc: true,
  ecmaFeatures: { globalReturn: true },
};

function parse(code) {
  for (const sourceType of ['module', 'script']) {
    try {
      return espree.parse(code, { ...PARSE_OPTIONS, sourceType });
    } catch (error) {
      // try the next source type
    }
  }
  return null;
}

/** Recursively find `window.<id> = …` assignments. */
function collectWindowGlobals(node, out) {
  if (!node || typeof node.type !== 'string') return;

  if (
    node.type === 'AssignmentExpression' &&
    node.left.type === 'MemberExpression' &&
    node.left.object.type === 'Identifier' &&
    node.left.object.name === 'window' &&
    node.left.property &&
    node.left.property.type === 'Identifier'
  ) {
    out.push({ name: node.left.property.name, line: node.left.loc.start.line });
  }

  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'range' || key === 'parent') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach((child) => collectWindowGlobals(child, out));
    } else if (value && typeof value.type === 'string') {
      collectWindowGlobals(value, out);
    }
  }
}

function lintCrossFile(files) {
  // symbolKey -> [{ file, line, kind, display }]
  const registry = new Map();

  function record(key, entry) {
    if (!registry.has(key)) registry.set(key, []);
    registry.get(key).push(entry);
  }

  for (const file of files) {
    let code;
    try {
      code = fs.readFileSync(file, 'utf8');
    } catch (error) {
      continue;
    }
    const ast = parse(code);
    if (!ast) continue;

    for (const node of ast.body) {
      if (node.type === 'FunctionDeclaration' && node.id) {
        record(`fn:${node.id.name}`, {
          file,
          line: node.id.loc.start.line,
          kind: 'function',
          display: node.id.name,
        });
      }
    }

    const globals = [];
    collectWindowGlobals(ast, globals);
    for (const g of globals) {
      record(`win:${g.name}`, {
        file,
        line: g.line,
        kind: 'window global',
        display: `window.${g.name}`,
      });
    }
  }

  const findings = [];
  for (const entries of registry.values()) {
    const distinctFiles = new Set(entries.map((e) => e.file));
    if (distinctFiles.size < 2) continue;

    for (const entry of entries) {
      findings.push({
        file: entry.file,
        line: entry.line,
        column: 1,
        message:
          `Duplicate ${entry.kind} "${entry.display}" defined in ${distinctFiles.size} files. ` +
          'Consolidate into one module (DRY) or namespace it (C3/D4).',
        ruleId: 'shoptet/no-cross-file-duplicate',
        severity: 'recommend',
      });
    }
  }

  return findings;
}

module.exports = { lintCrossFile };
