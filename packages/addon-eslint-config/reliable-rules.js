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
  // runner-synthesized (see RUNNER_RULES): fatal parse errors surface with
  // no ruleId → mapped to this catch-all
  'CodeQuality',

  // ── Custom Shoptet rules with trustworthy positives ──
  // runner-synthesized (see RUNNER_RULES): a file parses as script but not
  // as ES module
  'shoptet/es-module-required',
  'shoptet/no-testid-selector', // [data-testid] attribute selector
  'shoptet/no-redundant-checks', // typeof shoptet/dataLayer/screen
  'shoptet/no-settimeout-hack', // setTimeout(fn, 0)
  'shoptet/prefer-fetch', // new XMLHttpRequest
  'shoptet/no-core-overwrite', // global shoptet.* = …
  'shoptet/no-czech-comments', // Czech-specific diacritics in a comment
  'shoptet/no-global-console', // window./globalThis./self.console access
]);

/**
 * Runner-synthesized rule ids — the subset of `RELIABLE_RULES` that no rule
 * object in this package can ever emit.
 *
 * They are produced by the *runner* that drives ESLint (in this repository,
 * `linter_review_tool/linters/eslint-linter.js`) out of conditions ESLint
 * itself reports without a `ruleId`, or does not report at all. They are part
 * of `RELIABLE_RULES` because a consumer's `isReliable(ruleId)` filter runs
 * over the same allowlist — leaving them out would silently drop the findings.
 *
 * A consumer that reuses this package is responsible for emitting them itself;
 * nothing in this package will do it. `RELIABLE_RULES` stays the full union,
 * so existing consumers are unaffected.
 */
const RUNNER_RULES = new Set([
  // fatal parse error — ESLint reports it with no ruleId, the runner maps it
  // onto this catch-all id
  'CodeQuality',
  // file parses as script but not as ES module — detected by the runner via
  // `parsesAsScript`, not by any rule
  'shoptet/es-module-required',
]);

module.exports = { RELIABLE_RULES, RUNNER_RULES };
