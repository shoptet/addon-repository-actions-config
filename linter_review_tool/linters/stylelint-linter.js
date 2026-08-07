/**
 * CSS/SCSS linter — runs stylelint with the Shoptet config and returns
 * findings in the shared review format. SCSS files use the postcss-scss syntax.
 */

const path = require('path');
const stylelint = require('stylelint');

const CONFIG_FILE = path.join(__dirname, '..', '.stylelintrc.js');

async function runStylelint(files, customSyntax, findings) {
  if (!files.length) return;

  const options = { files, configFile: CONFIG_FILE };
  if (customSyntax) options.customSyntax = customSyntax;

  const { results } = await stylelint.lint(options);

  for (const result of results) {
    for (const warning of result.warnings) {
      findings.push({
        file: result.source,
        line: warning.line || 1,
        column: warning.column || 1,
        // stylelint appends " (rule-name)" to the text; drop it (title has it).
        message: warning.text.replace(/\s*\([^)]*\)\s*$/, ''),
        ruleId: warning.rule || 'stylelint',
        severity: warning.severity === 'error' ? 'blocker' : 'recommend',
      });
    }

    // Note: ordinary syntax errors surface as regular warnings with rule
    // 'CssSyntaxError' (handled above; severity error → blocker). This
    // result.parseErrors channel is a separate, rarely-populated postcss
    // mechanism — kept for completeness and made a blocker too, so no parse
    // failure can pass the gate.
    for (const parseError of result.parseErrors || []) {
      findings.push({
        file: result.source,
        line: parseError.line || 1,
        column: parseError.column || 1,
        message: parseError.text,
        ruleId: 'stylelint/parse-error',
        severity: 'blocker',
      });
    }
  }
}

async function lintStyles(files) {
  const findings = [];
  const cssFiles = files.filter((file) => file.endsWith('.css'));
  const scssFiles = files.filter((file) => file.endsWith('.scss'));
  const lessFiles = files.filter((file) => file.endsWith('.less'));

  await runStylelint(cssFiles, null, findings);
  await runStylelint(scssFiles, 'postcss-scss', findings);
  await runStylelint(lessFiles, 'postcss-less', findings);

  return findings;
}

module.exports = { lintStyles };
