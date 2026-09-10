/**
 * Can this source run as a classic (non-module) script?
 *
 * import/export declarations, `import.meta` and top-level `await` are ALL
 * SyntaxErrors in script mode — so a single script-parse answers the
 * "is this file module-committed?" question without enumerating markers
 * (round 13; the enumeration approach diverged twice). Memoized on the source
 * text: rules may ask several times per file.
 */

const espree = require('espree');

let lastText = null;
let lastResult = false;

function parsesAsScript(sourceText) {
  if (sourceText === lastText) return lastResult;
  lastText = sourceText;
  try {
    espree.parse(sourceText, { ecmaVersion: 'latest', sourceType: 'script' });
    lastResult = true;
  } catch {
    lastResult = false;
  }
  return lastResult;
}

module.exports = { parsesAsScript };
