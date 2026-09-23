# addon-repository-actions-config

Reusable GitHub Actions workflows for Shoptet addon (partner) repositories.

See [`doc/overview.md`](doc/overview.md) for a quick-orientation map of the repository's
structure and how its packages/workflows reference each other (including a dependency graph).

## Workflows

### `checks.workflow.yml` — automated pull request review

Runs the linter review tool (`linter_review_tool/`) over the addon source in `src/`
and reports findings directly on the pull request.

**Linters:** ESLint (core rules + custom `shoptet/*` rules), stylelint
(CSS/SCSS/LESS) and factual HTML checks. The exact set the linter **reports** is
`RELIABLE_RULES` in `linter_review_tool/profiles.js`; of those, only the
error-severity (❌) subset gates the PR — ⚠️ rules are recommendations (see
Behavior below).

The linter runs the **reliable rule set only** (`linter_review_tool/profiles.js`):
rules with ~zero false positives. It is a deterministic gate — heuristic /
contextual checks are handled separately by the AI review skill, not here.

**Behavior:**
- ❌ blockers and ⚠️ reliable recommendations are posted as inline PR review
  comments; only blockers gate the PR (`REQUEST_CHANGES` + failing check)
- comments are reconciled across pushes: fixed findings have their comments
  removed, unfixed ones are never duplicated; once all blockers are resolved
  the `REQUEST_CHANGES` review is dismissed automatically
- at most 100 inline comments per run (blockers first, posted in chunks to
  respect API limits); the complete finding list is always available as a table
  in the job Summary
- works for large files too (changed lines are reconstructed via `git diff`
  when the GitHub API omits the file patch)

**Caller template** (`.github/workflows/shoptetAddon.workflow.yml` in the
partner repository):

```yaml
name: Shoptet Addon PR
on:
  pull_request:
    types: [opened, synchronize, reopened, closed]

jobs:
  checks:
    uses: shoptet/addon-repository-actions-config/.github/workflows/checks.workflow.yml@main
    permissions:
      contents: read
      pull-requests: write
```

Besides the review job, the workflow also verifies that protected paths
(`.github/workflows/`) are not modified, that the required Shoptet reviewer is
assigned (submitted reviews count), and — post-merge — audits WHO merged
(`merge-audit`; see below).

**Known limitations:**
- *Line shifts re-create comment threads.* Comments are matched across pushes by
  a fingerprint of `file | line | rule | message`. When a push inserts or removes
  lines **above** a finding, the finding's line number — and therefore its
  fingerprint — changes: the old comment is deleted and a fresh one is posted at
  the new line. The finding itself is preserved, but **any human replies under
  the old comment are lost with it**. Discussions worth keeping belong in the PR
  conversation, not under bot comments. (The line number has to be part of the
  fingerprint — without it, two identical findings in one file could not be told
  apart.)
- *The `REQUEST_CHANGES` verdict body is written once.* Follow-up pushes update
  the inline comments and the Summary, but the standing verdict text (finding
  counts) reflects the run that created it; it is dismissed and re-created only
  after all blockers are resolved and new ones appear.
- *Files whose changed lines cannot be resolved gate on all findings.* When both
  the GitHub API patch and the local `git diff` fallback fail for a file, its
  **every** finding counts toward the gate (fail-closed) — including pre-existing
  ones on lines the PR did not touch — but no inline comments are attempted for
  it (off-diff anchors would be rejected); such findings appear only in the run
  Summary.
- *Non-PR callers gate on the whole `src/`, not changed lines.* When the
  workflow is triggered by something other than a pull_request event (push,
  schedule, dispatch), the fail-safe gate runs the linter over all of `src/` —
  stricter than the PR gate, which only counts findings on changed lines.
- *Some LESS syntax errors pass.* Broken CSS/SCSS gates via `CssSyntaxError`,
  but `postcss-less` tolerates certain malformed LESS input without reporting
  a parse failure.
