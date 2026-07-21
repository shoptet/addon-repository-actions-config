#!/bin/bash
# Tests for the shell scripts embedded in .github/workflows/default.workflow.yml.
# The scripts are extracted from the YAML itself, so the tests always exercise
# exactly what the workflow runs. Requires: bash, ruby (yaml), node, git.
set -u

ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORKFLOW="$ROOT/.github/workflows/default.workflow.yml"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
DETECT="$TMP/detect.sh"
SETUP="$TMP/setup.sh"
NPM_SETUP="$TMP/npm-setup.sh"
INSTALL="$TMP/install.sh"

ruby -ryaml -e '
wf, detect, setup, npm_setup, install = ARGV
steps = YAML.load_file(wf)["jobs"]["build"]["steps"]
by_name = steps.map { |s| [s["name"], s] }.to_h
File.write(detect, by_name["Detect package manager"]["run"])
File.write(setup, by_name["Setup package manager version"]["run"])
File.write(npm_setup, by_name["Setup npm version"]["run"])
File.write(install, by_name["Install dependencies and build"]["run"])
' "$WORKFLOW" "$DETECT" "$SETUP" "$NPM_SETUP" "$INSTALL"

# Stub package manager binaries so tests only record what would be executed
# instead of installing anything for real. YARN_STUB_APPEND_LOCK=1 makes the
# yarn stub modify yarn.lock, simulating a lockfile drift regeneration.
STUB="$TMP/stub-bin"
mkdir -p "$STUB"
for cmd in npm corepack pnpm yarn; do
  cat > "$STUB/$cmd" <<EOF
#!/bin/bash
if [ \$# -gt 0 ]; then echo "$cmd \$*" >> "\$STUB_LOG"; else echo "$cmd" >> "\$STUB_LOG"; fi
if [ "$cmd" = "yarn" ] && [ \$# -eq 0 ] && [ "\${YARN_STUB_APPEND_LOCK:-}" = "1" ]; then echo drift >> yarn.lock; fi
EOF
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

run_detect() { # dir override -> "exit=<code> pm=<pm> pin=<pin>"
  local out; out=$(mktemp)
  ( cd "$1" && PM_OVERRIDE="$2" GITHUB_OUTPUT="$out" bash --noprofile --norc -e -o pipefail "$DETECT" ) > "$1/.log" 2>&1
  echo "exit=$? pm=$(grep -oE '^pm=.*' "$out" | cut -d= -f2) pin=$(grep -oE '^pin=.*' "$out" | cut -d= -f2)"
  rm -f "$out"
}

expect_log() { # name dir pattern [logname]
  if grep -q "$3" "$2/${4:-.log}"; then
    PASS=$((PASS+1)); echo "PASS: $1"
  else
    FAIL=$((FAIL+1)); echo "FAIL: $1 — log does not contain: $3"; sed 's/^/  log: /' "$2/${4:-.log}"
  fi
}

expect_not_log() { # name dir pattern [logname]
  if grep -q "$3" "$2/${4:-.log}"; then
    FAIL=$((FAIL+1)); echo "FAIL: $1 — log unexpectedly contains: $3"; sed 's/^/  log: /' "$2/${4:-.log}"
  else
    PASS=$((PASS+1)); echo "PASS: $1"
  fi
}

### Detection: lockfile auto-detection
d=$(fixture yarn-only yarn.lock)
check "yarn.lock only -> yarn" "exit=0 pm=yarn pin=" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture npm-only package-lock.json)
check "package-lock.json only -> npm" "exit=0 pm=npm pin=" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture pnpm-only pnpm-lock.yaml)
check "pnpm-lock.yaml only -> pnpm" "exit=0 pm=pnpm pin=" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture pnpm-and-stale-yarn pnpm-lock.yaml yarn.lock)
check "pnpm-lock + stale yarn.lock -> pnpm" "exit=0 pm=pnpm pin=" "$(run_detect "$d" '')" "$d/.log"
expect_log "multiple lockfiles emit warning" "$d" '::warning::Multiple lockfiles are committed'

d=$(fixture all-locks pnpm-lock.yaml yarn.lock package-lock.json)
check "all three lockfiles -> pnpm" "exit=0 pm=pnpm pin=" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture yarn-and-npm yarn.lock package-lock.json)
check "yarn.lock + package-lock -> yarn (backward compat)" "exit=0 pm=yarn pin=" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture no-lockfile)
check "no lockfile, no input -> error" "exit=1 pm= pin=" "$(run_detect "$d" '')"
expect_log "no-lockfile error message" "$d" '::error::No supported lockfile found'

### Detection: package_manager input override
d=$(fixture override-npm package-lock.json)
check "override npm + lockfile -> npm" "exit=0 pm=npm pin=" "$(run_detect "$d" 'npm')" "$d/.log"

d=$(fixture override-no-lock)
check "override npm without lockfile -> error (reproducible builds)" "exit=1 pm= pin=" "$(run_detect "$d" 'npm')"
expect_log "override missing-lockfile error names the lockfile" "$d" 'package-lock.json is not committed'

