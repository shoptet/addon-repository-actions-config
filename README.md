# addon-repository-actions-config

Reusable GitHub Actions workflows for Shoptet addon (partner) repositories.

## Workflows

### `checks.workflow.yml` — automated pull request review

Runs the linter review tool (`linter_review_tool/`) over the addon source in `src/`
and reports findings directly on the pull request.

**Linters:** ESLint (core rules + custom `shoptet/*` rules), stylelint
(CSS/SCSS/LESS) and factual HTML checks. The exact set that gates the PR is
`RELIABLE_RULES` in `linter_review_tool/profiles.js`.

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
    types: [opened, synchronize, reopened]

jobs:
  checks:
    uses: shoptet/addon-repository-actions-config/.github/workflows/checks.workflow.yml@feature/linter-review-tool
    permissions:
      contents: read
      checks: write
      pull-requests: write
```

Besides the review job, the workflow also verifies that protected workflow files
are not modified, that the PR author is an authorized Shoptet reviewer, and that
the required Shoptet reviewer is assigned.

### `default.workflow.yml` / `deploy.workflow.yml` — build & artifact

The deploy pipeline called from partner repositories:
- checkout the latest code
- install dependencies and build (CSS/JavaScript minification)
- upload the production artifact

Addon Repository will upload this artifact to FTP, remove the artifact from
GitHub and update custom codes.

Addon Repository will upload this artifact to FTP, remove the artifact from GitHub and update custom codes.

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
```

The resolved package manager is used for the `setup-node` dependency cache, the install step (`npm ci` / `yarn` / `pnpm install --frozen-lockfile`) and the `build --env production` step. Existing Yarn-based addon repositories keep working without any change.

## Local usage

```bash
cd linter_review_tool
yarn
node review.js path/to/addon/src   # same reliable rule set as CI
```
