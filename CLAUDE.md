# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

Reusable GitHub Actions workflows for Shoptet addon (partner) repositories, plus the tools those
workflows run:

- `.github/workflows/checks.workflow.yml` — PR-time gate: runs `linter_review_tool/` over
  the addon's `src/`, posts inline review comments, gates on ❌ blockers, and runs a post-merge
  `merge-audit` job.
- `.github/workflows/default.workflow.yml` / `deploy.workflow.yml` — build & artifact pipeline
  (install, build, upload) called from partner repos.
- `linter_review_tool/` — the deterministic linter (ESLint + custom `shoptet/*` rules,
  stylelint, factual HTML checks) behind the PR gate.
- `shoptet-addon-review/` — the heuristic/contextual counterpart: an AI code-review Claude Code
  plugin (`shoptet-addon-review`, skill `st-addon-review`) that reviews addon PRs against the FE
  rules catalog. See
  `shoptet-addon-review/CONTEXT.md` for what it does and why, `INSTALL.md` for setup.
- `doc/plans/` — forward-looking initiative plans (never edited to describe what already
  shipped; see `doc/plans/README.md`).

The README.md at the repo root is the primary reference for workflow behavior, known limitations,
and package-manager/Node-version resolution rules — read it before changing workflow behavior,
since many of its "Known limitations" bullets encode deliberate tradeoffs, not bugs.

## Commands

Linter tool (`linter_review_tool/`):

```bash
yarn --frozen-lockfile                      # repo root — installs the packages/* deps the link: deps resolve to
cd linter_review_tool
yarn                                        # install deps
yarn test                                   # runs all three below, in order
yarn test:selftest                          # snapshot-check test-cases/ fixtures against expected.json
yarn test:rule-equality                     # this repo's effective rule set == the shared packages' declared set (A3)
yarn test:conformance                       # shared discovery corpus (@shoptet/addon-lint-conformance) against review.js (A3)
node review.js path/to/addon/src --rdjson   # exactly what CI runs (Diagnostic JSON, always exits 0)
node review.js path/to/addon/src            # plain mode: human-readable, exits 1 on blockers
node review.js path/to/file.js              # single-file mode
```

The PR gate runs `--rdjson` and derives the gate from the parsed findings; plain mode is only the
fail-safe for non-`pull_request` events, where the exit code itself is the gate. Reproduce CI with
`--rdjson`, and don't rely on the exit code in that mode.

Repository-level tests (run from repo root, no install needed beyond bash/ruby/node/git):

```bash
bash tests/test-workflow-scripts.sh          # tests shell scripts embedded in default.workflow.yml
bash tests/test-checks-workflow-scripts.sh   # tests github-script blocks embedded in checks.workflow.yml
```

Both scripts extract the embedded scripts directly out of the workflow YAML (via a Ruby YAML
parse) rather than duplicating them, so the tests always exercise exactly what the workflow runs.
If you rename a step or job referenced by `grab.call(...)` in either test script, update the
corresponding name there too — it aborts loudly otherwise.

CI (`.github/workflows/ci.yml`) runs `actionlint`, then both `tests/test-*.sh` scripts.
`.github/workflows/selftest.yml` runs the linter's own `yarn test` (selftest + rule-equality +
conformance, as of A3) whenever `linter_review_tool/**`, `packages/**` or `checks.workflow.yml`
changes.

## Architecture: the linter tool (`linter_review_tool/`)

- `review.js` — entry point. Globs `src/` for `.js/.mjs/.cjs`, `.css/.scss/.less`, `.html/.htm`
  files (case-insensitively), skipping `node_modules/`, `dist/`, `vendor/`, and `*.min.*`/
  `*.bundle.*`, then dispatches each file to the matching linter.
- `linters/eslint-linter.js`, `stylelint-linter.js`, `html-linter.js` — one per file type.
  HTML checks are factual (parse5-based), not stylistic.
- `packages/addon-eslint-config/rules/` — custom ESLint plugin `shoptet/*` (e.g. `no-core-overwrite`,
  `no-testid-selector`, `prefer-fetch`). Every rule file opens with a block JSDoc whose first line
  is the catalog ID and title (`* B6. Do not overwrite Shoptet core`), matching the FE rules
  catalog `shoptet-addon-review` reviews against. `rules/global-callee.js` and
  `rules/script-detect.js` are shared helpers, not rules, and carry no catalog ID.
- `packages/addon-stylelint-config/stylelint-rules/` — custom stylelint plugin (`max-z-index`,
  `no-pt-unit`, etc.).
- `profiles.js` — assembles `RELIABLE_RULES` at load time from each rule package's own
  `reliable-rules.js` (`packages/addon-eslint-config`, `packages/addon-stylelint-config`,
  `packages/addon-html-lint`); it hardcodes no rule id itself. `RELIABLE_RULES` is the _only_ set
  the tool reports — a rule belongs there only when a positive finding is ~zero-false-positive
  (false negatives are acceptable for a gate). Of `RELIABLE_RULES`, only the error-severity subset
  actually gates the PR; the rest are non-blocking recommendations. Heuristic/contextual checks
  are deliberately out of scope here — that's `shoptet-addon-review`'s job.
