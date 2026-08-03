/**
 * Review profiles — which rules run in which mode.
 *
 *   full   (default, local): every rule (deterministic + heuristic).
 *   strict (CI / PR gate):   only rules whose POSITIVE finding is trustworthy
 *                            (essentially zero false positives). May miss things
 *                            (false negatives are acceptable for a blocking gate)
 *                            — the human / `full` run catches the rest.
 *
 * Single source of truth: the set below is matched against `finding.ruleId`
 * exactly as it appears in output (ESLint `no-var` / `shoptet/…`, stylelint
 * `unit-disallowed-list` / `shoptet/…`, HTML `a11y/…` / `html/…`).
 *
 * Categorisation mirrors COVERAGE.md: category A (100 % reliable) → strict;
 * category B (taint/regex/threshold/structural heuristics) → full only.
 */

const RELIABLE_RULES = new Set([
  // ── ESLint core: syntax / scope / dead code (deterministic) ──
  'no-var',
  'prefer-const',
  'no-implicit-globals',
  'no-redeclare',
  'eqeqeq',
  'prefer-template',
  'no-useless-concat',
  'radix',
  'camelcase',
  'no-eval',
  'no-implied-eval',
  'no-script-url',
  'no-unused-vars',
  'no-unreachable',
  'no-unused-expressions',
  'no-use-before-define',
  'no-param-reassign',
  'no-console',
  'no-extend-native',
  'no-global-assign',
  'no-mixed-spaces-and-tabs',
  // metrics — exact counts (threshold is a convention, detection is precise)
  'max-depth',
  'max-nested-callbacks',
  'max-lines',
  'max-lines-per-function',
  'max-statements',
  'complexity',
  // fatal parse errors surface with no ruleId → mapped to this catch-all
  'CodeQuality',

  // ── Custom Shoptet rules with trustworthy positives ──
  'shoptet/no-testid-selector', // data-testid literal
  'shoptet/no-redundant-checks', // typeof shoptet/dataLayer/screen
  'shoptet/no-settimeout-hack', // setTimeout(fn, 0)
  'shoptet/prefer-fetch', // new XMLHttpRequest
  'shoptet/no-core-overwrite', // shoptet.* = …
  'shoptet/require-cache-path', // literal Shoptet URL without /cache/
  'shoptet/no-czech-comments', // diacritics in a comment

  // ── stylelint: factual CSS checks ──
  'unit-disallowed-list',
  'declaration-no-important',
  'no-duplicate-selectors',
  'no-duplicate-at-import-rules',
  'color-no-invalid-hex',
  'shoptet/min-font-size',
  'shoptet/max-z-index',
  'stylelint/parse-error',

  // ── HTML: factual DOM checks (parse5) ──
  'a11y/img-alt',
  'html/deprecated-tag',
]);

// Any rule not in the set above (e.g. eslint:recommended rules we don't
// explicitly gate on) is dropped from the output. Heuristic/contextual checks
// live in the AI review skill, not here.

function isReliable(ruleId) {
  return RELIABLE_RULES.has(ruleId);
}

module.exports = { RELIABLE_RULES, isReliable };