- *Exotic core-mutation forms are not gated.* `shoptet/no-core-overwrite`
  covers assignments, `delete`, updates, for-of/in targets, destructuring
  targets and `Object.assign`/`defineProperty` — but not `Reflect.set(...)`,
  `Object.setPrototypeOf(...)`, `Object.defineProperty(window, 'shoptet', …)`
  or multi-hop global chains (`window.window.shoptet…`). Accepted false
  negatives for a reliable-rules gate; the AI review covers the intent.
- *Files with more than ~20,000 changed lines cannot receive inline comments
  at all.* GitHub's review API rejects comment anchors in such files ("diff
  entry is too large"), and a single such anchor voids the whole comment chunk.
  The workflow treats these files as unanchored up front: their findings still
  gate and appear in the Summary, but no inline comments are attempted.
- *A non-retryable posting failure on the first chunk suppresses that run's
  remaining inline comments.* The verdict, the failing check and the complete
  Summary table are unaffected; the next push posts the missing comments.
- *Two blockers encode a documented assumption rather than a pure fact.*
  `shoptet/no-testid-selector` treats any string literal containing the
  attribute-selector form `[data-testid` as selector binding — a prose string
  that merely quotes it (e.g. an error message) also gates. `a11y/img-alt`
  requires an `alt` attribute on every `<img>`, including decorative ones
  marked `role="presentation"`/`aria-hidden="true"` (use `alt=""` there — a
  cheap, always-valid fix). Both detections are deterministic; the false-positive
  surface is tiny and accepted deliberately.
- *Minified/vendored naming conventions are a deliberate blind spot.* Files
  matching `*.min.*` / `*.bundle.*` or under `node_modules/`, `dist/`, `vendor/`
  are never linted — a partner can place code there and the gate will not see
  it. Skipped files are listed in the run Summary so a human reviewer can see
  when coverage of a change was partial. When **every** candidate file is
  skipped, the run fails closed with a message saying so (not a green pass).
- *Only `.js/.mjs/.cjs`, stylesheet and HTML extensions are linted.* Other
  source-looking files (`.ts`, `.jsx`, `.vue`, …) are never linted — they
  surface in the `skipped` list so the coverage gap is visible (TypeScript/JSX
  support is a separate ticket, gated on partner demand).
- *Templating placeholders in attribute position weaken the HTML checks.* A
  Mustache/Handlebars-style placeholder standing where an attribute would be
  (`<img src="x.png" {{alt_attr}}>`) breaks attribute tokenization; `img-alt`
  deliberately stays silent on such elements rather than claim `alt` is
  missing (false negatives over false positives). Placeholders inside
  attribute VALUES (`alt="{{alt}}"`) parse fine and are fully checked.
- *Inline `<script>` content is never linted — it gates instead.* The HTML
  pass checks markup, not script text: inline JS would silently bypass the
  ENTIRE JS rule set (every `shoptet/*` blocker included), so a non-empty
  inline script is itself a blocker (`html/no-inline-script`) — move the code
  to a `.js` file in `src/`, where the full rule set applies. External
  scripts (`src=`) and data blocks (`application/ld+json`, `text/template`)
  are not executable inline JS and never flag. (Linting extracted inline JS
  in place is a possible follow-up — only worth it if the policy ever changes
  to allow inline scripts.)
- *`<noscript>` content is invisible to the HTML checks.* parse5 parses with
  scripting enabled, so `<noscript>` children are raw text — an `<img>` without
  `alt` inside it escapes `a11y/img-alt`. Accepted miss for an advisory-scale
  gate; the AI/human pass covers no-JS fallbacks.
- *Hidden (dot-prefixed) files and directories are never linted.* They are
  tooling trees, not addon source — but since round 11 they surface in the
  `skipped` list instead of vanishing silently, like every other coverage gap.