- `lib/reconcile-utils.js` — shared logic for reconciling findings across pushes (fingerprint =
  `file | line | rule | message`); required directly by the `checks.workflow.yml` github-script
  blocks, which is why `selftest.yml` also triggers on changes to that workflow file.
- `test-cases/` — `good/` (must produce zero findings) and `bad/` (must trigger an exact rule
  set) fixtures. `test-cases/expected.json` is the machine-checked source of truth mapping every
  `bad/` fixture to its expected ruleIds; `test/selftest.js` enforces it. A fixture missing from
  the spec (or a spec entry without a matching file) fails the test.
- `test/rule-equality.js` (A3) — asserts this repo's effective rule set equals the shared packages'
  declared `RELIABLE_RULES` + config severity, by rule id and severity only (never message text or
  report ranges — see `doc/plans/rule-unification/a3.md`). Reads `RELIABLE_RULES` from each
  package's own named export, never a local copy.
- `test/conformance.js` (A3) — runs the shared discovery corpus
  (`@shoptet/addon-lint-conformance`, `packages/addon-lint-conformance/`) against `review.js`:
  minified/bundle/`dist/`/`vendor/`/dotfile/symlinked-directory skipping, a target directory
  outside this tool's own tree, and fail-closed-on-all-skipped. This is the layer the other three
  rule packages don't cover — see `packages/addon-lint-conformance/README.md` for the manifest
  schema.

When adding or changing a rule: add/update the rule file, add it to that rule package's
`reliable-rules.js` only if it's genuinely zero-FP, and add matching fixtures to
`test-cases/{good,bad}/` plus an entry in `expected.json`.

**The gate always runs the linter from `main`.** `checks.workflow.yml` checks the review tool out
with a hardcoded `ref: main`, so a rule change on a feature branch has no effect on the partner
gate until it lands — opening a PR here never exercises it end-to-end (verify locally with
`review.js`, or via the self-test). Conversely, merging to `main` deploys instantly to every caller
pinning `@main`, with no staged rollout.

## Architecture: `checks.workflow.yml`

This is the largest and most stateful workflow in the repo (695 lines) — treat changes to it
carefully and always accompany them with `bash tests/test-checks-workflow-scripts.sh`.

- Findings are posted as inline PR review comments and reconciled across pushes by fingerprint
  (`file | line | rule | message`); a push that shifts line numbers above a finding recreates its
  comment (and drops any human replies under the old one) — this is a known, accepted limitation.
- Only ❌ blockers gate (`REQUEST_CHANGES` + failing check); the verdict is dismissed
  automatically once all blockers are resolved.
- At most 100 inline comments per run, blockers first; the full finding list is always in the
  job Summary regardless of inline-comment limits.
- Separate jobs also verify protected paths (`.github/workflows/`) aren't modified, that the
  required Shoptet reviewer has an actual submitted review, and post-merge `merge-audit` flags a
  merge into `main`/`master` by anyone other than `REQUIRED_REVIEWER` (with a retroactive-review
  exception for `hotfix/*` branches touching only `src/`).
- Callers **must** include `closed` in their `pull_request` trigger types or `merge-audit` never
  runs — GitHub's default trigger set doesn't include it. See README's "Merge audit and caller
  trigger requirements" section for the full set of caller-side requirements (permissions block,
  not declaring both `pull_request` and `pull_request_target`, etc.).

## Package manager / Node version resolution

The build workflow (`default.workflow.yml`) supports npm, Yarn (classic and Berry), and pnpm,
resolved in order: explicit `package_manager` input → `packageManager` field in `package.json` →
committed lockfile. `deploy.workflow.yml` is a thin wrapper and its `workflow_call.inputs` must
stay identical to `default.workflow.yml`'s — enforced by `tests/test-workflow-scripts.sh`. Default
Node version is documented in the README and mirrored there by the same test script — if you
change the default in the workflow YAML, update the README prose in the same change or the test
fails.

## `shoptet-addon-review/`

A separate concern from the linter gate: an AI code-review Claude Code plugin
`shoptet-addon-review` (its skill is `st-addon-review`) that reviews addon PRs against a FE rules
catalog, for the semantic/heuristic
findings the deterministic linter can't catch (XSS, reimplementing Shoptet core, DOM-vs-dataLayer
parsing, duplication). `CONTEXT.md` in that directory is the current source of truth for what
mode it runs in, what's deliberately deferred, and which guardrails must not be relaxed — read it
before changing behavior there. Key invariants: only catalog-mapped findings can block; the AI's
own judgment findings are non-binding and capped at `recommended`; the AI never edits the catalog
or the code, only proposes fixes.
