Reusable workflow for Addon Repository called from each Partners' repository. The pipeline is currently:
- checkout the latest code
- minification of CSS, JavaScript
- creating an artifact

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

## Pull request checks

`checks.workflow.yml` runs code review, protected-path and required-reviewer checks on every PR, plus a post-merge `merge-audit` job that flags a merge into `main` or `master` performed by anyone other than `REQUIRED_REVIEWER` (with a retroactive-review exception for `hotfix/*` branches touching only `src/`). Scoped to `main`/`master` rather than the repo's (partner-editable) default branch setting, to track the branch that actually deploys. Call it with:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, closed]
jobs:
  checks:
    permissions:
      contents: read
      checks: write
      pull-requests: write
    uses: shoptet/addon-repository-actions-config/.github/workflows/checks.workflow.yml@main
```

`closed` must be in the caller's trigger types — GitHub's default (`[opened, synchronize, reopened]`) never fires it — or `merge-audit` never runs and merges go unaudited (a merge into a branch other than `main`/`master` is never audited regardless of trigger types — see above). `reopened` is not required for safety: the review/files/collaborators jobs re-run on a closed-but-unmerged event too, so a partner cannot close a PR blocked by a red check and reopen it past a stale green one; keep `reopened` only if you also want checks to re-run after a partner reopens a closed PR without a new push.

The `permissions` block matters: a restrictive org/repo default token (`contents: read` only) grants less than the workflow requests, and the merge-audit comment step degrades silently to a warning instead of failing the run — on a qualifying hotfix that means a green check with no retroactive-review ping at all. Declare only one of `pull_request` / `pull_request_target` with `closed` — declaring both fires `merge-audit` twice per merge; the job's own concurrency group queues (not cancels) a duplicate run so it detects the first run's comment instead of double-posting, but there is no reason to wire it that way.

Enforcement of "only Shoptet reviewers may merge" is not this workflow's job — a workflow in a partner-owned repo can only detect and flag, since the partner is admin of their own repo. The actual enforcement (deploy gate, branch protection management) lives in `addon-repository-github-app`, which should mirror this trigger requirement in whatever caller template it distributes.
