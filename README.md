# addon-repository-actions-config

Reusable GitHub Actions workflows for Shoptet addon (partner) repositories.

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
    uses: shoptet/addon-repository-actions-config/.github/workflows/checks.workflow.yml@feature/linter-review-tool
    permissions:
      contents: read
      pull-requests: write
```

Besides the review job, the workflow also verifies that protected workflow files
are not modified, that the PR author is an authorized Shoptet reviewer, and that
the required Shoptet reviewer is assigned.

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
      node_version: '20'    # optional — Node.js for the build (default '22')
```

The build workflow also accepts a `node_version` input (passed to
`actions/setup-node`), defaulting to `'22'` — set it when an addon needs a
different Node major.

The resolved package manager is used for the `setup-node` dependency cache, the install step (`npm ci` / `yarn` / `pnpm install --frozen-lockfile`) and the `build --env production` step. Existing Yarn-based addon repositories keep working without any change.

## Local usage

```bash
cd linter_review_tool
yarn
node review.js path/to/addon/src   # same reliable rule set as CI
```