- *Inline disable comments are honored.* `/* eslint-disable */` and
  `/* stylelint-disable */` comments (file-wide, block or per-line) remove the
  affected code from coverage with no trace in the findings or the Summary —
  including unintentionally, e.g. inside snippets copied from vendor code.
  Deliberate for now (fighting disables is a policy question, not a linting
  one), but reviewers should treat a `-disable` comment appearing in a diff as
  a signal worth reading. `reportUnusedDisableDirectives` is deliberately not
  enabled: its reports carry no rule id and would map to a gating blocker.

### `default.workflow.yml` / `deploy.workflow.yml` — build & artifact

The deploy pipeline called from partner repositories:
- checkout the latest code
- install dependencies and build (CSS/JavaScript minification)
- upload the production artifact

Addon Repository will upload this artifact to FTP, remove the artifact from
GitHub and update custom codes.

### `publish-packages.yml` — shared rule package releases

Publishes the four shared packages under `packages/` (see "Shared rule
packages" below) to npm. Triggers only on `workflow_dispatch` (with a
`package` input selecting one package or `all`) or a version tag — never on
an ordinary push or PR, so a package cannot ship as a side effect of merging
code. Uses npm **trusted publishing (OIDC)**: the workflow
requests `id-token: write` and exchanges a short-lived OIDC token for a
registry token at publish time, so there is no `NPM_TOKEN` (or any other
long-lived publish secret) stored in this repository.

**Currently blocked, not broken:** publish rights in the `@shoptet` scope are
held by the SOFA/g4 maintainers, and no trusted-publisher registration exists
yet for these four package names. The workflow is correct and ready, but
every run's `npm publish` step will fail (or simply never run, since nothing
tags a release yet) until that registry-side access lands.

### `shoptet-addon-review/` — AI code-review skill

The heuristic/contextual counterpart of the deterministic linter gate above:
an AI code-review skill (`st-addon-review`, a Claude Code plugin) that reviews
addon PRs against the FE rules catalog. Install/run instructions →
`shoptet-addon-review/INSTALL.md`; status and decisions →
`shoptet-addon-review/CONTEXT.md`. (The legacy `review_tool/` prototype it
superseded was removed together with the introduction of
`linter_review_tool/`.)

## Shared rule packages

The rules `checks.workflow.yml`'s linter runs (and the ones the separate
`shoptet` CLI validates against) are published as three plain-CommonJS,
no-build-step npm packages, versioned independently of this repository and
of the workflow that calls it:

| package | contents |
| --- | --- |
| `@shoptet/addon-eslint-config` | the flat config, the `shoptet/*` ESLint rules, and `RELIABLE_RULES` as a named export |
| `@shoptet/addon-stylelint-config` | the stylelint config, the `shoptet/*` stylelint rules, and its slice of `RELIABLE_RULES` |
| `@shoptet/addon-html-lint` | the factual HTML checks (`a11y/img-alt`, `html/no-inline-script`, `html/deprecated-tag`) |

