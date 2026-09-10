/**
 * Reliable rule set — stylelint slice.
 *
 * A rule qualifies when a POSITIVE finding is trustworthy (essentially zero
 * false positives). It may miss things (false negatives are acceptable for a
 * blocking gate); heuristic / contextual checks are the AI review skill's job.
 *
 * The set is matched against `finding.ruleId` exactly as it appears in output
 * (stylelint `unit-disallowed-list` / `shoptet/…`).
 */

const RELIABLE_RULES = new Set([
  // ── stylelint: factual CSS checks ──
  'shoptet/no-pt-unit', // pt outside @media print
  'declaration-no-important',
  'no-duplicate-selectors',
  'no-duplicate-at-import-rules',
  'color-no-invalid-hex',
  'shoptet/min-font-size',
  'shoptet/max-z-index',
  // Stylesheet that fails to parse — stylelint reports it as a regular warning
  // with rule 'CssSyntaxError' and severity error (NOT via result.parseErrors),
  // so this is what makes broken CSS gate, mirroring CodeQuality for JS.
  'CssSyntaxError',
  'stylelint/parse-error',
]);

module.exports = { RELIABLE_RULES };
