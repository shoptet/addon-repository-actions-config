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

Whichever way the package manager is resolved, **its lockfile must be committed** — production builds are always installed from the lockfile (`npm ci` / `pnpm install --frozen-lockfile`) and the build fails with a clear error when the lockfile is missing. If more than one lockfile is committed, the first match in the order above wins and a warning is emitted (the build still passes) — remove the extra lockfile or set the `package_manager` input explicitly.

A version pinned in the `packageManager` field is honored: pnpm and npm are installed at the pinned version, and Yarn Berry (2+) is activated through corepack. Without a pin, pnpm's major version is chosen to match the `lockfileVersion` of the committed `pnpm-lock.yaml`, and Yarn defaults to classic (1.x).

To override auto-detection, pass the optional `package_manager` input when calling the workflow:

```yaml
jobs:
  deploy:
    uses: shoptet/addon-repository-actions-config/.github/workflows/default.workflow.yml@main
    with:
      package_manager: pnpm # npm | yarn | pnpm
```

The resolved package manager is used for the `setup-node` dependency cache, the install step (`npm ci` / `yarn` / `pnpm install --frozen-lockfile`) and the `build --env production` step. Existing Yarn-based addon repositories keep working without any change.
