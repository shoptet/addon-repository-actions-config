// Plugin OBJECTS, not relative path strings: a relative string passed via
// stylelint's `configFile` option resolves against the config file's own
// directory, but the same string passed via the `config` option resolves
// against the CALLER's cwd instead — a distinction that only matters once
// this config crosses a package boundary (`configFile` pointed straight at
// this very file; `config` does not know where it came from). Requiring the
// plugin modules here and handing stylelint the objects sidesteps both
// resolution rules entirely.
module.exports = {
  plugins: [
    require('./stylelint-rules/min-font-size'),
    require('./stylelint-rules/max-z-index'),
    require('./stylelint-rules/no-testid-selector'),
    require('./stylelint-rules/no-pt-unit'),
  ],
  rules: {
    // B7 ❌ — binding styles to Shoptet testids (blocker, mirrors the ESLint rule)
    'shoptet/no-testid-selector': true,
    // H1 — consistent units: no pt outside @media print (custom rule — the
    // stock unit-disallowed-list cannot scope by media and false-positives
    // on legitimate print styles)
    'shoptet/no-pt-unit': [true, { severity: 'warning' }],
    // H3 — keep text readable
    'shoptet/min-font-size': [12, { severity: 'warning' }],
    // H1 — avoid z-index wars
    'shoptet/max-z-index': [100, { severity: 'warning' }],
    // H1 — !important usually means overriding global/eshop styles
    'declaration-no-important': [true, { severity: 'warning' }],
    // H1 — duplicate selectors within a file are redundant overrides
    'no-duplicate-selectors': [true, { severity: 'warning' }],
    // catch obvious mistakes
    'color-no-invalid-hex': true,
    'no-duplicate-at-import-rules': [true, { severity: 'warning' }],
  },
};
