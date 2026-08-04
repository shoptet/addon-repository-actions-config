// Legacy pre-module script: valid classic JS, but fails to parse as an ES
// module ('with' is forbidden in strict mode). Expected: the actionable
// shoptet/es-module-required blocker PLUS the regular rule findings from the
// script-mode run (no-var, no-console) — not one cryptic parse error.
var settings = { mode: 'legacy' };
with (settings) {
  console.log(mode);
}
