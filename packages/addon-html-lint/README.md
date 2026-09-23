# @shoptet/addon-html-lint

The factual (parse5-based) HTML checks behind the Shoptet partner-addon
deploy gate. Plain CommonJS, no build step.

## Contents

- `lib/html-checks.js` — the parse5 traversal and the three checks:
  `a11y/img-alt`, `html/no-inline-script`, `html/deprecated-tag`.
- `index.js` — exports `lintHtmlSource(html, filePath)`, a pure function: it
  parses `html` and returns the findings array anchored on `filePath`. No
  `fs`, no fail-closed handling for an unreadable file — that stays in the
  runner (`linter_review_tool/linters/html-linter.js`'s `lintHtml(files)`,
  which reads each file and reports an unreadable one as a `CodeQuality`
  blocker before calling in here).
- `reliable-rules.js` — the HTML slice of `RELIABLE_RULES`, exported as a
  named `Set`.

## Usage

```js
const { lintHtmlSource, RELIABLE_RULES } = require('@shoptet/addon-html-lint');

const findings = lintHtmlSource(htmlSource, 'src/template.html');
```

## SemVer policy

This package's rule set is verdict-affecting — a consumer's gate reads it
directly. Follow strict SemVer, and in particular:

- **A new blocking (error-severity) rule is a MAJOR bump.** It fails builds
  that used to pass.
- **A new warning-level (non-gating) rule is a MINOR bump.**
- Anything else (bug fixes to detection logic, doc changes) is a PATCH.

## Deferred: registry consumption

`npm publish` rights in the `@shoptet` scope are not yet granted (see
`doc/plans/rule-unification/a2.md`). Until that lands, `linter_review_tool`
consumes this package via Yarn classic's `link:../packages/addon-html-lint`
protocol instead of an exact-pinned registry version in `yarn.lock`. That step
is deferred, not skipped.
