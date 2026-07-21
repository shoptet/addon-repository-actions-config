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

If more than one lockfile is committed, the first match in the order above wins and a warning is emitted — commit only one lockfile or set the `package_manager` input explicitly. If no lockfile is found and no input is given, the build fails with an error.

To override auto-detection, pass the optional `package_manager` input when calling the workflow:

```yaml
jobs:
  deploy:
    uses: shoptet/addon-repository-actions-config/.github/workflows/default.workflow.yml@main
    with:
      package_manager: pnpm # npm | yarn | pnpm
```

The resolved package manager is used for the `setup-node` dependency cache, the install step (`npm ci` / `yarn` / `pnpm install --frozen-lockfile`) and the `build --env production` step. Existing Yarn-based addon repositories keep working without any change.
