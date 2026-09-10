/**
 * @shoptet/addon-html-lint — package entry point.
 *
 * Exports `lintHtmlSource(html, filePath)` — the pure parse5 traversal and
 * the three factual checks (`a11y/img-alt`, `html/no-inline-script`,
 * `html/deprecated-tag`) — and the HTML slice of `RELIABLE_RULES`.
 */

const { lintHtmlSource } = require('./lib/html-checks');
const { RELIABLE_RULES } = require('./reliable-rules');

module.exports = {
  lintHtmlSource,
  RELIABLE_RULES,
};
