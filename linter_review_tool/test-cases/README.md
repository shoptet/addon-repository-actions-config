# Test Cases for Shoptet Addon Review System

Examples demonstrating good and bad practices according to `PRIRUCKA.md`.

## Structure

- `good/` — code that passes all rules (exit code 0, no findings)
- `bad/` — code that violates one or more rules (exit code 1 when a blocker is hit)

## Usage

```bash
npm run review test-cases/bad/
npm run review test-cases/good/
```

## Severity

Findings map to the handbook marks: `❌` → **blocker** (error, fails CI),
`⚠️`/`💡` → **recommendation** (warning).

## Bad cases → rules

| File | Rules triggered | PRIRUCKA |
|------|-----------------|----------|
| `bad-xss.js` | `shoptet/no-xss`, `prefer-template` | A1 |
| `bad-testid.js` | `shoptet/no-testid-selector` | B7 |
| `bad-settimeout.js` | `shoptet/no-settimeout-hack`, `shoptet/prefer-shoptet-init` | B5 |
| `bad-czech-comments.js` | `shoptet/no-czech-comments` | I1 |
| `bad-commented-code.js` | `shoptet/no-commented-code` | F1 |
| `bad-misc-practices.js` | `shoptet/no-target-blank` (A5), `eqeqeq` (E4), `no-param-reassign` (A3), `shoptet/hardcoded-breakpoints` (B2), `shoptet/no-redundant-checks` (B4), `shoptet/localstorage-try-catch` (E7) | A3/A5/B2/B4/E4/E7 |
| `bad-shoptet-overwrite.js` | `shoptet/no-core-overwrite` | B6 |
| `bad-no-cache.js` | `shoptet/require-cache-path`, `no-console` | G6/F3 |
| `bad-var-usage.js` | `no-var`, `no-unused-vars` | D1/F2 |
| `bad-console.js` | `no-console` | F3 |
| `bad-deep-nesting.js` | `max-depth` | C4 |
| `bad-dead-code.js` | `no-unused-vars`, `no-unreachable` | F2 |
| `bad-styles.css` | `shoptet/min-font-size` (H3), `unit-disallowed-list` (H1, pt) | H1/H3 |
| `bad-styles.scss` | `shoptet/min-font-size`, `unit-disallowed-list` (SCSS syntax) | H1/H3 |
| `bad-markup.html` | `a11y/img-alt`, `a11y/clickable-noninteractive`, `html/deprecated-tag`, `a11y/target-blank`, `a11y/empty-interactive`, `a11y/autoplay-no-controls` | J1/J2/H2/A5 |

## Good cases

| File | Demonstrates |
|------|--------------|
| `good-cache-xhr.js` | fetch + `/cache/` + `response.ok`, ES module exports |
| `good-modern-syntax.js` | dataLayer access, `map`, early return, `const` |
| `good-event-delegation.js` | event delegation, ShoptetDOM lifecycle event |
| `good-safe-dom.js` | DOM API instead of innerHTML, `rel="noopener"`, localStorage in try/catch |
| `good-styles.css` | px units, readable font size |
| `good-markup.html` | alt text, `<button>`, semantic tag, `rel="noopener"`, autoplay + controls |

## Linters

The review tool dispatches by file type:

- **`.js`** → ESLint (`.eslintrc.js` + custom `shoptet/*` plugin in `rules/`)
- **`.css` / `.scss`** → stylelint (`.stylelintrc.js` + custom plugin in `stylelint-rules/`)
- **`.html` / `.htm`** → accessibility checker (`linters/html-linter.js`, parse5)

All `good/*` files must pass with exit code 0; all `bad/*` files trigger at least one finding.
