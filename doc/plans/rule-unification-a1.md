# A1 — ESLint 8 → 9, flat config, and the `cwd`/basePath fix

> **Slice 2 of 8 in the rule-unification track.** [`README.md`](./README.md) indexes this
> repository's half; the track index lives in the CLI repo at `doc/plans/rule-unification.md`.
> Previous: [`A0`](./rule-unification-a0.md). Next: [`A2`](./rule-unification-a2.md).
>
> **Status: not started.** Everything below was measured by performing the port on a scratch copy of
> `main`: `node test/selftest.js` went from 5 failures to 1, and that last one is a deliberate
> snapshot update. Final shape: **10 files, ~115 changed lines, 1 new 18-line file, 1 line of
> `expected.json`.**

## Why this is its own slice

`.eslintrc.js` cannot survive. ESLint 9 still *supports* eslintrc, but this repo's own custom rules
already cannot run on it: `context.getScope()` was removed in ESLint 9 in **both** config modes. And
ESLint 10 additionally removes `context.getSourceCode()`, `getFilename()` and `getCwd()`, drops
`@eslint/eslintrc` (so `FlatCompat` is unavailable), and rejects
`new Linter({ configType: "eslintrc" })` outright.

So the flat-config migration is forced by the 8 → 9 step, not deferred to 10. Doing it as its own
slice means the 53-fixture selftest attributes every finding change to one cause.

Stylelint is **not** touched here. It stays at 15.11; the shared package peers `>=15 <18`, so the CLI
sitting on 17 is compatible by construction. Measured for confidence, not for this slice: all four
custom stylelint plugin rules and `.stylelintrc.js` run **verbatim** on 17.14.1 with zero code
changes.

## The failure this slice must not ship

**In flat config, `cwd` becomes `basePath`, and every file outside it is dropped.**

`linters/eslint-linter.js` sets `cwd: ROOT`, where `ROOT` is the tool's own directory. The workflow
runs:

```yaml
run: node review-tool/linter_review_tool/review.js src --rdjson > review-findings.json
```

`src/` is a **sibling** of `review-tool/`, therefore outside `basePath`. Measured output for a file in
that position:

```json
{"message":"File ignored because outside of base path.","severity":"WARNING","code":{"value":"CodeQuality"}}
```

`WARNING` is a *recommendation*, not a blocker. The gate counts only `ERROR`. So **the JS half of the
gate reports zero blockers on every PR and the workflow goes green.** There is no `basePath` option
in ESLint 9 or 10 to opt out with.

This behaviour is **not** ESLint-10-only — it exists in 9 too, introduced in **9.5.0**. On 9.0–9.4 the
same file yields a different message, which is why the shared packages floor their peer range at
`>=9.5.0` rather than `^9.0.0`.

The fix: derive `cwd` from the **common ancestor of the resolved file list** rather than hardcoding
the tool's directory. That is most of the ~35 changed lines in `linters/eslint-linter.js`.

**The existing selftest cannot catch this** — `good/` and `bad/` both live inside `ROOT`. It surfaced
only incidentally, through three tmp-dir assertions written for unrelated purposes. A fixture for the
real CI topology is part of this slice's definition of done.

## Scope

### Flat config

`.eslintrc.js` → a new `eslint.flat.config.js` (**CommonJS is fine** — `module.exports = [...]`
loads correctly as `overrideConfigFile`). `extends: 'eslint:recommended'` becomes `@eslint/js`, and
`env: { browser: true, es2021: true }` becomes `languageOptions.globals` via the `globals` package —
two new dependencies.

**Do not spread `js.configs.recommended`.** That set is 61 rules on ESLint 9 and 64 on ESLint 10
(9 → 10 adds `no-unassigned-vars`, `no-useless-assignment`, `preserve-caught-error` and removes
nothing). Since [`A2`](./rule-unification-a2.md) publishes this config for a consumer on ESLint 10,
spreading it would make one package mean two rule sets. Enumerate the rules, and pin `@eslint/js` as
a regular dependency — it does not track eslint's version (latest is 10.0.1 while eslint is 10.10.0;
the 9.x line is 9.39.5).

### Removed `ESLint` options

| option | on ESLint 9/10 | replacement |
| --- | --- | --- |
| `useEslintrc: false` | `Invalid Options: Unknown options` | drop — `overrideConfigFile` already suppresses discovery |
| `resolvePluginsRelativeTo: ROOT` | `Invalid Options: Unknown options` | drop — `plugins: { shoptet: … }` is already programmatic |
| `overrideConfigFile: '.eslintrc.js'` | throws `Key "env": This appears to be in eslintrc format` | point at the flat config |
| `cwd: ROOT` | accepted, but collapses `basePath` | common ancestor of the file list |
| `overrideConfig: { parserOptions: { sourceType: 'script' } }` | eslintrc key | `overrideConfig: { languageOptions: { sourceType: 'script' } }` |

