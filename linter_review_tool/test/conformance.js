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

/**
 * The shapes THIS repo requires the corpus to contain. The corpus is shared
 * and published: it "intentionally does not enforce [consumer coverage] by
 * itself (it is data, not a test runner), so a new shape with no consumer
 * reading it is a silent no-op on both sides" (the package README, "Adding a
 * shape") — so each consumer pins what it reads, exactly as `expected.json`
 * pins the selftest's fixtures. An explicit id list, not a count: deleting
 * `skip-dist-dir` while adding any other shape keeps a count green. Missing
 * ids fail; EXTRA shapes in the corpus deliberately do not, so the corpus can
 * grow for the CLI (`B4`) without breaking this repo — the per-shape loop
 * prints every shape it ran, so a new one is never invisible.
 */
const REQUIRED_SHAPE_IDS = [
  'skip-minified',
  'skip-bundle',
  'skip-dist-dir',
  'skip-vendor-dir',
  'skip-dotfile',
  'skip-symlinked-dir',
  'symlinked-file-is-linted',
  'outside-tree-still-blocks',
  'all-candidates-skipped-fail-closed',
  'known-blocker-parity',
];

/** Every `expect` key this runner knows how to act on (the README's schema). */
const KNOWN_EXPECT_KEYS = new Set([
  'skippedPaths',
  'skippedDirs',
  'findings',
  'findingsExcludePaths',
  'forbidMessagePattern',
  'failClosed',
  'exitCode',
]);

/**
 * Does this `expect` block assert anything at all? Counting keys is not
 * enough: several shapes legitimately carry `"findings": []`, so `{ findings:
 * [] }` would pass a naive key check while asserting nothing whatsoever.
 */
function assertsSomething(expect) {
  if (!expect) return false;
  const nonEmptyList = ['skippedPaths', 'skippedDirs', 'findings', 'findingsExcludePaths'].some(
    (k) => Array.isArray(expect[k]) && expect[k].length > 0,
  );
  return (
    nonEmptyList ||
    typeof expect.forbidMessagePattern === 'string' ||
    expect.failClosed === true ||
    expect.exitCode !== undefined
  );
}

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
    // review.js emits skipped and location.path relative to ITS cwd (runReview
    // pins that to ROOT), so path.resolve(ROOT, p) recovers the absolute path
    // before re-relativising to the target dir — same idiom below.
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

    // `skippedDirs` is a CONJUNCTION (see the package README's schema table):
    // no file under the directory produced a finding AND the gap is visible
    // somewhere in the runner's skipped output. The second conjunct is the
    // load-bearing one — without it, a runner that filters dist/ and vendor/
    // out of its glob (instead of discovering them and then reporting them as
    // skipped) would still satisfy the first conjunct while the coverage gap
    // it exists to prove has gone silent.
    for (const relDir of expect.skippedDirs || []) {
      // The corpus always spells paths with '/', the runner reports them in
      // the host's separator — normalize before any prefix comparison.
      const nativeDir = relDir.split('/').join(path.sep);
      const anyDiagUnderDir = diagnostics.some((d) =>
        toRelative(dir, path.resolve(ROOT, d.location.path)).startsWith(nativeDir + path.sep),
      );
      if (anyDiagUnderDir) {
        fail(`${shape.id}: expected nothing under "${relDir}" to produce findings, but it did`);
        ok = false;
      }
      // A runner may report the directory itself, any file beneath it, or
      // both — all three satisfy "the gap is visible".
      const gapVisible = skippedRel.some(
        (p) => p === nativeDir || p.startsWith(nativeDir + path.sep),
      );
      if (!gapVisible) {
        fail(
          `${shape.id}: nothing under "${relDir}" appears in skipped — the coverage gap is silent; ` +
            `got [${skippedRel.join(', ')}]`,
        );
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

  // ── Completeness: the suite must not be able to shrink silently ──────────
  // Mirrors selftest.js's two-directional expected.json checks. Without these,
  // emptying one shape's `expect` or deleting a shape outright still prints
  // "All conformance shapes matched."
  console.log('corpus completeness:');
  const presentIds = new Set(corpus.shapes.map((s) => s.id));
  const missingIds = REQUIRED_SHAPE_IDS.filter((id) => !presentIds.has(id));
  if (missingIds.length) {
    fail(
      `corpus is missing shape(s) this repo requires: [${missingIds.join(', ')}] — ` +
        `a discovery guarantee lost its only check`,
    );
  } else {
    pass(`all ${REQUIRED_SHAPE_IDS.length} required shape id(s) present`);
  }

  let everyShapeAsserts = true;
  for (const shape of corpus.shapes) {
    if (!assertsSomething(shape.expect)) {
      fail(`${shape.id}: its \`expect\` block asserts nothing — the shape runs but proves nothing`);
      everyShapeAsserts = false;
    }
    const unknownKeys = Object.keys(shape.expect || {}).filter((k) => !KNOWN_EXPECT_KEYS.has(k));
    if (unknownKeys.length) {
      fail(
        `${shape.id}: \`expect\` key(s) [${unknownKeys.join(', ')}] are not ones this runner ` +
          `acts on — either a typo (e.g. "skippedDir" for "skippedDirs"), or a new corpus ` +
          `field this repo has not implemented yet. Both are coverage gaps: fix the typo, ` +
          `or add the check here.`,
      );
      everyShapeAsserts = false;
    }
  }
  if (everyShapeAsserts) pass('every shape asserts at least one observable outcome');

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
