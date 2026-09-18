/**
 * Discovery conformance corpus runner (A3).
 *
 * Materializes each shape from `@shoptet/addon-lint-conformance`'s
 * `corpus.json` into a real temp directory (via that package's
 * `materializeShape`, never a private copy of the shapes — see
 * doc/plans/rule-unification/a3.md, "neither repository owns a private
 * copy"), runs `review.js` against it exactly as CI does (absolute target
 * path, `cwd` left at this tool's own directory), and asserts the outcome
 * each shape's `expect` block describes.
 *
 * Every `materializeShape` temp dir lives under `os.tmpdir()`, which is
 * never inside this package's own source tree — so every shape here already
 * exercises the "target directory outside the runner's own tree" property;
 * `outside-tree-still-blocks` is simply the shape whose `expect` is written
 * to make that property load-bearing rather than incidental.
 *
 * The CLI repo (`shoptet/partner-cli`) runs the SAME corpus against
 * `shoptet validate` in its own `B4` slice — see that repo's
 * doc/plans/rule-unification-b4.md. Parity between the two runners' outcomes
 * on these shapes is the whole point; this file only asserts THIS repo's
 * side.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { corpus, materializeShape } = require('@shoptet/addon-lint-conformance');

const ROOT = path.join(__dirname, '..');

let failures = 0;
function pass(msg) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg) {
  failures += 1;
  console.error(`  ✗ ${msg}`);
}

function runReview(targetDir) {
  try {
    const stdout = execFileSync(process.execPath, ['review.js', targetDir, '--rdjson'], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { status: 0, json: JSON.parse(stdout) };
  } catch (error) {
    let json = null;
    try {
      json = JSON.parse(error.stdout ? error.stdout.toString() : '');
    } catch {
      /* non-JSON stdout on a hard failure is itself a finding, handled by callers */
    }
    return { status: error.status, json };
  }
}

function toRelative(targetDir, absPath) {
  return path.relative(targetDir, absPath);
}

function checkShape(shape) {
  const { dir, cleanup } = materializeShape(shape);
  try {
    const result = runReview(dir);
    const expect = shape.expect;
    const json = result.json || { diagnostics: [], skipped: [] };
    const diagnostics = json.diagnostics || [];
    const skippedRel = (json.skipped || []).map((p) => toRelative(dir, path.resolve(ROOT, p)));

    let ok = true;

    if (expect.exitCode !== undefined && result.status !== expect.exitCode) {
      fail(`${shape.id}: exit code ${result.status}, expected ${expect.exitCode}`);
      ok = false;
    }

    if (expect.failClosed) {
      // Fail-closed means: this must NOT look like a clean success. Both
      // this tool's mechanisms qualify — a non-zero exit, or (in --rdjson
      // mode specifically) status 0 is the ordinary "ran successfully"
      // signal, so failClosed here means status !== 0.
      if (result.status === 0) {
        fail(`${shape.id}: expected a fail-closed (non-zero) outcome, got exit 0`);
        ok = false;
      }
    }

    for (const relPath of expect.skippedPaths || []) {
      if (!skippedRel.includes(relPath)) {
        fail(`${shape.id}: expected "${relPath}" in skipped, got [${skippedRel.join(', ')}]`);
        ok = false;
      }
    }

    for (const relDir of expect.skippedDirs || []) {
      const anyDiagUnderDir = diagnostics.some((d) =>
        toRelative(dir, path.resolve(ROOT, d.location.path)).startsWith(relDir + path.sep),
      );
      if (anyDiagUnderDir) {
        fail(`${shape.id}: expected nothing under "${relDir}" to produce findings, but it did`);
        ok = false;
      }
    }

    for (const wanted of expect.findings || []) {
      const found = diagnostics.some(
        (d) =>
          d.code.value === wanted.ruleId &&
          (d.severity === 'ERROR' ? 'blocker' : 'recommend') === wanted.severity &&
          toRelative(dir, path.resolve(ROOT, d.location.path)) === wanted.path,
      );
      if (!found) {
        fail(
          `${shape.id}: expected ${wanted.ruleId}@${wanted.severity} on ${wanted.path}, not found`,
        );
        ok = false;
      }
    }

    for (const excludedPath of expect.findingsExcludePaths || []) {
      const found = diagnostics.some(
        (d) => toRelative(dir, path.resolve(ROOT, d.location.path)) === excludedPath,
      );
      if (found) {
        fail(`${shape.id}: expected NO findings on "${excludedPath}", but got one`);
        ok = false;
      }
    }

    if (expect.forbidMessagePattern) {
      const re = new RegExp(expect.forbidMessagePattern, 'i');
      const offender = diagnostics.find((d) => re.test(d.message));
      if (offender) {
        fail(
          `${shape.id}: a finding's message matched the forbidden pattern "${expect.forbidMessagePattern}": ${offender.message}`,
        );
        ok = false;
      }
    }

    if (ok) pass(`${shape.id}: ${shape.description}`);
  } finally {
    cleanup();
  }
}

function main() {
  console.log('discovery conformance corpus (A3):');
  for (const shape of corpus.shapes) {
    checkShape(shape);
  }

  // Explicitly confirm the corpus is not vendored — a copy sitting under
  // this tool's own tree would defeat the "single source of truth" promise
  // just as surely as a private RELIABLE_RULES copy would (a3.md's review
  // checklist). node_modules/@shoptet/addon-lint-conformance is a symlink
  // into ../packages, per the workspace's `link:` dependency — resolve it
  // and confirm it lands there, not inside a duplicated tree.
  const resolvedCorpusPkg = fs.realpathSync(
    require.resolve('@shoptet/addon-lint-conformance/package.json'),
  );
  const packagesDir = fs.realpathSync(path.join(ROOT, '..', 'packages', 'addon-lint-conformance'));
  if (path.dirname(resolvedCorpusPkg) === packagesDir) {
    pass(`corpus resolves to ../packages/addon-lint-conformance, not a private copy`);
  } else {
    fail(
      `corpus package resolved to ${resolvedCorpusPkg}, expected it under ${packagesDir} — ` +
        `this repo may be reading a vendored copy instead of the shared package`,
    );
  }

  if (failures > 0) {
    console.error(`\n${failures} conformance failure(s).`);
    process.exitCode = 1;
  } else {
    console.log('\nAll conformance shapes matched.');
  }
}

main();