`plugins: { shoptet: require('../rules') }` **works unchanged**. `ESLint` remains the correct class —
do not reach for `loadESLint()`, which can return the legacy class.

Isolation is preserved: verified against a target directory carrying its own `eslint.config.js`
(`{rules:{'no-console':'off'}}`) *and* an `.eslintignore` naming `src/` — the port still reported
`no-console`. `overrideConfigFile` is the correct flat-config replacement for `useEslintrc: false`.

### The 25 removed-API call sites

All mechanical. A blanket substitution did all of them, because every site either sits directly in a
visitor with `node` in scope or in a helper that already takes the node as a parameter:

```
context.getScope()      → context.sourceCode.getScope(node)
context.getSourceCode() → context.sourceCode
context.getFilename()   → context.filename
```

| file | `getScope()` | `getSourceCode()` | `getFilename()` |
| --- | --- | --- | --- |
| `rules/shoptet-no-core-overwrite.js` | 14 | 2 | 1 |
| `rules/shoptet-no-global-console.js` | 2 | 1 | — |
| `rules/shoptet-no-settimeout-hack.js` | 2 | — | — |
| `rules/shoptet-no-redundant-checks.js` | 1 | — | — |
| `rules/shoptet-prefer-fetch.js` | 1 | — | — |
| `rules/shoptet-no-czech-comments.js` | — | 1 | — |
| `rules/shoptet-no-testid-selector.js` | clean — touches no `context.*` API | | |

Two scope semantics were verified rather than assumed, both identical after the change:

- `shoptet-no-core-overwrite.js`'s `Program` handler, whose comment records that `getScope()` at
  `Program` returns the **global** scope even in module mode. `sourceCode.getScope(programNode)`
  behaves the same, so the existing workaround still applies verbatim.
- the same file's `context.getScope().upper` at a `FunctionDeclaration` — still `function`, with
  `upper` being `module`/`global`.

Not problems, verified: every rule already declares `schema: []`, so ESLint 9's schema requirement is
satisfied; all are object-style with `create()`; non-standard `meta.docs` keys report fine;
`context.report({ loc, messageId })` without `node` still works; there is no code-path-analysis
exposure anywhere; `getRulesMetaForResults` is not used.

### Two behavioural deltas

**`no-unused-vars`'s `caughtErrors` default flipped `"none"` → `"all"` in ESLint 9.** So
`try {} catch (error) {}` becomes a **blocker**. This broke a *good* fixture during the port
(`good/good-safe-dom.js`), and it matters far beyond the fixture: an unused catch binding is
extremely common in partner addon code, so shipping without the fix is a mass false-positive blocker
on every PR. One word:

```js
'no-unused-vars': ['error', { vars: 'all', args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
```

**`no-implicit-globals` now also fires on `shoptet = {}` in module mode**, duplicating
`no-global-assign` on the same line. This is the one surviving selftest failure and it is not a false
positive — one line of `expected.json`, or drop `no-implicit-globals` from `RELIABLE_RULES` if two
comments on one line is unacceptable.

`eslint:recommended` churn is otherwise **neutralized by `RELIABLE_RULES`**: none of the rules added
between majors are in the allowlist, so `isReliable()` filters them out and `expected.json` is
insulated by construction. Of the rules dropped between 8 and 9, only `no-mixed-spaces-and-tabs` is
both allowlisted and pinned, and the config sets it explicitly, so it keeps firing.

### Dependency moves

