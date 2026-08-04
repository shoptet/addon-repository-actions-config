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
wf, files_js, collab_js = ARGV
jobs = YAML.load_file(wf)["jobs"]
grab = ->(job, step) {
  s = jobs.fetch(job) { abort "Job \"#{job}\" not found — renamed? Update tests/test-checks-workflow-scripts.sh." }["steps"]
        .find { |st| st["name"] == step } or abort "Step \"#{step}\" not found in job \"#{job}\"."
  s["with"]["script"]
}
File.write(files_js, grab.call("files-check", "Check protected files"))
File.write(collab_js, grab.call("collaborators-check", "Check required reviewers"))
' "$WORKFLOW" "$TMP/files.js" "$TMP/collab.js"

PASS=0
FAIL=0
run_case() { # name script fixture expected_exit
  local name="$1" script="$2" fixture="$3" expected="$4" actual
  if node "$RUNNER" "$script" "$fixture" >"$TMP/out.log" 2>&1; then actual=0; else actual=1; fi
  if [ "$actual" = "$expected" ]; then
    echo "PASS: $name"; PASS=$((PASS + 1))
  else
    echo "FAIL: $name (exit $actual, expected $expected)"; sed 's/^/    /' "$TMP/out.log"; FAIL=$((FAIL + 1))
  fi
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
run_case "new file inside protected directory fails" "$TMP/files.js" "$TMP/f2.json" 1

cat > "$TMP/f3.json" <<'EOF'
{ "env": { "PROTECTED_PATHS": ".github/workflows/" },
  "pr": { "number": 1 },
  "files": [ { "filename": "renamed-elsewhere.yml", "previous_filename": ".github/workflows/shoptetAddon.workflow.yml" } ] }
EOF
run_case "rename out of protected directory fails" "$TMP/files.js" "$TMP/f3.json" 1

cat > "$TMP/f4.json" <<'EOF'
{ "env": { "PROTECTED_PATHS": ".github/workflows/, config.json" },
  "pr": { "number": 1 },
  "files": [ { "filename": "config.json" } ] }
EOF
run_case "exact-file rule fails on that file" "$TMP/files.js" "$TMP/f4.json" 1

cat > "$TMP/f5.json" <<'EOF'
{ "env": { "PROTECTED_PATHS": ".github/workflows/, config.json" },
  "pr": { "number": 1 },
  "files": [ { "filename": "config.json.example" } ] }
EOF
run_case "exact-file rule is not a prefix match" "$TMP/files.js" "$TMP/f5.json" 0

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
run_case "no request and no review fails" "$TMP/collab.js" "$TMP/c2.json" 1

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
run_case "review by someone else does not count" "$TMP/collab.js" "$TMP/c4.json" 1

cat > "$TMP/c5.json" <<'EOF'
{ "env": { "REQUIRED_REVIEWER": "shoptet-addon-reviewer, second-reviewer" },
  "pr": { "number": 1, "requested_reviewers": [ { "login": "second-reviewer" } ], "requested_teams": [] },
  "reviews": [ { "user": { "login": "shoptet-addon-reviewer" }, "state": "COMMENTED" } ] }
EOF
run_case "multiple required reviewers combine request + review" "$TMP/collab.js" "$TMP/c5.json" 0

echo
echo "=== $PASS passed, $FAIL failed ==="
[ "$FAIL" = "0" ]
