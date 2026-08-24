#!/bin/bash
# Tests for the github-script blocks embedded in .github/workflows/checks.workflow.yml.
# The scripts are extracted from the YAML itself (same approach as
# test-workflow-scripts.sh), so the tests always exercise exactly what the
# workflow runs. Requires: bash, ruby (yaml), node.
set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORKFLOW="$ROOT/.github/workflows/checks.workflow.yml"
RUNNER="$ROOT/tests/run-github-script.js"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

ruby -ryaml -e '
wf, files_js, collab_js, audit_js = ARGV
jobs = YAML.load_file(wf)["jobs"]
grab = ->(job, step) {
  s = jobs.fetch(job) { abort "Job \"#{job}\" not found — renamed? Update tests/test-checks-workflow-scripts.sh." }["steps"]
        .find { |st| st["name"] == step } or abort "Step \"#{step}\" not found in job \"#{job}\"."
  s["with"]["script"]
}
File.write(files_js, grab.call("files-check", "Check protected files"))
File.write(collab_js, grab.call("collaborators-check", "Check required reviewers"))
File.write(audit_js, grab.call("merge-audit", "Verify who merged the pull request"))
' "$WORKFLOW" "$TMP/files.js" "$TMP/collab.js" "$TMP/audit.js" || exit 1

PASS=0
FAIL=0
run_case() { # name script fixture expected_exit [expected_log_pattern]
  # The exact exit code matters: the runner exits 2 on a script crash, so a
  # crash can never satisfy an expected_exit=1 (policy failure) case. The
  # optional pattern pins down *why* a deny case failed.
  local name="$1" script="$2" fixture="$3" expected="$4" pattern="${5:-}" actual
  node "$RUNNER" "$script" "$fixture" >"$TMP/out.log" 2>&1; actual=$?
  if [ "$actual" != "$expected" ]; then
    echo "FAIL: $name (exit $actual, expected $expected)"; sed 's/^/    /' "$TMP/out.log"; FAIL=$((FAIL + 1)); return
  fi
  if [ -n "$pattern" ] && ! grep -q "$pattern" "$TMP/out.log"; then
    echo "FAIL: $name — log does not contain: $pattern"; sed 's/^/    /' "$TMP/out.log"; FAIL=$((FAIL + 1)); return
  fi
  echo "PASS: $name"; PASS=$((PASS + 1))
}

### files-check — directory prefix + exact-file rules, renames

cat > "$TMP/f1.json" <<'EOF'
{ "env": { "PROTECTED_PATHS": ".github/workflows/" },
  "pr": { "number": 1 },
  "files": [ { "filename": "src/header/script.js" }, { "filename": "src/style.less" } ] }
EOF
run_case "src-only change passes" "$TMP/files.js" "$TMP/f1.json" 0

cat > "$TMP/f2.json" <<'EOF'
{ "env": { "PROTECTED_PATHS": ".github/workflows/" },
  "pr": { "number": 1 },
  "files": [ { "filename": ".github/workflows/brand-new.yml" } ] }
EOF
run_case "new file inside protected directory fails" "$TMP/files.js" "$TMP/f2.json" 1 'Protected files changed'

cat > "$TMP/f3.json" <<'EOF'
{ "env": { "PROTECTED_PATHS": ".github/workflows/" },
  "pr": { "number": 1 },
  "files": [ { "filename": "renamed-elsewhere.yml", "previous_filename": ".github/workflows/shoptetAddon.workflow.yml" } ] }
EOF
run_case "rename out of protected directory fails" "$TMP/files.js" "$TMP/f3.json" 1 'Protected files changed'

cat > "$TMP/f4.json" <<'EOF'
{ "env": { "PROTECTED_PATHS": ".github/workflows/, config.json" },
  "pr": { "number": 1 },
  "files": [ { "filename": "config.json" } ] }
EOF
run_case "exact-file rule fails on that file" "$TMP/files.js" "$TMP/f4.json" 1 'Protected files changed'

cat > "$TMP/f5.json" <<'EOF'
{ "env": { "PROTECTED_PATHS": ".github/workflows/, config.json" },
  "pr": { "number": 1 },
  "files": [ { "filename": "config.json.example" } ] }
EOF
run_case "exact-file rule is not a prefix match" "$TMP/files.js" "$TMP/f5.json" 0

