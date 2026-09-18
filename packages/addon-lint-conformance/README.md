# @shoptet/addon-lint-conformance

Shared **discovery conformance corpus** for the Shoptet partner-addon deploy gate. File discovery —
which candidate files a runner even considers before any rule ever runs — is the one
verdict-determining layer the other three shared packages (`@shoptet/addon-eslint-config`,
`@shoptet/addon-stylelint-config`, `@shoptet/addon-html-lint`) do not cover, because it lives above
the rule engines, in each runner's own file-walking code. Two runners each with their own file
discovery is where the fail-green history of this track happened once already (see
`doc/plans/rule-unification/a1.md`'s `cwd`/basePath bug) and could happen again, silently, on either
side. This package is what lets both sides prove — in their own CI, on every change — that they still
agree, without either owning a private copy of the test data.

**Consumers:** `shoptet/addon-repository-actions-config`'s `linter_review_tool` (this repo — see
`linter_review_tool/test/conformance.js`) and `shoptet/partner-cli`'s `shoptet validate` (that repo's
`B4` slice). Pinned to a git SHA by both, the same way as the other three packages until npm publish
rights land (`A2`).

## What's in here

- `corpus.json` — the manifest: a list of **shapes**, each a small directory tree plus the outcome a
  conforming runner must produce for it.
- `materialize.js` — `materializeShape(shape)`, a small helper that turns one manifest shape into a
  real temporary directory on disk (see "Why materialize, not commit" below). Optional — a consumer
  is free to write its own materializer from the schema instead; this one exists so neither repo has
  to write the same ~20 lines twice.
- `index.js` — exports `{ corpus, materializeShape }`.

## The manifest schema

`corpus.json` is `{ "$comment": string, "shapes": Shape[] }`. Each `Shape`:

| field | type | meaning |
| --- | --- | --- |
| `id` | string | Stable identifier. Used in temp-dir naming and in a runner's own test output — never change it once another repo has a test keyed on it. |
| `description` | string | Why this shape exists and what it proves. Read this before changing a shape's `expect` — it usually names the specific failure class. |
| `files` | `{ [relativePath]: content }` | Plain files to write, relative to the shape's materialized root. Directories are created as needed. |
| `symlinks` | `{ target, linkPath }[]` | *(optional)* Symlinks to create at materialize time, both paths relative to the shape's root. See "Why materialize, not commit" — these are never committed as real symlinks in this package. |
| `outsideRunnerTree` | `boolean` | *(optional, documentation only)* `true` marks a shape whose expectations only make sense when the runner under test is NOT rooted inside the directory this shape materializes into. Every shape already materializes outside any package's own source tree (temp dirs always do) — this flag exists so a reader immediately understands *why* a shape is shaped the way it is, not to trigger different runner behaviour. |
| `expect` | object | The outcome a conforming runner must produce. See below. |

`expect` fields (a runner uses only the ones relevant to what it can observe — not every runner
necessarily exposes all of these, but if it exposes the underlying concept, it must match):

| field | type | meaning |
| --- | --- | --- |
| `skippedPaths` | string[] | Relative paths that must appear in the runner's own "skipped" reporting (both runners have one: this repo's RDJSON `skipped` array, the CLI's own coverage-gap reporting). |
| `skippedDirs` | string[] | Like `skippedPaths`, but for a whole directory (e.g. `dist/`) — a runner may report the directory itself, every file under it, or both; the assertion is "no file under this directory produced a finding AND the gap is visible somewhere in output", not a literal string match. |
| `findings` | `{ ruleId, severity, path }[]` | Findings that MUST be present, exactly, at `blocker`/`recommend` severity (this corpus's two-level scale — map a runner's own severity vocabulary onto it the same way `linter_review_tool/review.js`'s `toRdjson()` does: error-equivalent → `blocker`, everything else reportable → `recommend`). |
| `findingsExcludePaths` | string[] | Paths that must produce **zero** findings — used for "this got skipped, so nothing inside it should ever have been reached" (e.g. a symlinked directory's contents). |
| `forbidMessagePattern` | string (regex source) | No finding's message may match this pattern. Used for the outside-tree case: a runner that silently drops files must never say so via a message like "outside of base path" that a fail-green check would treat as an ordinary (non-blocking) recommendation instead of a hard failure. |
| `failClosed` | boolean | `true` means: when every candidate file is skipped, the runner MUST NOT exit as if it ran a clean, empty, passing review. It must produce some observably different, distinguishable-from-success outcome (a non-zero exit code, a hard-failure/error signal — whatever that runner's own fail-closed contract is). This is deliberately abstract because the two runners' fail-closed *mechanisms* differ; what must be identical is that a mechanism exists and fires. |
| `exitCode` | number | *(optional)* Expected process exit code, for a runner that has one. |

## Why materialize, not commit

A symlinked directory cannot be committed to a git repository portably: how it round-trips through a
checkout depends on the platform and on `core.symlinks`, and CI runners are not guaranteed to
preserve it as an actual symlink rather than a text file containing a path. So the corpus stores the
**intent** — `shape.symlinks` — as plain manifest data, and every consumer creates the real symlink at
test time, into a throwaway temp directory, via `materializeShape` (or its own equivalent). This also
means the corpus never needs `fs.chmod`/executable-bit tracking or any other filesystem metadata this
format can't express portably — everything it needs to say is expressible as `{ path: content }` plus
one list of `{ target, linkPath }` pairs.

## Adding a shape

Add it to `corpus.json`, with an `id` that doesn't collide with an existing one, and describe the
failure class it catches in `description` — per this track's own rule (see `a3.md`'s definition of
done), every shape should be traceable to a specific way discovery can fail, not "for coverage's
sake". Then both consumers need a corresponding assertion — this package intentionally does not
enforce that by itself (it is data, not a test runner), so a new shape with no consumer reading it is
a silent no-op on both sides. `linter_review_tool/test/conformance.js`'s own header names where its
per-shape assertions live if you need a worked example of turning an `expect` block into a real check.
