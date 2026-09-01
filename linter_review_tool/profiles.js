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
  // runtime-fact family from eslint:recommended — deterministic guarantees
  // of a runtime failure (TypeError and friends), ~zero-FP by construction
  'no-const-assign',
  'no-dupe-keys',
  'no-dupe-args',
  'no-obj-calls',
  'no-func-assign',
  'use-isnan',
  'valid-typeof',
  'no-import-assign',
  'no-class-assign',
  'getter-return',
  'no-setter-return',
  'no-dupe-else-if',
  'no-self-assign',
  // textbook production leftover — deterministic, zero-FP, parity with the
  // zero-console policy (round 12)
  'no-debugger',
  // fatal parse errors surface with no ruleId → mapped to this catch-all
  'CodeQuality',

  // ── Custom Shoptet rules with trustworthy positives ──
  'shoptet/es-module-required', // file parses as script but not as ES module
  'shoptet/no-testid-selector', // [data-testid] attribute selector
  'shoptet/no-redundant-checks', // typeof shoptet/dataLayer/screen
  'shoptet/no-settimeout-hack', // setTimeout(fn, 0)
  'shoptet/prefer-fetch', // new XMLHttpRequest
  'shoptet/no-core-overwrite', // global shoptet.* = …
  'shoptet/no-czech-comments', // Czech-specific diacritics in a comment
  'shoptet/no-global-console', // window./globalThis./self.console access

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

  // ── HTML: factual DOM checks (parse5) ──
  'a11y/img-alt',
  'html/deprecated-tag',
  // policy blocker: inline JS would bypass the ENTIRE JS rule set (round 14)
  'html/no-inline-script',
]);

// Any rule not in the set above is dropped from the output — either it is
// heuristic/contextual (the AI review skill's job, not this gate's), or it
// simply has not been vetted against the zero-FP bar yet. Absence here is a
// trust decision, not a claim that the rule is wrong.

function isReliable(ruleId) {
  return RELIABLE_RULES.has(ruleId);
}

module.exports = { RELIABLE_RULES, isReliable };