# the 3000-file fixture is generated, not hand-written
node -e '
const files = Array.from({ length: 3000 }, (unused, i) => ({ filename: `src/f${i}.js` }));
process.stdout.write(JSON.stringify({
  env: { PROTECTED_PATHS: ".github/workflows/" },
  pr: { number: 1 },
  files
}));' > "$TMP/f6.json"
run_case "3000-file PR fails closed (scope unverifiable)" "$TMP/files.js" "$TMP/f6.json" 1 'scope cannot be verified'

### collaborators-check — requested reviewers + submitted reviews

cat > "$TMP/c1.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer" },
  "pr": { "number": 1, "requested_reviewers": [ { "login": "shoptet-addon-reviewer" } ], "requested_teams": [] },
  "reviews": [] }
EOF
run_case "requested reviewer passes" "$TMP/collab.js" "$TMP/c1.json" 0

cat > "$TMP/c2.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer" },
  "pr": { "number": 1, "requested_reviewers": [], "requested_teams": [] },
  "reviews": [] }
EOF
run_case "no request and no review fails" "$TMP/collab.js" "$TMP/c2.json" 1 'Missing required reviewers'

cat > "$TMP/c3.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer" },
  "pr": { "number": 1, "requested_reviewers": [], "requested_teams": [] },
  "reviews": [ { "user": { "login": "shoptet-addon-reviewer" }, "state": "APPROVED" } ] }
EOF
run_case "submitted review counts (approve + later push)" "$TMP/collab.js" "$TMP/c3.json" 0

cat > "$TMP/c4.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer" },
  "pr": { "number": 1, "requested_reviewers": [], "requested_teams": [] },
  "reviews": [ { "user": { "login": "someone-else" }, "state": "APPROVED" },
               { "user": null, "state": "COMMENTED" } ] }
EOF
run_case "review by someone else does not count" "$TMP/collab.js" "$TMP/c4.json" 1 'Missing required reviewers'

cat > "$TMP/c5.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer, second-reviewer" },
  "pr": { "number": 1, "requested_reviewers": [ { "login": "second-reviewer" } ], "requested_teams": [] },
  "reviews": [ { "user": { "login": "shoptet-addon-reviewer" }, "state": "COMMENTED" } ] }
EOF
run_case "multiple required reviewers combine request + review" "$TMP/collab.js" "$TMP/c5.json" 0

cat > "$TMP/c6.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer" },
  "pr": { "number": 1, "requested_reviewers": [], "requested_teams": [] },
  "reviews": [ { "user": { "login": "shoptet-addon-reviewer" }, "state": "CHANGES_REQUESTED" } ] }
EOF
run_case "a CHANGES_REQUESTED review still counts (deliberate)" "$TMP/collab.js" "$TMP/c6.json" 0

cat > "$TMP/c7.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer" },
  "pr": { "number": 1, "requested_reviewers": [], "requested_teams": [] },
  "reviews": [ { "user": { "login": "shoptet-addon-reviewer" }, "state": "DISMISSED" } ] }
EOF
run_case "a later-dismissed review still counts (deliberate)" "$TMP/collab.js" "$TMP/c7.json" 0

### merge-audit — who merged, hotfix exception, comment idempotence

cat > "$TMP/a1.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer", "HOTFIX_BRANCH_PREFIX": "hotfix/", "HOTFIX_ALLOWED_PATH": "src/" },
  "pr": { "number": 7, "merged_by": { "login": "shoptet-addon-reviewer" }, "head": { "ref": "feature/banner" } },
  "files": [], "comments": [] }
EOF
run_case "merge by Shoptet reviewer passes" "$TMP/audit.js" "$TMP/a1.json" 0 'authorized Shoptet reviewer'

cat > "$TMP/a2.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer", "HOTFIX_BRANCH_PREFIX": "hotfix/", "HOTFIX_ALLOWED_PATH": "src/" },
  "pr": { "number": 7, "merged_by": { "login": "partner-dev" }, "head": { "ref": "hotfix/broken-banner" } },
  "files": [ { "filename": "src/banner.js" }, { "filename": "src/style.less" } ],
  "comments": [] }
EOF
run_case "qualified hotfix passes and posts the retro-review comment" "$TMP/audit.js" "$TMP/a2.json" 0 'flagged for retroactive review'