A fourth package, `@shoptet/addon-lint-conformance`, holds no rules — it is the shared **discovery
conformance corpus** (directory shapes + expected file-discovery outcomes: skipped/minified/vendored
files, symlinked directories, a target outside the runner's own tree, fail-closed on "everything
skipped") that both this repo's `linter_review_tool/test/conformance.js` and the `shoptet` CLI's own
conformance run test their file-walking against, from one shared source. See
`packages/addon-lint-conformance/README.md` for the manifest schema and
`doc/plans/rule-unification/a3.md` for why file discovery needed its own mechanism separate from the
rule-set equality test.

They live under `packages/<name>/` as a Yarn classic workspace;
`linter_review_tool/` stays outside that workspace and consumes them the same
way any external partner tooling would.

**Not yet consumed from the registry.** The target state is a registry
dependency exact-pinned in `linter_review_tool/yarn.lock`. Until publish
rights land (see the blocker above), `linter_review_tool` depends on the
packages via Yarn `link:../packages/<name>` instead. That is why CI installs
at the repository root before installing the tool: `link:` symlinks the
package but does not install *its* dependencies, which resolve out of the
workspace root instead. Both the root install steps and this paragraph go away
when the pins become real versions.

**SemVer policy — read this before adding a rule:**
- **A new blocking (error-severity) rule is a MAJOR version bump.** It fails
  partner builds that previously passed a gate they were already relying on
  — that is a breaking change to the contract the package makes, not a
  feature addition.
- A new warning-level (non-blocking) rule, or any change that doesn't alter
  what gates, is a MINOR bump.
- Releases go out from CI via npm trusted publishing (OIDC) — see
  `publish-packages.yml` above. There is no publish token in this
  repository.

**Neither the rules nor the workflow ref are pinned yet.** With
`linter_review_tool` depending on the packages via `link:../packages/<name>`
(see "Not yet consumed from the registry" above) there is no version pin at
all — a rule edit merged to `main` reaches every caller's next PR run
immediately, because `checks.workflow.yml` also checks the review tool out at
a hardcoded `ref: main`. Once the packages are consumed as real registry
versions, a partner's rules will be locked to whatever version
`linter_review_tool` depends on at the time it was released — but partner
repositories will still call `checks.workflow.yml` at `@main` (see the caller
template above), so a change to *this repository's workflow code* will keep
reaching every partner immediately, with no version gate at all. Those are
two separate axes — package version and workflow ref — and tagging the
workflow itself is a distinct decision for later, out of scope here.

### Rehearsing a release locally (Verdaccio)

Because the real publish path is blocked registry-side, the whole
publish-then-consume chain can be rehearsed against a local Verdaccio
registry instead. This is a developer-machine harness only — it never touches
`publish-packages.yml`, and nothing it produces leaves your machine.

```bash
yarn verdaccio:local        # terminal 1: starts Verdaccio on http://localhost:4873/
yarn release:local          # terminal 2: publishes all four packages, patch bump
yarn release:local --package=addon-eslint-config --bump=minor
```

Verdaccio itself runs through `npx verdaccio@6.9.2` (the same version
`shoptet-partner-cli` pins) rather than being added as a dependency — it would
otherwise pull a large tree into a root that carries only prettier. Its
storage lives in the gitignored `local-releases/`; delete that directory to
reset the registry to empty.

Three properties of `scripts/release-local.js` worth knowing:

- **The committed `packages/*/package.json` files are never written to.** Each
  package is published from a temporary copy with the version patched in, so
  repeated local releases leave the working tree clean and the manifest
  version keeps meaning "what the real OIDC release would ship".
- **The base version is whatever is already in the local registry**, or the
  manifest version when that package has never been published there; the
  requested bump is always applied on top. A first run against a manifest at
  `1.0.0` with `--bump=patch` therefore publishes `1.0.1`.
- **The rehearsal does not exercise npm's own packing.** The temp tree is
  assembled by copying each `manifest.files` entry verbatim, whereas a real
  `npm publish` expands globs in `files`, always includes `package.json`/
  `README`/`LICENSE`, and honours `.npmignore`. A `files`/`.npmignore` mistake
  that would make `publish-packages.yml` ship a broken tarball would not
  surface in this rehearsal. That gap is covered separately by
  `scripts/verify-pack.js` (below), which `publish-packages.yml` runs before
  every `npm publish`.

**Pre-publish tarball verification (`scripts/verify-pack.js`).** Each publish
job runs `node ../../scripts/verify-pack.js .` immediately before
`npm publish`. The script `npm pack`s the package, installs the resulting
tarball (plus its peer dependencies) into a throwaway directory, and
`require()`s every subpath declared in `exports` from that installed copy,
then asserts the root entry point still exposes its documented export names.
Loading from the installed tarball rather than the working tree is the whole
point: everything else in this repo consumes the packages through Yarn
`link:`, which symlinks the working tree and therefore resolves files whether
or not `files` would actually ship them. The export-name assertion is "at
least these names", so adding an export is not a breaking change; removing or
renaming one fails the publish. Run it by hand the same way:
`node scripts/verify-pack.js packages/addon-html-lint`.

The script refuses any registry host that is not loopback or `.test`,
because `npm publish` would otherwise happily reuse a real credential from
your `.npmrc`.

**Consuming the local packages from `../shoptet-partner-cli`.** That repository
runs `pnpm registry:mode --mode=local` (from its own root, after the two
commands above) to point **both** repos at the registry you just published to
in one step — its own `pnpm-workspace.yaml` catalog entries, its `.npmrc`
`@shoptet:registry=` scope line, this repo's `.npmrc` scope line (unused today
— `linter_review_tool/` still depends on these four packages via `link:`, see
below), and the `minimumReleaseAge: 1440` cooldown's
`minimumReleaseAgeExclude` list, all four rewritten and reverted together.
`pnpm registry:mode --mode=git` restores the committed SHA-pinned state
afterwards. Full usage: that repository's `scripts/release-local/README.md`
("Registry mode") and
[its ADR 0077](https://github.com/shoptet/shoptet-partner-cli/blob/main/doc/decisions/0077-registry-mode-switch.md).

**Not covered by that command**, because it edits development-time
configuration, not test fixtures: `packages/test-fixtures/fixtures/scaffolds/
{addon,theme}/package.json` in that repository — the scaffold-matrix goldens,
regenerated from `packages/create/src/package-json.ts`'s own constants
(`pnpm --filter @shoptet/create run emit-scaffold-fixtures`), which
`registry:mode --status` only ever *reports* on, never rewrites (those
constants ship to partners and must never point at a developer's local
registry). Those two fixtures pin only `@shoptet/addon-eslint-config` and
`@shoptet/addon-stylelint-config` — **not** `@shoptet/addon-html-lint` — so a
scaffold-then-install test path proves nothing about that third package. Only
the workspace catalog (which `registry:mode` does cover) pins all three.

**Not yet consumed from a registry at all — `link:` only.** `linter_review_tool/`
depends on all four packages via Yarn `link:../packages/<name>` (see "Shared
rule packages" above), so nothing in this repo actually reads the
`@shoptet:registry=` line `registry:mode --mode=local` writes here. It is
written anyway, for symmetry with the CLI repo and so nothing needs to change
here the day `linter_review_tool` starts depending on these packages as
ordinary registry dependencies instead.

## Package managers

The build workflow supports **npm, Yarn and pnpm**. The package manager is resolved in this order:

1. `package_manager` workflow input (if provided)
2. `packageManager` field in `package.json` (e.g. `"packageManager": "pnpm@10.4.1"`)
3. Committed lockfile: `pnpm-lock.yaml` → pnpm, `yarn.lock` → Yarn, `package-lock.json` → npm

Whichever way the package manager is resolved, **its lockfile must be committed** — the build fails with a clear error when the lockfile is missing. npm installs with `npm ci` and pnpm with `pnpm install --frozen-lockfile`, so a lockfile out of sync with `package.json` fails the build. Classic Yarn (1.x) is the deliberate exception: it does not enforce a frozen install — when `yarn.lock` drifts from `package.json`, Yarn regenerates it and the build continues with a warning, so existing partner repositories keep building. Keep your `yarn.lock` in sync anyway; a future version of this workflow may enforce it. A pinned Yarn Berry (2+) is different: it runs immutable installs in CI by default, so a drifted Berry lockfile fails the build. A Berry-format `yarn.lock` also requires a Berry-capable Yarn (a `packageManager` pin ≥2 or a vendored `yarnPath` release) — the build fails otherwise, because classic Yarn 1 would silently rebuild the dependency tree.

If more than one lockfile is committed, the first match in the order above wins and a warning is emitted (the build still passes) — remove the extra lockfile or set the `package_manager` input explicitly.

A version pinned in the `packageManager` field is honored: pinned Yarn (classic or Berry) and pinned pnpm are activated through corepack, which also verifies a `+sha…` integrity suffix in the pin; a pinned npm is installed from the npm registry without hash verification (the one remaining exception). Without a pin, pnpm's major version is chosen to match the `lockfileVersion` of the committed `pnpm-lock.yaml`, Yarn defaults to the classic (1.x) preinstalled on the runner, and npm defaults to the version bundled with Node. A Yarn release vendored via `yarnPath` in `.yarnrc.yml` always wins over a pin — the file must be committed.

To override auto-detection, pass the optional `package_manager` input when calling the workflow. The input overrides *which* package manager is used; it does not bypass validation of the `packageManager` field for that manager — if the field pins an invalid version (a range or a tag), fix the field itself:

```yaml
jobs:
  deploy:
    uses: shoptet/addon-repository-actions-config/.github/workflows/default.workflow.yml@main
    with:
      package_manager: pnpm # npm | yarn | pnpm
      node_version: '20'    # optional — Node.js for the build (default '24')
```

The build workflow also accepts a `node_version` input (passed to
`actions/setup-node`), defaulting to `'24'` — set it when an addon needs a
different Node major.

## Node version

Builds run on **Node 24** by default. A repository that
needs a different version can override it per-call via the optional
`node_version` input:

```yaml
jobs:
  deploy:
    uses: shoptet/addon-repository-actions-config/.github/workflows/default.workflow.yml@main
    with:
      node_version: '22'
```

The value is passed straight to `actions/setup-node`; when the input is
omitted the default above applies.

## Pull request checks
The resolved package manager is used for the `setup-node` dependency cache, the install step (`npm ci` / `yarn` / `pnpm install --frozen-lockfile`) and the `build --env production` step. Existing Yarn-based addon repositories keep working without any change.

## Local usage

```bash
yarn --frozen-lockfile   # repo root — installs the packages/* deps the link: deps resolve to
cd linter_review_tool
yarn
node review.js path/to/addon/src   # same reliable rule set as CI
```

Single-file mode (`node review.js path/to/file.js`) applies the
minified/vendored ignore conventions to the **CWD-relative** path — run it
from the addon repo root for the same view CI has. A `dist/` or `vendor/`
segment in the path *as you typed it* counts as vendored; directories above
your current directory don't.

### Merge audit and caller trigger requirements

Besides the PR-time jobs, the workflow runs a post-merge **`merge-audit`** job
that flags a merge **into `main` or `master`** performed by anyone other than
`REQUIRED_REVIEWER` (with a retroactive-review exception for `hotfix/*`
branches touching only `src/`). It is scoped to `main`/`master` rather than
the repo's (partner-editable) default-branch setting, to track the branch
that actually deploys.

`closed` must be in the caller's trigger types — GitHub's default (`[opened,
synchronize, reopened]`) never fires it — or `merge-audit` never runs and
merges go unaudited (a merge into a branch other than `main`/`master` is never
audited regardless of trigger types — see above). `reopened` is not required for safety: the
review/files/collaborators jobs re-run on a closed-but-unmerged event too, so
a partner cannot close a PR blocked by a red check and reopen it past a stale
green one; keep `reopened` only if you also want checks to re-run after a
partner reopens a closed PR without a new push.

The `permissions` block matters: a restrictive org/repo default token
(`contents: read` only) grants less than the workflow requests, and the
merge-audit comment step degrades silently to a warning instead of failing
the run — on a qualifying hotfix that means a green check with no
retroactive-review ping at all. Declare only one of `pull_request` /
`pull_request_target` with `closed` — declaring both fires `merge-audit`
twice per merge; the job's own concurrency group queues (not cancels) a
duplicate run so it detects the first run's comment instead of
double-posting, but there is no reason to wire it that way.

Enforcement of "only Shoptet reviewers may merge" is not this workflow's job —
a workflow in a partner-owned repo can only detect and flag, since the partner
is admin of their own repo. The actual enforcement (deploy gate, branch
protection management) lives in `addon-repository-github-app`, which should
mirror this trigger requirement in whatever caller template it distributes.
