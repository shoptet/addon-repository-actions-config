# A2 — extract and publish the three packages

> **Slice 3 of 8 in the rule-unification track.** [`README.md`](./README.md) indexes this
> repository's half; the track index lives in the CLI repo at `doc/plans/rule-unification.md`.
> Previous: [`A1`](./rule-unification-a1.md). Next: `B1`, in the CLI repo — it consumes what this
> slice publishes.
>
> **Blocked on an access conversation, not on code.** See "The blocker" below.
>
> **Status: not started.**

## Why this is its own slice

This is the slice that turns rule knowledge from *a directory in one repository* into *a versioned
artifact two runners consume*. After it, adding a rule is one edit in one place, and both the deploy
gate and `shoptet validate` get it on a deliberate bump.

It is also the slice where this repository takes on a role it has never had: **npm publisher**. It is
Yarn classic, plain CommonJS, no build step, no changesets, no release workflow. That is new
machinery, which is why it is not combined with the ESLint port.

## Scope

### Three packages

Authored as **plain CommonJS with no build step** — exactly as the rules are written today. Rewriting
them in TypeScript during a move would make "preserve the existing functionality" unverifiable, which
is the constraint the whole track rests on. Types can come later if they earn it.

| package | contents | peer range |
| --- | --- | --- |
| `@shoptet/addon-eslint-config` | the flat config, the 8 `shoptet/*` rules, `rules/global-callee.js`, `rules/script-detect.js`, and **`RELIABLE_RULES` as a named export** | `>=9.5.0 <11` |
| `@shoptet/addon-stylelint-config` | the config, the 4 plugin rules, and its slice of the allowlist | `>=15 <18` |
| `@shoptet/addon-html-lint` | the 3 parse5 checks (`a11y/img-alt`, `html/no-inline-script`, `html/deprecated-tag`) | — |

The `addon-` prefix is deliberate: the `@shoptet` scope already hosts the SOFA/g4 line
(`@shoptet/sofa-*`, `@shoptet/app-generator`, `@shoptet/theme-*`, `@shoptet/ui`), so an unprefixed
`@shoptet/eslint-config` would read as the house style for any Shoptet code rather than the g3
partner-addon deploy gate.

They live in **`packages/<name>/`** at the repository root — `packages/addon-eslint-config/`,
`packages/addon-stylelint-config/`, `packages/addon-html-lint/` — as a Yarn classic workspace, with
`linter_review_tool/` keeping its own `package.json` and lockfile as the consumer. That keeps the
publish workflow's `working-directory` per package and keeps the extraction diff readable as a move.
The alternative — three sibling directories with independent lockfiles — is more release plumbing for
no gain at three packages.

Each package needs what `linter_review_tool/package.json` currently lacks entirely: `main` or
`exports`, `files`, `repository`, a real `version`, and a license. Today it is
`shoptet-addon-review-system@2.0.0` with no `main`, no `exports`, no `files`, no `bin` and no
`publishConfig` — runnable from a clone, publishable nowhere.

### `RELIABLE_RULES` is an export, not a copy

The allowlist is **verdict-affecting**: a rule configured `error` but absent from it is dropped from
the output entirely. So it is not presentation, and a consumer that reimplements it will disagree
about verdicts while both sides' tests pass.

Exporting it also makes [`A3`](./rule-unification-a3.md)'s equality test meaningful — a test that
compares a local copy against itself always passes.

Its stylelint and HTML entries travel with their own packages, so no consumer needs all three to
filter one linter's output correctly.

**But `profiles.js` does change, and the change is verdict-affecting — it is in scope, not an implied
no-op.** Today `RELIABLE_RULES` is one flat `Set` spanning all three linters and `isReliable(ruleId)`
is linter-agnostic: it matches ESLint, stylelint and HTML rule ids against the same set. `review.js`
runs all three linters, so after the split it needs the union. Merge the three packages' exports into
one set at load time and keep `isReliable()`'s signature — the union must be assembled from the
packages, never restated locally, or [`A3`](./rule-unification-a3.md)'s equality test compares a copy
against itself. The selftest's existing `RELIABLE_RULES` completeness assertion must run against the
merged set, so that every gating rule from every package is still pinned by a fixture.

### The runner keeps its job