- `espree` `^9.6.1` → `^10.4.0` — the line ESLint 9 bundles (9.5.0 depends on `espree@^10.0.1`,
  9.39.5 on `^10.4.0`; `^11.x` is ESLint **10**'s espree and would leave the oracle a major *ahead*
  of the linter's own parser). **Not cosmetic:** `rules/script-detect.js` uses espree directly as
  the oracle for `parsesAsScript`, which decides `shoptet/es-module-required` *and* the
  `no-unused-vars` trust filter. Leaving espree 9 pinned means the oracle and the linter's own parser
  disagree about `ecmaVersion: 'latest'`, so a file using newer syntax is misclassified as "not a
  module" and silently loses `no-unused-vars`.
  Verify after the bump that `yarn why espree` shows a **single** resolution, matching the version
  ESLint 9 pulls in itself.
- `@eslint-community/eslint-utils` `^4.4.0` → `^4.10.0` to dedupe. `findVariable` is unaffected; the
  peer range already admits ESLint 10.
- new: `@eslint/js` (pinned), `globals`.
- `parse5` `^6.0.1` → `^7.3.0` may ride along or wait for [`A2`](./rule-unification-a2.md). Measured
  a **no-op**: the repo's actual `html-linter.js` run against its own 7 HTML test cases under 6.0.1,
  7.3.0 and 8.0.1 produced 10 findings with identical file, line, column, ruleId, severity and
  message. parse5 7 is **not** ESM-only — it has a dual `exports` map and `require('parse5')`
  resolves to `dist/cjs/index.js`. Its two real breaks (no ESM `default` export;
  `require('parse5/package.json')` throws) are not in this code's path.
- Regenerate `yarn.lock` — both workflows run `yarn --frozen-lockfile`.
- **Pin `node-version` explicitly** (`"22.13"` or `"24"`) rather than `"22"`. This is *not* because
  ESLint 9 requires it — ESLint 9's engine floor is `^18.18.0 || ^20.9.0 || >=21.1.0`, which bare
  `"22"` satisfies. It is to satisfy the ESLint **10** side of the `>=9.5.0 <11` peer range
  [`A2`](./rule-unification-a2.md) publishes: ESLint 10's floor is
  `^20.19.0 || ^22.13.0 || >=24`, so the moment CI or the equality test runs against 10, a Node below
  22.13 fails the engine check.

The tool stays **CommonJS**. Nothing forces ESM: ESLint is `"type": "commonjs"`, and even Stylelint
17's ESM-only source is reachable via `require()` on Node ≥20.19.

## Definition of done

- `node test/selftest.js` green, with exactly the two intended `expected.json`/config changes above
  and no others. The frozen baseline from [`A0`](./rule-unification-a0.md) is the comparison.
- **A new selftest fixture runs `review.js` against a target directory outside the tool tree** and
  asserts a known blocker is reported as a blocker. Without this, the same class of failure recurs on
  the next ESLint major and it fails *green*.

  This needs no new infrastructure — it is **not** a `test-cases/` fixture and should not be built as
  one. Section 6 of `test/selftest.js` already invokes `review.js` in exactly the CI topology: a
  `fs.mkdtempSync` target passed as an absolute path, with `runRaw`'s `cwd: ROOT` leaving the tool's
  own directory as the working directory while the target sits outside it. The existing skip and
  symlink assertions use that harness already; both only assert on `skipped`. The missing piece is
  ~5 lines in the same block: write a file with a known blocker into the tmpdir and assert it comes
  back in `diagnostics` at **blocker severity**, not merely that the run exited 0.
- The gate still gates: a real PR with a known blocker still fails.
- `caughtErrors: 'none'` in place; no mass false positive on `catch (error) {}`.

## Review checklist

- **Perturbation, the important one:** revert the `cwd` fix and confirm the new outside-the-tree
  fixture fails. If the suite stays green, the fixture is decorative and this slice has not delivered
  its main value.
- **Perturbation:** remove `caughtErrors: 'none'` and confirm a good fixture fails.
- Confirm nothing spreads `js.configs.recommended`, and that `@eslint/js` is a pinned dependency
  rather than a peer.
- Spot-check the `Program` and `FunctionDeclaration` scope handlers in
  `shoptet-no-core-overwrite.js` by hand — a blanket substitution is correct here, but these two are
  the sites where "correct" depended on measured scope semantics.
- **Perturbation on the `Program` workaround, because a hand spot-check cannot settle it:** the
  `childScopes.find(s => s.type === 'module' && s.block === node)` step exists only because
  `getScope()` at `Program` returns the *global* scope even in module mode. If
  `sourceCode.getScope(programNode)` were to return the module scope directly, the `find` matches
  nothing and the whole check becomes a silent no-op with no failing test. So: bypass the
  `childScopes.find` step, use the scope `getScope(programNode)` returns directly, and confirm the
  rule still fires on a module-mode file that overwrites a core name. Firing either way proves the
  workaround is safe; firing only with it proves it is still load-bearing.
- Confirm the espree bump actually deduped, by reading `yarn.lock` rather than `package.json`. Two
  espree copies is the silent-false-negative case.
- Confirm `overrideConfigFile` still isolates: a target directory with its own eslint config and
  ignore file must not change the findings.
