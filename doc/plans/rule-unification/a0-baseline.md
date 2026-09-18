# A0 — frozen baseline (measured retroactively)

> Produced by unit **U3** of the MVP-completion run, against branch `zibby` (post-A1/A2), not
> against `main`. A0 was supposed to run *before* A1/A2 (see [`a0.md`](./a0.md)); it did not, so this
> baseline is written after the fact — see "What the ordering slip actually cost" below for the
> honest accounting the plan asked for.

## How this was produced

```bash
cd linter_review_tool
yarn install      # + a root-level `yarn install` first — packages/* are yarn-workspace `link:` deps
yarn test         # node test/selftest.js — 63/63 checks green
```

Then the exact `rule@severity` set was derived by **running** the code path `review.js` actually
imports post-A2 (`linter_review_tool/profiles.js` → `require('@shoptet/addon-eslint-config')` /
`@shoptet/addon-stylelint-config` / `@shoptet/addon-html-lint`), not by reading `expected.json` — per
`a0.md`'s own review checklist ("the two can disagree, and which one is true is the whole question").
Severities were cross-checked against each linter's severity-mapping code
(`linters/eslint-linter.js`, `linters/stylelint-linter.js`, `linters/html-linter.js`, and the three
packages' rule-definition files), not inferred from the allowlist alone.

**Commit measured:** `1b4fb93` on `run/u3-a0` (== `origin/zibby` at the time this was written — no
commits ahead of it yet).

**Result:** `yarn test` — **63/63 checks passed** (62 `RELIABLE_RULES` pin assertions + the
`review.js` contract suite). No failures, no skips.

## The effective `rule@severity` set (62 rules, 3 linters)

`RELIABLE_RULES` is the *only* thing the gate reports; a configured-but-absent rule is invisible by
design (see `profiles.js`'s own comment). Of the 62, **41 are blockers** (gate the PR) and **21 are
recommendations** (posted, never gate).

### ESLint — 50 rules (36 blocker / 14 recommendation)

Source: `packages/addon-eslint-config/eslint.flat.config.js` (severity) +
`packages/addon-eslint-config/reliable-rules.js` (allowlist) + `linters/eslint-linter.js` (the one
rule the runner synthesizes itself, not the config).

| rule | severity |
| --- | --- |
| `no-const-assign` | blocker |
| `no-dupe-keys` | blocker |
| `no-dupe-args` | blocker |
| `no-obj-calls` | blocker |
| `no-func-assign` | blocker |
| `use-isnan` | blocker |
| `valid-typeof` | blocker |
| `no-import-assign` | blocker |
| `no-class-assign` | blocker |
| `getter-return` | blocker |
| `no-setter-return` | blocker |
| `no-dupe-else-if` | blocker |
| `no-self-assign` | blocker |
| `no-debugger` | blocker |
| `no-eval` | blocker |
| `no-implied-eval` | blocker |
| `no-script-url` | blocker |
| `no-param-reassign` | blocker |
| `eqeqeq` | blocker |
| `no-console` | blocker |
| `no-unused-vars` | blocker |
| `no-unreachable` | blocker |
| `no-unused-expressions` | blocker |
| `no-use-before-define` | blocker |
| `no-var` | blocker |
| `no-implicit-globals` | blocker |
| `no-redeclare` | blocker |
| `no-global-assign` | blocker |
| `max-depth` | blocker |
| `max-nested-callbacks` | blocker |
| `shoptet/no-testid-selector` | blocker |
| `shoptet/no-settimeout-hack` | blocker |
| `shoptet/no-core-overwrite` | blocker |
| `shoptet/no-global-console` | blocker |
| `CodeQuality` (fatal parse-error catch-all) | blocker |
| `shoptet/es-module-required` (synthesized by the runner, not a config rule) | blocker |
| `prefer-const` | recommendation |
| `prefer-template` | recommendation |
| `no-useless-concat` | recommendation |
| `radix` | recommendation |
| `camelcase` | recommendation |
| `no-mixed-spaces-and-tabs` | recommendation |
| `no-extend-native` | recommendation |
| `max-lines` | recommendation |
| `max-lines-per-function` | recommendation |
| `max-statements` | recommendation |
| `complexity` | recommendation |
| `shoptet/no-czech-comments` | recommendation |
| `shoptet/prefer-fetch` | recommendation |
| `shoptet/no-redundant-checks` | recommendation |

### Stylelint — 9 rules (3 blocker / 6 recommendation)

Source: `packages/addon-stylelint-config/stylelint.config.js` (severity option; no explicit
`severity` ⇒ stylelint default `error`) + `reliable-rules.js` + `linters/stylelint-linter.js`'s
mapping (`severity === 'error' ? 'blocker' : 'recommend'`, plus its own hardcoded `CssSyntaxError`/
parse-error blockers).

| rule | severity |
| --- | --- |
| `color-no-invalid-hex` | blocker |
| `CssSyntaxError` | blocker |
| `stylelint/parse-error` | blocker |
| `shoptet/no-pt-unit` | recommendation |
| `declaration-no-important` | recommendation |
| `no-duplicate-selectors` | recommendation |
| `no-duplicate-at-import-rules` | recommendation |
| `shoptet/min-font-size` | recommendation |
| `shoptet/max-z-index` | recommendation |

Note: the stylelint config also sets `shoptet/no-testid-selector: true`, but that rule id is **not**
in the stylelint package's `RELIABLE_RULES` slice, so a positive from it is filtered out of the
gate's output entirely — it never reaches a partner. (The ESLint-side `shoptet/no-testid-selector`
above is a separate rule of the same name in a different linter/package.)

### HTML — 3 rules (2 blocker / 1 recommendation)

Source: `packages/addon-html-lint/lib/html-checks.js` (hardcoded per-check severity) +
`reliable-rules.js`.

| rule | severity |
| --- | --- |
| `a11y/img-alt` | blocker |
| `html/no-inline-script` | blocker |
| `html/deprecated-tag` | recommendation |

## The `max-lines` question

**Resolved by `main`'s own history — not left open.** `fix/large-file-inline-comments`'s commit
`22d95e9` did briefly promote `max-lines` from `warn` to `error` (200-line threshold) directly in
`linter_review_tool/.eslintrc.js`. But that change was **explicitly reverted on `main` itself**, two
commits later, by `59412fa` ("Audit follow-ups: catalog alignment, residual parser hole,
hardening"):

> Decisions: `max-lines: error/300 -> warn/400` per catalog C1 (length alone must not block)

`59412fa` is an ancestor of `main`'s current tip, and `main`'s current tip is an ancestor of `zibby`.
So today, on both `main` and `zibby`, `max-lines` is `warn`/`recommend`, threshold 400 — this is
already what `packages/addon-eslint-config/eslint.flat.config.js:149` ships, and what the table above
lists. There is nothing for the owner to decide here: `main` already chose "recommendation", after
trying "blocker" and rejecting it on policy grounds (per the rules catalog, "length alone does not
block"). No diff to the frozen baseline is implied.

## Branch audit

| branch | touches rule config/severities/`profiles.js`? | already in `main`? | already in `zibby`? | conflicts with `zibby`? |
| --- | --- | --- | --- | --- |
| `fix/large-file-inline-comments` | yes (severity mapping, `max-lines`, inline-comment cap) — but see above, its `max-lines` change was later reverted on `main` itself | **yes** — `git merge-base --is-ancestor origin/fix/large-file-inline-comments origin/main` succeeds; tip `a3db61e` is a `main` ancestor | yes (same ancestry) | n/a — nothing to merge, already contained |
| `fix/merge-audit-base-branch-guard` | no — governance/merge-audit only | **yes** — tip `cd428a6` is a `main` ancestor | yes | n/a |
| `feature/ai-review-skill` | no (docs/rule catalogue prose only, not `profiles.js`/severities) | **yes** — tip `21c7560` is a `main` ancestor | yes | n/a |
| `node22-update` | no — `default.workflow.yml` only (build/artifact pipeline) | **no** — real diff vs `main` (17 insertions / 51 deletions), hardcodes `node-version: '22'` with no `node_version` input at all | no | **yes** — `git merge` produces a real conflict in `.github/workflows/default.workflow.yml` (this branch predates PR #13's `node_version` input and the Node-24 default) |
| `webpack` | no — `default.workflow.yml` only | no (differs from `main` the same way, minus 4 lines already present in `node22-update`) | no | yes, same file, same reason |

All five branches audited by content (diff against `origin/main`, and against `zibby`/`HEAD`), not by
commit hash — A1/A2 recommitted history, so hash-based comparison would have been meaningless.

**No branch was closed, deleted, or pushed to.** They belong to other people; per this unit's brief,
only recorded here. The three that are fully merged (`fix/large-file-inline-comments`,
`fix/merge-audit-base-branch-guard`, `feature/ai-review-skill`) are stale GitHub refs whose owners
should be told they can be deleted — the work already shipped through `main`'s ordinary history, not
because anyone acted on `a0.md`'s "land or close" instruction. `node22-update` and `webpack` are real,
unmerged, and genuinely conflict with `zibby`'s newer `default.workflow.yml` (post PR #13's
`node_version` input, Node 24 default) — they are **open questions for the owner**, not resolved by
this unit. Their only surviving value, per `a0.md`, is the `actions/*` version bumps
(`checkout@v3→v6`, `setup-node@…→v6`, `upload-artifact@v3→v5`) and the artifact-naming/production-mode
changes — cherry-picking those (rather than merging either branch whole) is the owner's call.

## What the ordering slip actually cost

Measured, not assumed: **`main`'s frozen `RELIABLE_RULES` set and `zibby`'s (post-A1/A2) are
byte-identical** — 62 rule ids, same set, confirmed by diffing a sorted dump of both
(`git show origin/main:linter_review_tool/profiles.js`'s literal `Set` vs. `require('./profiles.js')`
on `zibby` after the A2 extraction). The only observable behavioural delta between the two is the one
`A1` predicted and intentionally introduced: `bad/bad-core-mutations.js` in
`test-cases/expected.json` gained one extra finding, `no-implicit-globals@blocker`, alongside the
pre-existing `shoptet/no-core-overwrite@blocker` — because ESLint 9's `no-implicit-globals` now also
fires on `shoptet = {}` in module mode (`no-global-assign` already covered the assignment; this is a
second, deliberate, comment on the same line, not a new rule id and not a severity change).

So in this specific case the ordering slip did **not** silently drift the rule set — A1 and A2 were
executed carefully enough that the frozen set survived the port. That is a fact about how this port
was done, not a property that a skipped A0 guarantees in general: nothing enforced "no rule-config
edit lands between the snapshot and the port" as a **process**, and the near-miss is real —
`fix/large-file-inline-comments` did land a `max-lines`-as-blocker change on `main` in between,
and it was only caught because a *later*, unrelated commit (`59412fa`) happened to revert it before
A1 measured anything. Had A1's scratch-copy measurement been taken between `22d95e9` and `59412fa`,
the "frozen baseline" A2 published would have shipped `max-lines` as a blocker to every partner, with
no ADR and no PR discussion recording that as a deliberate decision — exactly the failure mode `a0.md`
was written to prevent. The absence of visible cost here is not evidence the missing gate was
unnecessary.

## Test results

- `linter_review_tool`: `yarn test` → 63/63 green (measured above).
- `bash tests/test-workflow-scripts.sh` → 105/105 green, after fixing the README Node-version
  inconsistency (see below).
- `bash tests/test-checks-workflow-scripts.sh` → 22/22 green.

## README Node-version inconsistency — fixed

`a0.md` named this: one paragraph said the `node_version` default was `'22'` while
`default.workflow.yml` sets `'24'` (since PR #13). Verified still present at the time of this unit
(`README.md`, the `package_manager`/`node_version` example block and its following paragraph) and
fixed in this unit's commit: the inline comment `# optional — Node.js for the build (default '22')`
and the prose "defaulting to `'22'`" both now read `'24'`, matching `default.workflow.yml`'s
`node_version` input default and the "## Node version" section a few lines below, which already said
`24`. `tests/test-workflow-scripts.sh`'s README-mirror check only asserts the *other* sentence
("Builds run on **Node 24** by default"), which was already correct — it did not catch this second,
now-fixed inconsistency, so this was a real doc bug, not a false alarm.

## Open for the owner

- **`node22-update` / `webpack`**: real, unmerged, conflicting with `zibby`'s `default.workflow.yml`.
  Decide whether to land the `actions/*` bumps (checkout v6, setup-node v6, upload-artifact v5) as a
  fresh PR against `zibby`/`main`, or close both branches outright. Neither branch touches rule
  config, so this has no bearing on the rule-unification track itself.
- **Stale branch refs**: `fix/large-file-inline-comments`, `fix/merge-audit-base-branch-guard`, and
  `feature/ai-review-skill` are fully contained in `main` (and thus `zibby`) already — their owners
  can be told these are safe to delete on GitHub. This unit did not delete or close them.
