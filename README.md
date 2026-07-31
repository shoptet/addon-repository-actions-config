# addon-repository-actions-config

Reusable GitHub Actions workflows for Shoptet addon (partner) repositories.

## Workflows

### `checks.workflow.yml` — automated pull request review

Runs the linter review tool (`linter_review_tool/`) over the addon source in `src/`
and reports findings directly on the pull request.

**Linters:** ESLint (core rules + custom `shoptet/*` rules mapped to the review
handbook `PRIRUCKA.md`), stylelint (CSS/SCSS/LESS), HTML checks, and a cross-file
duplicate detector. See `linter_review_tool/COVERAGE.md` and
`linter_review_tool/rules-catalog.md` for the full rule set.

**Profiles** (`linter_review_tool/profiles.js`):
- `strict` — only rules with ~zero false positives (used by `review_mode: blockers`)
- `full` — every rule including heuristics (used by `review_mode: pending`)

**Behavior in `review_mode: blockers`** (default):
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

**Behavior in `review_mode: pending`:** all findings (full profile) are posted
as a PENDING draft review authored via the `reviewer_pat` secret, for a human
reviewer to curate and submit.

**Caller template** (`.github/workflows/shoptetAddon.workflow.yml` in the
partner repository):

```yaml
name: Shoptet Addon PR
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  checks:
    uses: shoptet/addon-repository-actions-config/.github/workflows/checks.workflow.yml@linter-review-tool
    with:
      review_mode: blockers
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

## Local usage

```bash
cd linter_review_tool
yarn
node review.js path/to/addon/src            # full profile
node review.js path/to/addon/src --strict   # strict profile (CI gate)
```
