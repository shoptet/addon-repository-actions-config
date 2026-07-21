#!/bin/bash
# Tests for the shell scripts embedded in .github/workflows/default.workflow.yml.
# The scripts are extracted from the YAML itself, so the tests always exercise
# exactly what the workflow runs. Requires: bash, ruby (yaml), node.
set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORKFLOW="$ROOT/.github/workflows/default.workflow.yml"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
DETECT="$TMP/detect.sh"
SETUP="$TMP/setup.sh"

ruby -ryaml -e '
wf, detect_out, setup_out = ARGV
steps = YAML.load_file(wf)["jobs"]["build"]["steps"]
by_name = steps.map { |s| [s["name"], s] }.to_h
File.write(detect_out, by_name["Detect package manager"]["run"])
File.write(setup_out, by_name["Setup package manager version"]["run"])
' "$WORKFLOW" "$DETECT" "$SETUP"

# Stub package manager binaries so version-setup tests only record what would
# be executed instead of installing anything for real.
STUB="$TMP/stub-bin"
mkdir -p "$STUB"
for cmd in npm corepack pnpm; do
  printf '#!/bin/bash\necho "%s $*" >> "$STUB_LOG"\n' "$cmd" > "$STUB/$cmd"
  chmod +x "$STUB/$cmd"
done

PASS=0; FAIL=0

check() { # name expected actual [logfile]
  if [ "$2" = "$3" ]; then
    PASS=$((PASS+1)); echo "PASS: $1"
  else
    FAIL=$((FAIL+1)); echo "FAIL: $1"; echo "  expected: $2"; echo "  actual:   $3"
    [ -n "${4:-}" ] && sed 's/^/  log: /' "$4"
  fi
}

fixture() { # name file... (touched empty)
  local dir="$TMP/fixtures/$1"; shift
  rm -rf "$dir"; mkdir -p "$dir"
  for f in "$@"; do touch "$dir/$f"; done
  echo "$dir"
}

run_detect() { # dir override -> "exit=<code> pm=<pm>"
  local out; out=$(mktemp)
  ( cd "$1" && PM_OVERRIDE="$2" GITHUB_OUTPUT="$out" bash --noprofile --norc -e -o pipefail "$DETECT" ) > "$1/.log" 2>&1
  echo "exit=$? pm=$(grep -oE '^pm=.*' "$out" | cut -d= -f2)"
  rm -f "$out"
}

expect_log() { # name dir pattern
  if grep -q "$3" "$2/.log"; then
    PASS=$((PASS+1)); echo "PASS: $1"
  else
    FAIL=$((FAIL+1)); echo "FAIL: $1 — log does not contain: $3"; sed 's/^/  log: /' "$2/.log"
  fi
}

### Detection: lockfile auto-detection
d=$(fixture yarn-only yarn.lock)
check "yarn.lock only -> yarn" "exit=0 pm=yarn" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture npm-only package-lock.json)
check "package-lock.json only -> npm" "exit=0 pm=npm" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture pnpm-only pnpm-lock.yaml)
check "pnpm-lock.yaml only -> pnpm" "exit=0 pm=pnpm" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture pnpm-and-stale-yarn pnpm-lock.yaml yarn.lock)
check "pnpm-lock + stale yarn.lock -> pnpm" "exit=0 pm=pnpm" "$(run_detect "$d" '')" "$d/.log"
expect_log "multiple lockfiles emit warning" "$d" '::warning::Multiple lockfiles are committed'

d=$(fixture all-locks pnpm-lock.yaml yarn.lock package-lock.json)
check "all three lockfiles -> pnpm" "exit=0 pm=pnpm" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture yarn-and-npm yarn.lock package-lock.json)
check "yarn.lock + package-lock -> yarn (backward compat)" "exit=0 pm=yarn" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture no-lockfile)
check "no lockfile, no input -> error" "exit=1 pm=" "$(run_detect "$d" '')"
expect_log "no-lockfile error message" "$d" '::error::No supported lockfile found'

### Detection: package_manager input override
d=$(fixture override-npm package-lock.json)
check "override npm + lockfile -> npm" "exit=0 pm=npm" "$(run_detect "$d" 'npm')" "$d/.log"

d=$(fixture override-no-lock)
check "override npm without lockfile -> error (reproducible builds)" "exit=1 pm=" "$(run_detect "$d" 'npm')"
expect_log "override missing-lockfile error names the lockfile" "$d" 'package-lock.json is not committed'

d=$(fixture override-mismatch pnpm-lock.yaml)
check "override yarn + only pnpm-lock -> error" "exit=1 pm=" "$(run_detect "$d" 'yarn')"

d=$(fixture override-invalid yarn.lock)
check "override bun -> error" "exit=1 pm=" "$(run_detect "$d" 'bun')"
expect_log "invalid override error message" "$d" "::error::Unsupported package_manager input 'bun'"

### Detection: packageManager field in package.json
d=$(fixture field-pnpm pnpm-lock.yaml)
echo '{"packageManager": "pnpm@10.4.1+sha512.abc"}' > "$d/package.json"
check "field pnpm + lockfile -> pnpm" "exit=0 pm=pnpm" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture field-pnpm-no-lock)
echo '{"packageManager": "pnpm@10.4.1"}' > "$d/package.json"
check "field pnpm without lockfile -> error" "exit=1 pm=" "$(run_detect "$d" '')"
expect_log "field missing-lockfile error names the lockfile" "$d" 'pnpm-lock.yaml is not committed'

