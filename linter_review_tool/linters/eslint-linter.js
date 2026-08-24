/**
 * JavaScript linter — runs ESLint with the local Shoptet plugin and returns
 * findings in the shared review format.
 *
 * Files are parsed as ES modules (the format addon reviews assume). When a file
 * fails to parse as a module, it is re-parsed as a classic script to tell two
 * very different situations apart:
 *   - parses as a script → valid legacy JS that merely isn't a module: emit an
 *     actionable `shoptet/es-module-required` policy finding AND the full rule
 *     findings from the script run (so the author sees everything at once,
 *     not just one cryptic parse error);
 *   - fails both parses → genuinely broken JS: report the parse error itself.
 */

const fs = require('fs');
const path = require('path');
const { ESLint } = require('eslint');
const { parsesAsScript } = require('../rules/script-detect');

const ROOT = path.join(__dirname, '..');

const BASE_OPTIONS = {
  useEslintrc: false,
  overrideConfigFile: path.join(ROOT, '.eslintrc.js'),
  cwd: ROOT,
  resolvePluginsRelativeTo: ROOT,
  plugins: {
    shoptet: require('../rules'),
  },
};

// no-unused-vars is only trustworthy when the author actually opted into
// module semantics: a file with no import/export statement parses as a module
// all the same, but it ships as a classic script — its top-level functions may
// be wired from HTML (onclick="…") and, through `var` hoisting, even nested
// declarations reach the shared global scope, so ESLint cannot see the callers.
// Checked on the AST, not with a regex (a comment mentioning "export" must not
// count as module syntax). Filtering the WHOLE rule (not just top-level
// declarations) is deliberate: hoisting makes "top-level" non-deterministic,
// and accepted false negatives beat false positives in this profile.
function usesModuleSyntax(filePath) {
  // .mjs is a module by CONVENTION regardless of content. For everything else
  // a single script-parse decides: import/export, import.meta and top-level
  // await are all SyntaxErrors in script mode, so "cannot run as a classic
  // script" IS the module commitment (round 13 — shared with the
  // no-core-overwrite rule via script-detect.js).
  if (filePath.toLowerCase().endsWith('.mjs')) return true;
  try {
    return !parsesAsScript(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return false; // unreadable → the lint run itself will surface that
  }
}

function pushMessages(findings, result) {
  for (const message of result.messages) {
    findings.push({
      file: result.filePath,
      line: message.line || 1,
      column: message.column || 1,
      message: message.message,
      ruleId: message.ruleId || 'CodeQuality',
      severity: message.severity === 2 ? 'blocker' : 'recommend',
    });
  }
}

async function lintJavaScript(files) {
  const eslint = new ESLint(BASE_OPTIONS);
  const results = await eslint.lintFiles(files);
  const findings = [];
  const moduleParseFailures = [];

  for (const result of results) {
    if (result.messages.some((m) => m.fatal)) {
      moduleParseFailures.push(result);
    } else {
      if (
        result.messages.some((m) => m.ruleId === 'no-unused-vars') &&
        !usesModuleSyntax(result.filePath)
      ) {
        result.messages = result.messages.filter((m) => m.ruleId !== 'no-unused-vars');
      }
      pushMessages(findings, result);
    }
  }

  if (moduleParseFailures.length) {
    const scriptEslint = new ESLint({
      ...BASE_OPTIONS,
      overrideConfig: { parserOptions: { sourceType: 'script' } },
    });

    for (const moduleResult of moduleParseFailures) {
      const [scriptResult] = await scriptEslint.lintFiles([moduleResult.filePath]);
      const brokenEvenAsScript =
        !scriptResult || scriptResult.messages.some((m) => m.fatal);

      if (brokenEvenAsScript) {
        // Not a module-format issue — the file is genuinely broken JS.
        // Report the original parse error (surfaces as a CodeQuality blocker).
        pushMessages(findings, moduleResult);
        continue;
      }

      const parseError = moduleResult.messages.find((m) => m.fatal);
      findings.push({
        file: moduleResult.filePath,
        line: (parseError && parseError.line) || 1,
        column: (parseError && parseError.column) || 1,
        message:
          'This file fails to parse as an ES module (it only parses as a legacy ' +
          'script), so it was linted in script mode. Addons are reviewed as ES ' +
          'modules — please convert it to module-compatible syntax. ' +
          `(Module parse error: ${parseError ? parseError.message : 'unknown'})`,
        ruleId: 'shoptet/es-module-required',
        severity: 'blocker',
      });
      // Full findings from the script parse — the author gets the complete
      // picture in one run instead of fixing one parse error per push.
      // Except no-unused-vars: in script mode a top-level function is a global
      // whose callers (HTML onclick handlers) ESLint cannot see, so its
      // positives are not trustworthy there. The module pass keeps the rule
      // only for files that actually use module syntax (see usesModuleSyntax).
      scriptResult.messages = scriptResult.messages.filter((m) => m.ruleId !== 'no-unused-vars');
      pushMessages(findings, scriptResult);
    }
  }

  return findings;
}

module.exports = { lintJavaScript };
