/**
 * Reliable rule set — the only rules the linter reports.
 *
 * A rule qualifies when a POSITIVE finding is trustworthy (essentially zero
 * false positives). It may miss things (false negatives are acceptable for a
 * blocking gate); heuristic / contextual checks are the AI review skill's job.
 *
 * The set is matched against `finding.ruleId` exactly as it appears in output
 * (ESLint `no-var` / `shoptet/…`, stylelint `unit-disallowed-list` / `shoptet/…`,
 * HTML `a11y/…` / `html/…`).
 *
 * As of A2, this file hardcodes no rule id of its own: each linter's slice of
 * the allowlist now lives with that linter's own rule package, and this file
 * only assembles the union at load time. A leftover local entry here would be
 * invisible until A3's equality test compares this file's set against the
 * packages' — exactly the case that test exists to catch.
 */

const { RELIABLE_RULES: ESLINT_RELIABLE_RULES } = require('@shoptet/addon-eslint-config');
const { RELIABLE_RULES: STYLELINT_RELIABLE_RULES } = require('@shoptet/addon-stylelint-config');
const { RELIABLE_RULES: HTML_RELIABLE_RULES } = require('@shoptet/addon-html-lint');

const RELIABLE_RULES = new Set([
  ...ESLINT_RELIABLE_RULES,
  ...STYLELINT_RELIABLE_RULES,
  ...HTML_RELIABLE_RULES,
]);

// Any rule not in the set above is dropped from the output — either it is
// heuristic/contextual (the AI review skill's job, not this gate's), or it
// simply has not been vetted against the zero-FP bar yet. Absence here is a
// trust decision, not a claim that the rule is wrong.

function isReliable(ruleId) {
  return RELIABLE_RULES.has(ruleId);
}

module.exports = { RELIABLE_RULES, isReliable };