d=$(fixture field-yarn-classic yarn.lock)
echo '{"packageManager": "yarn@1.22.22"}' > "$d/package.json"
check "field yarn@1 + yarn.lock -> yarn" "exit=0 pm=yarn" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture field-npm package-lock.json)
echo '{"packageManager": "npm@10.9.2"}' > "$d/package.json"
check "field npm + package-lock -> npm" "exit=0 pm=npm" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture field-unsupported package-lock.json)
echo '{"packageManager": "bun@1.0.0"}' > "$d/package.json"
check "field bun -> error (no silent fallback)" "exit=1 pm=" "$(run_detect "$d" '')"
expect_log "unsupported field error mentions the value" "$d" "::error::Unsupported package manager 'bun@1.0.0'"

d=$(fixture field-malformed yarn.lock)
echo '{"packageManager": "something-weird"}' > "$d/package.json"
check "malformed field -> error" "exit=1 pm=" "$(run_detect "$d" '')"

d=$(fixture broken-pkg-json yarn.lock)
echo 'not json' > "$d/package.json"
check "unparsable package.json falls back to lockfile" "exit=0 pm=yarn" "$(run_detect "$d" '')" "$d/.log"

### Version setup: what would be installed/activated (stubbed binaries)
run_setup() { # dir pm -> prints stub log
  local log="$1/.stub.log"; : > "$log"
  ( cd "$1" && PATH="$STUB:$PATH" STUB_LOG="$log" PM="$2" GITHUB_ENV="$1/.github.env" \
    bash --noprofile --norc -e -o pipefail "$SETUP" ) > "$1/.setup.log" 2>&1 || echo "SETUP_FAILED"
  cat "$log"
}

d=$(fixture setup-pnpm-pinned)
echo '{"packageManager": "pnpm@9.12.3"}' > "$d/package.json"
check "pnpm pinned version installed" "npm install -g pnpm@9.12.3
pnpm --version" "$(run_setup "$d" pnpm)"

d=$(fixture setup-pnpm-sha)
echo '{"packageManager": "pnpm@10.4.1+sha512.abc"}' > "$d/package.json"
check "pnpm pin sha suffix stripped" "npm install -g pnpm@10.4.1
pnpm --version" "$(run_setup "$d" pnpm)"

d=$(fixture setup-pnpm-lock9)
printf "lockfileVersion: '9.0'\n" > "$d/pnpm-lock.yaml"; echo '{}' > "$d/package.json"
check "pnpm lockfileVersion 9.0 -> pnpm@10" "npm install -g pnpm@10
pnpm --version" "$(run_setup "$d" pnpm)"

d=$(fixture setup-pnpm-lock6)
printf "lockfileVersion: '6.0'\n" > "$d/pnpm-lock.yaml"; echo '{}' > "$d/package.json"
check "pnpm lockfileVersion 6.0 -> pnpm@8" "npm install -g pnpm@8
pnpm --version" "$(run_setup "$d" pnpm)"

d=$(fixture setup-pnpm-lock54)
printf "lockfileVersion: 5.4\n" > "$d/pnpm-lock.yaml"; echo '{}' > "$d/package.json"
check "pnpm lockfileVersion 5.4 -> pnpm@7" "npm install -g pnpm@7
pnpm --version" "$(run_setup "$d" pnpm)"

d=$(fixture setup-pnpm-mismatched-pin)
printf "lockfileVersion: '6.0'\n" > "$d/pnpm-lock.yaml"
echo '{"packageManager": "yarn@4.6.0"}' > "$d/package.json"
check "foreign pin ignored, lockfile mapping wins" "npm install -g pnpm@8
pnpm --version" "$(run_setup "$d" pnpm)"

d=$(fixture setup-yarn-berry)
echo '{"packageManager": "yarn@4.6.0"}' > "$d/package.json"
check "yarn berry pin activates corepack" "corepack enable yarn" "$(run_setup "$d" yarn)"
grep -q 'COREPACK_ENABLE_DOWNLOAD_PROMPT=0' "$d/.github.env" \
  && { PASS=$((PASS+1)); echo "PASS: berry exports COREPACK_ENABLE_DOWNLOAD_PROMPT"; } \
  || { FAIL=$((FAIL+1)); echo "FAIL: berry exports COREPACK_ENABLE_DOWNLOAD_PROMPT"; }

d=$(fixture setup-yarn-classic)
echo '{"packageManager": "yarn@1.22.22"}' > "$d/package.json"
check "yarn classic pin -> preinstalled yarn, no corepack" "" "$(run_setup "$d" yarn)"

d=$(fixture setup-yarn-unpinned yarn.lock)
echo '{}' > "$d/package.json"
check "yarn without pin -> nothing to set up" "" "$(run_setup "$d" yarn)"

d=$(fixture setup-npm-pinned)
echo '{"packageManager": "npm@10.9.2"}' > "$d/package.json"
check "npm pinned version installed" "npm install -g npm@10.9.2
npm --version" "$(run_setup "$d" npm)"

d=$(fixture setup-npm-unpinned)
echo '{}' > "$d/package.json"
check "npm without pin -> no global install" "npm --version" "$(run_setup "$d" npm)"

echo
echo "=== $PASS passed, $FAIL failed ==="
exit $((FAIL > 0))
