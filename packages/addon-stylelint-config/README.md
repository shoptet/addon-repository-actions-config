# @shoptet/addon-stylelint-config

The stylelint config and custom `shoptet/*` plugin rules behind the Shoptet
partner-addon deploy gate. Plain CommonJS, no build step.

## Contents

- `stylelint.config.js` — the stylelint config. Plugins are declared as
  `require()`d objects rather than path strings, so the config resolves
  correctly whether a consumer passes it via stylelint's `config` option or
  bundles it across a package boundary (a relative plugin *string* would
  resolve against the caller's cwd via `config`, but against this file's own
  directory via `configFile` — two different rules, easy to get wrong once
  this config is no longer read from a fixed, known path).
- `stylelint-rules/` — the 4 plugin rules (`max-z-index`, `min-font-size`,
  `no-pt-unit`, `no-testid-selector`).
- `reliable-rules.js` — the stylelint slice of `RELIABLE_RULES`, exported as a
  named `Set`.

## Usage

```js
const stylelintConfig = require('@shoptet/addon-stylelint-config');

// stylelintConfig.configs.recommended — pass via stylelint's `config` option.
// stylelintConfig.RELIABLE_RULES — the stylelint slice of the allowlist.
```

## SemVer policy

This package's rule set is verdict-affecting — a consumer's gate reads it
directly. Follow strict SemVer, and in particular:

- **A new blocking (error-severity) rule is a MAJOR bump.** It fails builds
  that used to pass.
- **A new warning-level (non-gating) rule is a MINOR bump.**
- Anything else (bug fixes to detection logic, doc changes) is a PATCH.

If you are adding a rule and are unsure whether it should gate, that
uncertainty is itself the answer: ship it as a warning (MINOR) first.

## Deferred: registry consumption

`npm publish` rights in the `@shoptet` scope are not yet granted (see
`doc/plans/rule-unification/a2.md`). Until that lands, `linter_review_tool`
consumes this package via Yarn classic's
`link:../packages/addon-stylelint-config` protocol instead of an exact-pinned
registry version in `yarn.lock`. That step is deferred, not skipped.
