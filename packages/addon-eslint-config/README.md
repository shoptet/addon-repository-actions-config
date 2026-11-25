# @shoptet/addon-eslint-config

The flat ESLint config and custom `shoptet/*` rules behind the Shoptet
partner-addon deploy gate (`linter_review_tool`'s PR-time linter, and — from
the next slice — the `shoptet` CLI's `validate` command). Plain CommonJS, no
build step.

## Contents

- `eslint.flat.config.js` — the flat config (ESLint 9/10). It declares the
  `shoptet` plugin itself, so consumers do not need to register it separately.
  Two blocks: JavaScript (`.js/.mjs/.cjs`, espree), and TypeScript and JSX
  (`.ts/.tsx/.mts/.cts/.jsx`, the typescript-eslint parser — syntax only, no
  `tsconfig`, no type-aware rules) with the core rules that misread type
  syntax swapped for their `@typescript-eslint/*` counterparts. The
  typescript-eslint plugin is registered with those extension rules narrowed
  (`rules/typescript-extensions.js`): they honour an `eslint-disable` naming
  the core id too, and unused-vars drops what TypeScript itself does not call
  unused. See the repository README's known limitations for what the
  TypeScript block deliberately does not check. The TypeScript toolchain
  (`typescript-eslint`, `typescript`) is a hard dependency, loaded with the
  config even by a consumer that lints only JavaScript.
- `rules/` — the 10 `shoptet/*` rules (`camelcase` — TypeScript and JSX files
  only; `no-var` — `.ts/.tsx/.mts/.cts` only; `no-script-url` — every
  extension, replacing core `no-script-url`; `no-core-overwrite`, `no-czech-comments`, `no-global-console`,
  `no-redundant-checks`, `no-settimeout-hack`, `no-testid-selector`,
  `prefer-fetch`), `rules/index.js` (the plugin object), and four shared
  helpers (`global-callee.js`, `script-detect.js`, `core-id-directives.js`,
  `typescript-extensions.js`). The rules look through
  TypeScript's type-only wrappers (`(window as any).shoptet = …`) and treat an
  ambient `declare const shoptet: X` as the global it describes.
- `reliable-rules.js` — the ESLint slice of `RELIABLE_RULES`, exported as a
  named `Set`. This is the allowlist of rules whose positive findings are
  trustworthy enough to gate a build. It also exports `RUNNER_RULES`, see
  below.

## Runner-emitted rule ids

Two ids in `RELIABLE_RULES` are **not** emitted by anything in this package:

| id | emitted when |
| --- | --- |
| `CodeQuality` | a file fails to parse — ESLint reports it with no `ruleId`, so the runner maps it onto this catch-all |
| `shoptet/es-module-required` | a file parses as a script but not as an ES module — detected by the runner via `parsesAsScript`, not by a rule |

They are in `RELIABLE_RULES` because a consumer's `isReliable(ruleId)` filter
runs over that same allowlist: leaving them out would silently drop those
findings and let unparseable JavaScript pass the gate. **A consumer that reuses
this package has to emit them itself** — nothing here will.

The distinction is machine-readable as the named export `RUNNER_RULES` (a
`Set`, always a subset of `RELIABLE_RULES`). `RELIABLE_RULES` remains the full
union, so existing consumers are unaffected.

## Usage

```js
const eslintConfig = require('@shoptet/addon-eslint-config');

// eslintConfig.configs.recommended — the flat config array, ready to pass as
//   `overrideConfig` (with `overrideConfigFile: true`) to `new ESLint(...)`.
// eslintConfig.plugin — the `shoptet` plugin object standalone.
// eslintConfig.parsesAsScript(source, filename?) — script-vs-module detection
//   helper. Pass the filename for TypeScript/JSX: without it the source is
//   parsed as plain JavaScript, as before.
// eslintConfig.RELIABLE_RULES — the ESLint slice of the allowlist.
// eslintConfig.RUNNER_RULES — the ids in that slice the runner must emit.
```

Core `no-script-url` is replaced by `shoptet/no-script-url` on every
extension. An `eslint-disable … no-script-url` comment or an inline config
naming the core id still applies; a consumer's own **config** override of
`no-script-url` (`rules: { 'no-script-url': 'off' }`) does not — override
`shoptet/no-script-url` instead.

The config is meant to be used **on its own**. It registers the `shoptet`
plugin and its own narrowed copy of the `@typescript-eslint` plugin, so do not
pass either plugin to `ESLint` again, and do not combine it with
typescript-eslint's configs in one array
(`[...tseslint.configs.recommended, ...configs.recommended]`): ESLint throws
`Cannot redefine plugin "@typescript-eslint"`.

A runner that consumes the config also has to mirror two runner-side
behaviours of `linter_review_tool/linters/eslint-linter.js`. It drops
"Definition for rule … was not found" reports (a directive naming an
unknown rule is never a code defect). On TypeScript/JSX files it also drops
reports from the core rules the config replaces there
(`CORE_RULES_REPLACED_ON`), which an inline config comment can switch back
on.

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