d=$(fixture override-mismatch pnpm-lock.yaml)
check "override yarn + only pnpm-lock -> error" "exit=1 pm= pin=" "$(run_detect "$d" 'yarn')"

d=$(fixture override-invalid yarn.lock)
check "override bun -> error" "exit=1 pm= pin=" "$(run_detect "$d" 'bun')"
expect_log "invalid override error message" "$d" "::error::Unsupported package_manager input 'bun'"

d=$(fixture override-with-pin yarn.lock)
echo '{"packageManager": "yarn@4.6.0"}' > "$d/package.json"
check "override yarn honors matching field pin" "exit=0 pm=yarn pin=4.6.0" "$(run_detect "$d" 'yarn')" "$d/.log"

d=$(fixture override-foreign-pin package-lock.json)
echo '{"packageManager": "yarn@4.6.0"}' > "$d/package.json"
check "override npm ignores foreign yarn pin" "exit=0 pm=npm pin=" "$(run_detect "$d" 'npm')" "$d/.log"

### Detection: packageManager field in package.json
d=$(fixture field-pnpm pnpm-lock.yaml)
echo '{"packageManager": "pnpm@10.4.1+sha512.abc"}' > "$d/package.json"
check "field pnpm + lockfile -> pnpm, sha stripped from pin" "exit=0 pm=pnpm pin=10.4.1" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture field-pnpm-no-lock)
echo '{"packageManager": "pnpm@10.4.1"}' > "$d/package.json"
check "field pnpm without lockfile -> error" "exit=1 pm= pin=" "$(run_detect "$d" '')"
expect_log "field missing-lockfile error names the lockfile" "$d" 'pnpm-lock.yaml is not committed'

d=$(fixture field-yarn-classic yarn.lock)
echo '{"packageManager": "yarn@1.22.22"}' > "$d/package.json"
check "field yarn@1 + yarn.lock -> yarn with pin" "exit=0 pm=yarn pin=1.22.22" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture field-npm package-lock.json)
echo '{"packageManager": "npm@10.9.2"}' > "$d/package.json"
check "field npm + package-lock -> npm with pin" "exit=0 pm=npm pin=10.9.2" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture field-npm-empty-version package-lock.json)
echo '{"packageManager": "npm@"}' > "$d/package.json"
check "field npm@ (empty version) -> npm, no pin" "exit=0 pm=npm pin=" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture field-bare-pnpm pnpm-lock.yaml)
echo '{"packageManager": "pnpm"}' > "$d/package.json"
check "bare field pnpm (no version) -> pnpm, no pin" "exit=0 pm=pnpm pin=" "$(run_detect "$d" '')" "$d/.log"

d=$(fixture field-unsupported package-lock.json)
echo '{"packageManager": "bun@1.0.0"}' > "$d/package.json"
check "field bun -> error (no silent fallback)" "exit=1 pm= pin=" "$(run_detect "$d" '')"
expect_log "unsupported field error mentions the value" "$d" "::error::Unsupported package manager 'bun@1.0.0'"

d=$(fixture field-malformed yarn.lock)
echo '{"packageManager": "something-weird"}' > "$d/package.json"
check "malformed field -> error" "exit=1 pm= pin=" "$(run_detect "$d" '')"

d=$(fixture broken-pkg-json yarn.lock)
echo 'not json' > "$d/package.json"
check "unparsable package.json falls back to lockfile" "exit=0 pm=yarn pin=" "$(run_detect "$d" '')" "$d/.log"

### Version setup (before setup-node): what would be installed/activated
run_setup() { # dir pm pin -> prints stub log
  local log="$1/.stub.log"; : > "$log"
  ( cd "$1" && PATH="$STUB:$PATH" STUB_LOG="$log" PM="$2" PIN="$3" GITHUB_ENV="$1/.github.env" \
    bash --noprofile --norc -e -o pipefail "$SETUP" ) > "$1/.setup.log" 2>&1 || echo "SETUP_FAILED"
  cat "$log"
}

d=$(fixture setup-pnpm-pinned)
check "pnpm pin installed as-is" "npm install -g pnpm@9.12.3
pnpm --version" "$(run_setup "$d" pnpm 9.12.3)"

d=$(fixture setup-pnpm-lock9)
printf "lockfileVersion: '9.0'\n" > "$d/pnpm-lock.yaml"
check "pnpm lockfileVersion 9.0 -> pnpm@10" "npm install -g pnpm@10
pnpm --version" "$(run_setup "$d" pnpm '')"

d=$(fixture setup-pnpm-lock6)
printf "lockfileVersion: '6.0'\n" > "$d/pnpm-lock.yaml"
check "pnpm lockfileVersion 6.0 -> pnpm@8" "npm install -g pnpm@8
pnpm --version" "$(run_setup "$d" pnpm '')"

d=$(fixture setup-pnpm-lock54)
printf "lockfileVersion: 5.4\n" > "$d/pnpm-lock.yaml"
check "pnpm lockfileVersion 5.4 -> pnpm@7" "npm install -g pnpm@7
pnpm --version" "$(run_setup "$d" pnpm '')"

