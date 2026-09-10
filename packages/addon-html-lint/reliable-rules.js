/**
 * Reliable rule set — HTML slice.
 *
 * A rule qualifies when a POSITIVE finding is trustworthy (essentially zero
 * false positives). It may miss things (false negatives are acceptable for a
 * blocking gate); heuristic / contextual checks are the AI review skill's job.
 *
 * The set is matched against `finding.ruleId` exactly as it appears in output
 * (HTML `a11y/…` / `html/…`).
 */

const RELIABLE_RULES = new Set([
  // ── HTML: factual DOM checks (parse5) ──
  'a11y/img-alt',
  'html/deprecated-tag',
  // policy blocker: inline JS would bypass the ENTIRE JS rule set (round 14)
  'html/no-inline-script',
]);

module.exports = { RELIABLE_RULES };
