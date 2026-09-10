/**
 * HTML linter — reads files and hands each one's source to
 * `@shoptet/addon-html-lint`'s `lintHtmlSource`, which does the parse5 parse,
 * traversal, and the three factual checks (a11y/img-alt, html/no-inline-script,
 * html/deprecated-tag). The file-reading loop and the fail-closed handling for
 * an unreadable file stay here (A2 decision 5) — the package is a pure
 * function of HTML source text, not a file-system consumer.
 */

const fs = require('fs');
const { lintHtmlSource } = require('@shoptet/addon-html-lint');

function lintHtml(files) {
  const findings = [];
  for (const file of files) {
    let html;
    try {
      html = fs.readFileSync(file, 'utf8');
    } catch (error) {
      // Fail closed: an unreadable file must not silently pass as clean.
      findings.push({
        file,
        line: 1,
        column: 1,
        message: `Could not read file: ${error.message}`,
        ruleId: 'CodeQuality',
        severity: 'blocker',
      });
      continue;
    }
    findings.push(...lintHtmlSource(html, file));
  }
  return findings;
}

module.exports = { lintHtml };