d=$(fixture setup-pnpm-lock53)
printf "lockfileVersion: 5.3\n" > "$d/pnpm-lock.yaml"
check "pnpm lockfileVersion 5.3 -> pnpm@7" "npm install -g pnpm@7
pnpm --version" "$(run_setup "$d" pnpm '')"

d=$(fixture setup-pnpm-lock-future)
printf "lockfileVersion: '10.0'\n" > "$d/pnpm-lock.yaml"
check "unknown future lockfileVersion -> hard error, no silent pnpm@10" "SETUP_FAILED" "$(run_setup "$d" pnpm '')"
expect_log "future lockfileVersion error asks for a pin" "$d" "::error::Unrecognized lockfileVersion '10.0'" .setup.log

d=$(fixture setup-yarn-pinned)
check "yarn pin activates corepack" "corepack enable yarn" "$(run_setup "$d" yarn 4.6.0)"
grep -q 'COREPACK_ENABLE_DOWNLOAD_PROMPT=0' "$d/.github.env" \
  && { PASS=$((PASS+1)); echo "PASS: yarn pin exports COREPACK_ENABLE_DOWNLOAD_PROMPT"; } \
  || { FAIL=$((FAIL+1)); echo "FAIL: yarn pin exports COREPACK_ENABLE_DOWNLOAD_PROMPT"; }

d=$(fixture setup-yarn-classic-pin)
check "yarn classic pin activates corepack too" "corepack enable yarn" "$(run_setup "$d" yarn 1.22.22)"

d=$(fixture setup-yarn-unpinned yarn.lock)
check "yarn without pin -> preinstalled yarn, nothing to set up" "" "$(run_setup "$d" yarn '')"

d=$(fixture setup-npm-noop)
check "npm handled later -> no install before setup-node" "" "$(run_setup "$d" npm 10.9.2)"

### npm version setup (after setup-node)
run_npm_setup() { # dir pin -> prints stub log
  local log="$1/.stub.log"; : > "$log"
  ( cd "$1" && PATH="$STUB:$PATH" STUB_LOG="$log" PIN="$2" \
    bash --noprofile --norc -e -o pipefail "$NPM_SETUP" ) > "$1/.npm-setup.log" 2>&1 || echo "SETUP_FAILED"
  cat "$log"
}

d=$(fixture npm-setup-pinned)
check "npm pin installed after setup-node" "npm install -g npm@10.9.2
npm --version" "$(run_npm_setup "$d" 10.9.2)"

d=$(fixture npm-setup-unpinned)
check "npm without pin -> bundled npm" "npm --version" "$(run_npm_setup "$d" '')"

### Install and build
run_install() { # dir pm extra-env -> "exit=<code>" (stub log in .stub.log)
  local log="$1/.stub.log"; : > "$log"
  ( cd "$1" && PATH="$STUB:$PATH" STUB_LOG="$log" PM="$2" ${3:+env "$3"} \
    bash --noprofile --norc -e -o pipefail "$INSTALL" ) > "$1/.install.log" 2>&1
  echo "exit=$?"
}

install_fixture() { # name -> git repo with committed yarn.lock and a dist dir
  local dir; dir=$(fixture "$1" yarn.lock)
  mkdir -p "$dir/dist"
  ( cd "$dir" && git init -q && git add yarn.lock \
    && git -c user.email=test@test -c user.name=test commit -qm init )
  echo "$dir"
}

d=$(install_fixture install-npm)
check "install npm -> npm ci + build" "exit=0" "$(run_install "$d" npm)" "$d/.install.log"
check "install npm commands" "npm ci
npm run build -- --env production" "$(cat "$d/.stub.log")"

d=$(install_fixture install-pnpm)
check "install pnpm -> frozen install + build" "exit=0" "$(run_install "$d" pnpm)" "$d/.install.log"
check "install pnpm commands" "pnpm install --frozen-lockfile
pnpm run build --env production" "$(cat "$d/.stub.log")"

d=$(install_fixture install-yarn)
check "install yarn -> install + build" "exit=0" "$(run_install "$d" yarn)" "$d/.install.log"
check "install yarn commands" "yarn
yarn build --env production" "$(cat "$d/.stub.log")"
expect_not_log "clean yarn.lock -> no drift warning" "$d" '::warning::yarn install updated yarn.lock' .install.log

d=$(install_fixture install-yarn-drift)
check "install yarn with drifted lockfile still builds" "exit=0" "$(run_install "$d" yarn YARN_STUB_APPEND_LOCK=1)" "$d/.install.log"
expect_log "drifted yarn.lock emits warning" "$d" '::warning::yarn install updated yarn.lock' .install.log

d=$(install_fixture install-unknown)
check "install with unknown PM -> error" "exit=1" "$(run_install "$d" weird)"
expect_log "unknown PM error message" "$d" "::error::Unknown package manager 'weird'" .install.log

echo
echo "=== $PASS passed, $FAIL failed ==="
exit $((FAIL > 0))