`review.js`, `profiles.js`'s wiring, `lib/reconcile-utils.js`, the RDJSON emission, the reconciled
inline PR comments, the fingerprint marker, the diff-scoped gate, `FILE_LEVEL_RULES`, the fail-closed
plumbing and the non-PR fail-safe path all **stay here**. This slice extracts *what to check*, not
*how to run and report it*.

File discovery — the `IGNORE` globs and the skipped-list reporting — also stays. That is a deliberate
gap, guarded by [`A3`](./rule-unification-a3.md)'s conformance corpus rather than closed by a package.

### This repo consumes the published versions

Not the local directory. `linter_review_tool` depends on the three packages, **exact-pinned** in
`yarn.lock`, at the same versions the CLI pins.

The cost is real: a rule change becomes publish-then-bump, and there is a window where this repo's
own gate runs the previous release. That is the correct friction for something that fails partner
builds. Consuming the working copy instead would mean the gate runs rules no release contains, which
re-creates the divergence the track exists to remove — just with a shorter half-life.

### Release machinery

- A publish workflow. The `@shoptet` scope already has a working **npm trusted publishing / OIDC**
  path — `@shoptet/ui`'s most recent release went out through it — so copy that shape rather than
  inventing one, and prefer it to a long-lived `NPM_TOKEN`.
- Versioning is strict SemVer, and **a new blocking rule is a major bump**: it fails builds that used
  to pass. A new warning-level rule is a minor. This is the rule that makes the packages safe to
  depend on, and it is the rule most likely to be quietly broken by someone in a hurry.
- v1's rule set is [`A0`](./rule-unification-a0.md)'s frozen baseline, including whatever
  `fix/large-file-inline-comments` decided about `max-lines`. For that to be unambiguous, **A0's
  snapshot must be taken with [`A1`](./rule-unification-a1.md)'s two intentional deltas already
  decided** — `caughtErrors: 'none'` and the `no-implicit-globals`-on-`shoptet = {}` question — so
  the baseline already contains them. A0's own definition of done requires the baseline be produced
  by *running* the selftest, and A1 changes what the selftest produces; a baseline snapshotted before
  those decisions would describe a rule set no release ever ships. There is no "baseline ± later
  deltas" version of v1: one number, one rule set.

### Partners get a version gate for the first time

Today partner repositories call this workflow at **`@main`**, so a rule change reaches every partner
instantly, with no version gate at all. Publishing does not by itself change that — the workflow ref
is separate from the package pin — but it is worth stating plainly in the PR: after this slice, the
*rules* the gate runs are pinned, while the *workflow* is still floating. Whether the workflow gets
tagged refs is a decision for later, and out of this track's scope.

## The blocker

**npm publish rights in the `@shoptet` scope** are held by the SOFA/g4 maintainers (`janvoracek`,
`shoptet-ci`). Nothing in this slice can complete without that access. It is an organizational
conversation, and it should start before [`A1`](./rule-unification-a1.md) finishes so it is not the
thing everything waits on.

All three names are currently unpublished and free, as are the unscoped variants.

## Definition of done

- Three packages published at `1.0.0`, each with `exports`, `files`, `repository`, a license, and a
  correct peer range.
- `linter_review_tool` consumes them from the registry, exact-pinned, and `node test/selftest.js` is
  green against the published copies — proving the extraction changed no behaviour.
- The gate still gates on a real PR.
- `RELIABLE_RULES` is a named export and the runner reads it from the package, not from a local file.
- The publish workflow runs from CI with OIDC; no long-lived token in the repository.

## Review checklist

- **Perturbation:** publish a prerelease with one rule's severity changed and confirm both this
  repo's gate and the CLI's `validate` follow it. If either does not, that side is still reading a
  local copy.
- **Perturbation:** delete a rule from the published `RELIABLE_RULES` and confirm findings for it
  disappear from the gate's output.
- Confirm the pins are exact by reading `yarn.lock`, not `package.json`.
- Confirm no rule file was rewritten, reformatted, or "cleaned up" during the move — the diff should
  be a move plus packaging metadata. Anything else makes the selftest's green ambiguous.
- Confirm `review.js`, the RDJSON path and the reconciliation logic did not move into a package. The
  extraction is rules-only by design.
- Confirm `profiles.js` assembles `RELIABLE_RULES` from the three packages' exports and hardcodes no
  rule id of its own. A leftover local entry is invisible until the equality test, which is exactly
  the case it is built to catch.
- Check the SemVer story is written down somewhere a future contributor will read before adding a
  blocking rule.
