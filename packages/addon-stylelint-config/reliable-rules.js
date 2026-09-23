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
  // runner-synthesized (see RUNNER_RULES) — parse-failure catch-alls
  'CssSyntaxError',
  'stylelint/parse-error',
]);

/**
 * Runner-synthesized rule ids — the subset of `RELIABLE_RULES` that no rule
 * in this package's config can ever emit.
 *
 * They are produced by the *runner* that drives stylelint (in this repository,
 * `linter_review_tool/linters/stylelint-linter.js`) out of parse failures
 * rather than by any configured rule. They are part of `RELIABLE_RULES`
 * because a consumer's `isReliable(ruleId)` filter runs over the same
 * allowlist — leaving them out would silently drop the findings and let
 * unparseable CSS pass the gate.
 *
 * A consumer that reuses this package is responsible for emitting them itself;
 * nothing in this package will do it. `RELIABLE_RULES` stays the full union,
 * so existing consumers are unaffected.
 */
const RUNNER_RULES = new Set([
  // A stylesheet that fails to parse: stylelint reports it as a regular
  // warning with rule 'CssSyntaxError' and severity error (NOT via
  // result.parseErrors), which is what makes broken CSS gate — mirroring
  // CodeQuality for JS.
  'CssSyntaxError',
  // Defensive channel for `result.parseErrors`; ordinary syntax errors
  // surface as CssSyntaxError instead, so this one has no fixture.
  'stylelint/parse-error',
]);

module.exports = { RELIABLE_RULES, RUNNER_RULES };
