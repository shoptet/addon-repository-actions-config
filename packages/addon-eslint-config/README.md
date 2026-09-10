# @shoptet/addon-eslint-config

The flat ESLint config and custom `shoptet/*` rules behind the Shoptet
partner-addon deploy gate (`linter_review_tool`'s PR-time linter, and — from
the next slice — the `shoptet` CLI's `validate` command). Plain CommonJS, no
build step.

## Contents

- `eslint.flat.config.js` — the flat config (ESLint 9/10). It declares the
  `shoptet` plugin itself, so consumers do not need to register it separately.
- `rules/` — the 7 `shoptet/*` rules (`no-core-overwrite`, `no-czech-comments`,
  `no-global-console`, `no-redundant-checks`, `no-settimeout-hack`,
  `no-testid-selector`, `prefer-fetch`), `rules/index.js` (the plugin object),
  and two shared helpers (`global-callee.js`, `script-detect.js`).
- `reliable-rules.js` — the ESLint slice of `RELIABLE_RULES`, exported as a
  named `Set`. This is the allowlist of rules whose positive findings are
  trustworthy enough to gate a build; it includes the synthetic
  `shoptet/es-module-required` id (emitted by the runner, not by a rule object
  in this package — see the comment in `reliable-rules.js`).

## Usage

```js
const eslintConfig = require('@shoptet/addon-eslint-config');

// eslintConfig.configs.recommended — the flat config array, ready to pass as
//   `overrideConfig` (with `overrideConfigFile: true`) to `new ESLint(...)`.
// eslintConfig.plugin — the `shoptet` plugin object standalone.
// eslintConfig.parsesAsScript — script-vs-module detection helper.
// eslintConfig.RELIABLE_RULES — the ESLint slice of the allowlist.
```

## SemVer policy

This package's rule set is verdict-affecting — a consumer's gate reads it
directly. Follow strict SemVer, and in particular:

- **A new blocking (error-severity) rule is a MAJOR bump.** It fails builds
  that used to pass.
- **A new warning-level (non-gating) rule is a MINOR bump.**
- Anything else (bug fixes to detection logic, doc changes) is a PATCH.

If you are adding a rule and are unsure whether it should gate, that
uncertainty is itself the answer: ship it as `warn` (MINOR) first.

## Deferred: registry consumption

`npm publish` rights in the `@shoptet` scope are not yet granted (see
`doc/plans/rule-unification/a2.md`). Until that lands, `linter_review_tool`
consumes this package via Yarn classic's `link:../packages/addon-eslint-config`
protocol instead of an exact-pinned registry version in `yarn.lock`. That step
is deferred, not skipped.
