# Test Cases for Shoptet Addon Review System

Examples demonstrating good and bad practices for the linter rules.

**The machine-checked source of truth is [`expected.json`](expected.json)** —
it maps every `bad/` fixture to the exact set of ruleIds it must trigger, and
`test/selftest.js` (run as `npm test`, wired into CI via
`.github/workflows/selftest.yml`) verifies it on every change. `good/` fixtures
must produce zero findings, warnings included. A fixture missing from the spec
(or a spec entry without a file) fails the self-test.

## Structure

- `good/` — code that passes all rules (no findings at all)
- `bad/` — code that violates specific rules (see `expected.json` for which)

## Usage

```bash
npm run review test-cases/bad   # see the findings
npm test                        # snapshot-check fixtures against expected.json
```

## Severity

`❌` blocker (`error`, gates the PR) · `⚠️` recommendation (`warning`, informative).

## Linters

The review tool dispatches by file type:

- **`.js`** → ESLint (`.eslintrc.js` + custom `shoptet/*` plugin in `rules/`)
- **`.css` / `.scss` / `.less`** → stylelint (`.stylelintrc.js` + custom plugin in `stylelint-rules/`)
- **`.html` / `.htm`** → factual HTML checks (`linters/html-linter.js`, parse5)
