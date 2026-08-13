module.exports = {
  plugins: [
    './stylelint-rules/min-font-size',
    './stylelint-rules/max-z-index',
    './stylelint-rules/no-testid-selector',
    './stylelint-rules/no-pt-unit',
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