cat > "$TMP/a3.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer", "HOTFIX_BRANCH_PREFIX": "hotfix/", "HOTFIX_ALLOWED_PATH": "src/" },
  "pr": { "number": 7, "merged_by": { "login": "partner-dev" }, "head": { "ref": "hotfix/sneaky" } },
  "files": [ { "filename": "src/banner.js" }, { "filename": "webpack.config.js" } ],
  "comments": [] }
EOF
run_case "hotfix touching files outside src/ fails and names them" "$TMP/audit.js" "$TMP/a3.json" 1 'webpack.config.js'

cat > "$TMP/a4.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer", "HOTFIX_BRANCH_PREFIX": "hotfix/", "HOTFIX_ALLOWED_PATH": "src/" },
  "pr": { "number": 7, "merged_by": { "login": "partner-dev" }, "head": { "ref": "feature/banner" } },
  "files": [ { "filename": "src/banner.js" } ], "comments": [] }
EOF
run_case "non-hotfix merge by partner fails" "$TMP/audit.js" "$TMP/a4.json" 1 'only hotfixes'

# the 3000-file fixture is generated, not hand-written
node -e '
const files = Array.from({ length: 3000 }, (unused, i) => ({ filename: `src/f${i}.js` }));
process.stdout.write(JSON.stringify({
  env: { REQUIRED_REVIEWER: "shoptet-addon-reviewer", HOTFIX_BRANCH_PREFIX: "hotfix/", HOTFIX_ALLOWED_PATH: "src/" },
  pr: { number: 7, merged_by: { login: "partner-dev" }, head: { ref: "hotfix/huge" } },
  files, comments: []
}));' > "$TMP/a5.json"
run_case "3000-file hotfix fails closed (scope unverifiable)" "$TMP/audit.js" "$TMP/a5.json" 1 'scope cannot be verified'

cat > "$TMP/a6.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer", "HOTFIX_BRANCH_PREFIX": "hotfix/", "HOTFIX_ALLOWED_PATH": "src/" },
  "pr": { "number": 7, "merged_by": { "login": "partner-dev" }, "head": { "ref": "hotfix/broken-banner" } },
  "files": [ { "filename": "src/banner.js" } ],
  "comments": [ { "user": { "login": "github-actions[bot]" }, "body": "older audit comment\n<!-- shoptet-merge-audit -->" } ] }
EOF
run_case "re-run with existing bot marker comment does not post again" "$TMP/audit.js" "$TMP/a6.json" 0 'already present'

cat > "$TMP/a6b.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer", "HOTFIX_BRANCH_PREFIX": "hotfix/", "HOTFIX_ALLOWED_PATH": "src/" },
  "pr": { "number": 7, "merged_by": { "login": "partner-dev" }, "head": { "ref": "hotfix/broken-banner" } },
  "files": [ { "filename": "src/banner.js" } ],
  "comments": [ { "user": { "login": "partner-dev" }, "body": "unrelated comment\n<!-- shoptet-merge-audit -->" } ] }
EOF
run_case "a partner-authored marker does not pre-suppress the audit comment" "$TMP/audit.js" "$TMP/a6b.json" 0 'flagged for retroactive review'

cat > "$TMP/a8.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer", "HOTFIX_BRANCH_PREFIX": "hotfix/", "HOTFIX_ALLOWED_PATH": "src/,assets/" },
  "pr": { "number": 7, "merged_by": { "login": "partner-dev" }, "head": { "ref": "hotfix/broken-banner" } },
  "files": [ { "filename": "src/banner.js" }, { "filename": "assets/logo.png" } ], "comments": [] }
EOF
run_case "HOTFIX_ALLOWED_PATH accepts a comma-separated list, same grammar as PROTECTED_PATHS" "$TMP/audit.js" "$TMP/a8.json" 0 'flagged for retroactive review'

cat > "$TMP/a7.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer", "HOTFIX_BRANCH_PREFIX": "hotfix/", "HOTFIX_ALLOWED_PATH": "src/" },
  "commentError": true,
  "pr": { "number": 7, "merged_by": { "login": "partner-dev" }, "head": { "ref": "hotfix/broken-banner" } },
  "files": [ { "filename": "src/banner.js" } ], "comments": [] }
EOF
run_case "comment API failure does not change a passing audit" "$TMP/audit.js" "$TMP/a7.json" 0 'Could not post the audit comment'

echo
echo "=== $PASS passed, $FAIL failed ==="
[ "$FAIL" = "0" ]
