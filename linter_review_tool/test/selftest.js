/**
 * Linter self-test — snapshot check of the rule set against the fixtures.
 *
 * Verifies three things (see test-cases/expected.json):
 *   1. every bad/ fixture triggers EXACTLY the ruleIds the spec says — so a
 *      rule that silently stops firing (or starts over-firing) fails CI here
 *      instead of reaching partners;
 *   2. every good/ fixture is completely clean (zero findings, warnings incl.);
 *   3. completeness — every file in bad/ has a spec entry and every spec entry
 *      has a file, so fixtures can't drift out of the spec unnoticed.
 *
 * Exit code: 0 = all pass, 1 = any mismatch.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CASES = path.join(ROOT, 'test-cases');
const spec = JSON.parse(fs.readFileSync(path.join(CASES, 'expected.json'), 'utf8'));
delete spec.$comment;

function runReview(target) {
  // review.js exits 0 in rdjson mode on success; a non-zero exit here means a
  // hard failure (which is itself a test failure for good/, expected for none).
  const stdout = execFileSync(process.execPath, ['review.js', target, '--rdjson'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  const payload = JSON.parse(stdout);
  // A fixture misdetected as minified/vendored would pass "clean" vacuously —
  // assert nothing in test-cases/ is ever skipped (round 8).
  if ((payload.skipped || []).length) {
    throw new Error(`${target}: fixtures unexpectedly skipped: ${payload.skipped.join(', ')}`);
  }
  return payload.diagnostics;
}

function groupRulesByFile(diagnostics) {
  const byFile = new Map();
  for (const d of diagnostics) {
    // paths come back relative to cwd (linter_review_tool) → strip test-cases/
    const key = d.location.path.replace(/^test-cases\//, '');
    if (!byFile.has(key)) byFile.set(key, new Set());
    // Severity is part of the snapshot: only blockers gate the PR, so a silent
    // error→warn downgrade must fail this suite, not just a ruleId change.
    const severity = d.severity === 'ERROR' ? 'blocker' : 'recommend';
    byFile.get(key).add(`${d.code.value}@${severity}`);
  }
  return byFile;
}

let failures = 0;
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`); };
const pass = (msg) => console.log(`  ✓ ${msg}`);

// ── 1+3: bad fixtures — exact rule sets + completeness ──────────────────────
console.log('bad/ fixtures:');
const badFindings = groupRulesByFile(runReview('test-cases/bad'));
// Filter dotfiles — Finder drops .DS_Store uninvited and it is not a fixture.
const badFilesOnDisk = fs.readdirSync(path.join(CASES, 'bad')).filter((f) => !f.startsWith('.')).map((f) => `bad/${f}`);

for (const file of badFilesOnDisk) {
  if (!(file in spec)) { fail(`${file}: missing from expected.json (undocumented fixture)`); continue; }
  const expected = [...spec[file]].sort();
  const actual = [...(badFindings.get(file) || [])].sort();
  if (JSON.stringify(expected) === JSON.stringify(actual)) {
    pass(`${file}: [${actual.join(', ')}]`);
  } else {
    fail(`${file}: expected [${expected.join(', ')}] but got [${actual.join(', ') || '(nothing)'}]`);
  }
}
for (const file of Object.keys(spec)) {
  if (!badFilesOnDisk.includes(file)) fail(`${file}: listed in expected.json but the file does not exist`);
}

// ── 2: good fixtures — must be completely clean ─────────────────────────────
console.log('good/ fixtures:');
const goodFindings = groupRulesByFile(runReview('test-cases/good'));
const goodFilesOnDisk = fs.readdirSync(path.join(CASES, 'good')).filter((f) => !f.startsWith('.')).map((f) => `good/${f}`);
for (const file of goodFilesOnDisk) {
  const rules = goodFindings.get(file);
  if (rules && rules.size) fail(`${file}: expected clean but got [${[...rules].sort().join(', ')}]`);
  else pass(`${file}: clean`);
}

// ── 4: reconcile-utils — the diff parser and fingerprint the CI workflow
//       require()s from this tool (silent-failure territory, so unit-pinned) ──
console.log('reconcile-utils:');
const { parseAddedLines, findingFingerprint } = require('../lib/reconcile-utils');
const parserCases = [
  {
    name: 'no-newline marker must not shift the counter',
    diff: '@@ -3 +3 @@\n-const x = oldLast;\n\\ No newline at end of file\n+const x = newLast;',
    expect: [3],
  },
  {
    name: 'added lines starting with ++/-- are content, not headers',
    diff: '@@ -1,0 +2,3 @@\n+++i;\n+--i;\n+console.log(i);',
    expect: [2, 3, 4],
  },
  {
    name: 'added line starting with "++ " (space) inside a hunk is content too',
    diff: '@@ -1,1 +1,3 @@\n keep();\n+++ x;\n+realBlocker();',
    expect: [2, 3],
  },
  {
    name: 'real file headers (with space) are skipped',
    diff: '--- a/f.js\n+++ b/f.js\n@@ -1 +1,2 @@\n+line1\n+line2',
    expect: [1, 2],
  },
  {
    name: 'context and removed lines advance/hold the counter correctly',
    diff: '@@ -10,3 +10,3 @@\n ctx\n-removed\n+added\n ctx2',
    expect: [11],
  },
  {
    name: 'multi-hunk diffs reset the counter per hunk',
    diff: '@@ -1,2 +1,3 @@\n ctx\n+addA\n ctx2\n@@ -10,2 +11,3 @@\n ctx\n+addB\n ctx3',
    expect: [2, 12],
  },
];
for (const c of parserCases) {
  const got = [...parseAddedLines(c.diff)].sort((a, b) => a - b);
  if (JSON.stringify(got) === JSON.stringify(c.expect)) pass(c.name);
  else fail(`${c.name}: expected ${JSON.stringify(c.expect)}, got ${JSON.stringify(got)}`);
}
// parseAddedLines is single-file by contract — a concatenated multi-file diff
// must throw, not silently mis-anchor (round 8).
try {
  parseAddedLines('diff --git a/a.js b/a.js\n@@ -0,0 +1 @@\n+x\ndiff --git a/b.js b/b.js\n@@ -0,0 +1 @@\n+y');
  fail('parseAddedLines: multi-file diff should throw');
} catch (e) {
  if (/single-file/.test(e.message)) pass('parseAddedLines: multi-file diff throws (contract enforced)');
  else fail(`parseAddedLines: threw the wrong error: ${e.message}`);
}

const mkFp = (path2, line, rule, message) => findingFingerprint({ location: { path: path2, range: { start: { line } } }, code: { value: rule }, message });
const mkDiag = (line) => ({ location: { path: 'a.js', range: { start: { line } } }, code: { value: 'no-console' }, message: 'x' });
if (findingFingerprint(mkDiag(5)) === findingFingerprint(mkDiag(5))) pass('fingerprint is deterministic');
else fail('fingerprint is not deterministic');
if (findingFingerprint(mkDiag(5)) !== findingFingerprint(mkDiag(6))) pass('fingerprint distinguishes lines');
else fail('fingerprint does not include the line');
if (mkFp('a.js', 1, 'a', 'b\nc') !== mkFp('a.js', 1, 'a\nb', 'c')) pass('fingerprint fields cannot bleed across a newline');
else fail('fingerprint is ambiguous for fields containing newlines');

// ── 5: RELIABLE_RULES completeness — every gate rule must be pinned by a fixture ──
console.log('reliable-rules coverage:');
const { RELIABLE_RULES } = require('../profiles');
// Deliberately exempt: a defensive postcss channel that ordinary syntax errors
// never populate (they surface as CssSyntaxError, which IS pinned).
const COVERAGE_EXEMPT = new Set(['stylelint/parse-error']);
const pinned = new Set();
for (const rules of Object.values(spec)) for (const r of rules) pinned.add(r.split('@')[0]);
for (const rule of RELIABLE_RULES) {
  if (COVERAGE_EXEMPT.has(rule)) continue;
  if (pinned.has(rule)) pass(`${rule}: pinned`);
  else fail(`${rule}: in RELIABLE_RULES but no fixture pins it — a silent regression would pass CI`);
}

// ── 6: review.js fail-closed contract (what the workflow gate leans on) ──
console.log('review.js contract:');
function runRaw(args) {
  try {
    const stdout = execFileSync(process.execPath, ['review.js', ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return { status: 0, stdout };
  } catch (e) {
    return { status: e.status, stdout: e.stdout ? e.stdout.toString() : '' };
  }
}
const plainBad = runRaw(['test-cases/bad']);
if (plainBad.status === 1) pass('plain mode exits 1 on blockers (non-PR gate)');
else fail(`plain mode on bad/ exited ${plainBad.status}, expected 1`);
const plainGood = runRaw(['test-cases/good']);
if (plainGood.status === 0) pass('plain mode exits 0 on clean input');
else fail(`plain mode on good/ exited ${plainGood.status}, expected 0`);
const hardFail = runRaw(['test-cases/does-not-exist', '--rdjson']);
let hardJson = null;
try { hardJson = JSON.parse(hardFail.stdout); } catch (e) { /* handled below */ }
if (hardFail.status === 1 && hardJson && Array.isArray(hardJson.diagnostics) && hardJson.diagnostics.length === 0) {
  pass('fail(): exit 1 + valid empty-diagnostics JSON on stdout');
} else {
  fail(`fail() contract broken: status ${hardFail.status}, stdout ${hardFail.stdout.slice(0, 60)}`);
}
const os = require('os');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrt-skip-'));
fs.writeFileSync(path.join(tmp, 'app.js'), 'export const ok = 1;\n');
fs.writeFileSync(path.join(tmp, 'lib.min.js'), 'x');
const skipRun = runRaw([tmp, '--rdjson']);
const skipJson = JSON.parse(skipRun.stdout);
if (skipRun.status === 0 && (skipJson.skipped || []).some((f) => f.endsWith('lib.min.js'))) {
  pass('skipped array reports minified files');
} else {
  fail(`skipped contract broken: status ${skipRun.status}, skipped=${JSON.stringify(skipJson.skipped)}`);
}
fs.rmSync(tmp, { recursive: true, force: true });

console.log(failures ? `\n${failures} failure(s).` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
