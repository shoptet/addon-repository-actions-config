/**
 * Reliable rule set — ESLint slice.
 *
 * A rule qualifies when a POSITIVE finding is trustworthy (essentially zero
 * false positives). It may miss things (false negatives are acceptable for a
 * blocking gate); heuristic / contextual checks are the AI review skill's job.
 *
 * The set is matched against `finding.ruleId` exactly as it appears in output
 * (ESLint `no-var` / `shoptet/…`).
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
  // Synthetic entry: emitted by the runner (`linters/eslint-linter.js` in
  // linter_review_tool), not by a rule object in this package — a file
  // parses as script but not as ES module.
  'shoptet/es-module-required', // file parses as script but not as ES module
  'shoptet/no-testid-selector', // [data-testid] attribute selector
  'shoptet/no-redundant-checks', // typeof shoptet/dataLayer/screen
  'shoptet/no-settimeout-hack', // setTimeout(fn, 0)
  'shoptet/prefer-fetch', // new XMLHttpRequest
  'shoptet/no-core-overwrite', // global shoptet.* = …
  'shoptet/no-czech-comments', // Czech-specific diacritics in a comment
  'shoptet/no-global-console', // window./globalThis./self.console access
]);

module.exports = { RELIABLE_RULES };
