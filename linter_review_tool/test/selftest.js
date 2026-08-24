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
    if (!byFile.has(key)) byFile.set(key, new Map());
    // Severity is part of the snapshot: only blockers gate the PR, so a silent
    // error→warn downgrade must fail this suite, not just a ruleId change.
    const severity = d.severity === 'ERROR' ? 'blocker' : 'recommend';
    const tag = `${d.code.value}@${severity}`;
    const counts = byFile.get(key);
    counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return byFile;
}

// Multiset snapshot: "rule@severity" for a single occurrence, "rule@severity:N"
// for N — a fixture promising "every form gates" must fail when a rule stops
// catching 7 of its 8 forms, not only when it stops entirely (round 13).
function formatCounts(counts) {
  if (!counts) return [];
  return [...counts.entries()]
    .map(([tag, n]) => (n > 1 ? `${tag}:${n}` : tag))
    .sort();
}

let failures = 0;
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`); };
const pass = (msg) => console.log(`  ✓ ${msg}`);

// ── 1+3: bad fixtures — exact rule sets + completeness ──────────────────────
console.log('bad/ fixtures:');
const badDiagnostics = runReview('test-cases/bad');
const badFindings = groupRulesByFile(badDiagnostics);
// Filter dotfiles — Finder drops .DS_Store uninvited and it is not a fixture.
const badFilesOnDisk = fs.readdirSync(path.join(CASES, 'bad')).filter((f) => !f.startsWith('.')).map((f) => `bad/${f}`);

for (const file of badFilesOnDisk) {
  if (!(file in spec)) { fail(`${file}: missing from expected.json (undocumented fixture)`); continue; }
  const expected = [...spec[file]].sort();
  const actual = formatCounts(badFindings.get(file));
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
  if (rules && rules.size) fail(`${file}: expected clean but got [${formatCounts(rules).join(', ')}]`);
  else pass(`${file}: clean`);
}

// ── 4: reconcile-utils — the diff parser and fingerprint the CI workflow
//       require()s from this tool (silent-failure territory, so unit-pinned) ──
console.log('reconcile-utils:');
const { parseAddedLines, findingFingerprint } = require('../lib/reconcile-utils');
const parserCases = [
  {
    // The round-9 regression pin: raw single-path `git diff` output carries
    // exactly ONE `diff --git` header and MUST parse (the large-file fallback
    // feeds it verbatim) — round 8 threw on it.
    name: 'real git diff shape (one header + index + file headers) parses',
    diff: 'diff --git a/src/app.js b/src/app.js\nindex 1234abc..5678def 100644\n--- a/src/app.js\n+++ b/src/app.js\n@@ -1,2 +1,3 @@\n ctx\n+added\n ctx2',
    expect: [2],
  },
  {
    name: 'git diff --unified=0 shape (no context) parses',
    diff: 'diff --git a/f.js b/f.js\nindex 1111111..2222222 100644\n--- a/f.js\n+++ b/f.js\n@@ -0,0 +1,2 @@\n+one\n+two\n@@ -9 +11 @@\n-old\n+new',
    expect: [1, 2, 11],
  },
  {
    name: 'new-file diff (mode lines, /dev/null header) parses',
    diff: 'diff --git a/n.js b/n.js\nnew file mode 100644\nindex 0000000..3333333\n--- /dev/null\n+++ b/n.js\n@@ -0,0 +1,2 @@\n+a\n+b',
    expect: [1, 2],
  },
  {
    name: 'ADDED content that looks like a diff header is not a header',
    diff: '@@ -1,1 +1,3 @@\n keep();\n+diff --git a/x b/x\n+realBlocker();',
    expect: [2, 3],
  },
  {
    name: 'rename-only diff (header, no hunks) parses to an empty set',
    diff: 'diff --git a/old.js b/new.js\nsimilarity index 100%\nrename from old.js\nrename to new.js',
    expect: [],
  },
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


// ── fixture hygiene: every test-case file must be classifiable (a .ts with
// eval would pass "clean" without ever being linted), and subdirectories are
// forbidden (the good/ readdir is not recursive) — round 13.
for (const side of ['bad', 'good']) {
  for (const entry of fs.readdirSync(path.join(CASES, side), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) { fail(`test-cases/${side}/${entry.name}: subdirectories are not scanned — flatten it`); continue; }
    if (!/\.(js|mjs|cjs|css|scss|less|html|htm)$/i.test(entry.name)) {
      fail(`test-cases/${side}/${entry.name}: extension outside the lint patterns — it would pass vacuously`);
    }
  }
}
pass('fixture hygiene: all classifiable, no subdirs');

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

// Symlinked directories are a coverage gap glob will not descend into — they
// must surface in `skipped` (round 10), not silently vanish. A symlinked FILE
// is linted like any other (pinned via the blocker in linked.js).
const symTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrt-sym-'));
const outside = path.join(symTmp, 'outside');
const srcDir = path.join(symTmp, 'src');
fs.mkdirSync(outside); fs.mkdirSync(srcDir);
fs.writeFileSync(path.join(outside, 'evil.js'), 'export const x = eval("1");\n');
fs.writeFileSync(path.join(symTmp, 'shared.js'), 'export function used() { return eval("1"); }\n');
fs.symlinkSync(outside, path.join(srcDir, 'linked-dir'));
fs.symlinkSync(path.join(symTmp, 'shared.js'), path.join(srcDir, 'linked.js'));
fs.writeFileSync(path.join(srcDir, 'app.js'), 'export const ok = 1;\n');
const symRun = runRaw([srcDir, '--rdjson']);
let symJson = null;
try { symJson = JSON.parse(symRun.stdout); } catch (e) { /* handled below */ }
const symSkipped = (symJson && symJson.skipped) || [];
if (symSkipped.some((f) => f.includes('linked-dir'))) {
  pass('symlinked directory surfaces in skipped');
} else {
  fail(`symlinked dir missing from skipped: ${JSON.stringify(symSkipped)}`);
}
// rdjson mode exits 0 on a successful run regardless of findings (the gate
// lives in the workflow) — the pin is the diagnostic itself.
if (symRun.status === 0 && symJson && symJson.diagnostics.some((d) => d.location.path.includes('linked.js'))) {
  pass('symlinked file is linted like any other');
} else {
  fail(`symlinked file not linted: status ${symRun.status}, diags=${symJson ? symJson.diagnostics.length : 'n/a'}`);
}
fs.rmSync(symTmp, { recursive: true, force: true });

// rdjson stdout must survive a pipe even past 64 KiB — process.exit() would
// truncate the async flush mid-JSON with exit 0 (round 11). execFileSync
// captures through a pipe, which is exactly the failing medium.
const bigTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrt-big-'));
const bigBody = ['export const a = 1;']
  .concat(Array.from({ length: 4000 }, (_, i) => `console.log(${i});`))
  .join('\n');
fs.writeFileSync(path.join(bigTmp, 'big.js'), bigBody + '\n');
const bigRun = runRaw([bigTmp, '--rdjson']);
let bigJson = null;
try { bigJson = JSON.parse(bigRun.stdout); } catch (e) { /* handled below */ }
if (bigRun.status === 0 && bigJson && bigJson.diagnostics.length >= 4000 && bigRun.stdout.length > 65536) {
  pass(`rdjson stdout survives a pipe past 64 KiB (${bigRun.stdout.length} bytes, ${bigJson.diagnostics.length} findings)`);
} else {
  fail(`rdjson pipe contract broken: status ${bigRun.status}, bytes ${bigRun.stdout.length}, parsed ${bigJson ? bigJson.diagnostics.length : 'INVALID JSON'}`);
}
fs.rmSync(bigTmp, { recursive: true, force: true });

// Dotted paths are never linted but must surface in skipped (round 11).
const dotTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrt-dot-'));
fs.mkdirSync(path.join(dotTmp, '.hidden'));
fs.writeFileSync(path.join(dotTmp, '.hidden', 'inner.js'), 'export const x = eval("1");\n');
fs.writeFileSync(path.join(dotTmp, 'app.js'), 'export const ok = 1;\n');
const dotRun = runRaw([dotTmp, '--rdjson']);
let dotJson = null;
try { dotJson = JSON.parse(dotRun.stdout); } catch (e) { /* handled below */ }
const dotSkipped = (dotJson && dotJson.skipped) || [];
if (dotRun.status === 0 && dotJson && dotJson.diagnostics.length === 0 && dotSkipped.some((f) => f.includes('.hidden'))) {
  pass('dotted paths surface in skipped (not linted, not silent)');
} else {
  fail(`dot contract broken: status ${dotRun.status}, skipped=${JSON.stringify(dotSkipped)}`);
}
fs.rmSync(dotTmp, { recursive: true, force: true });

// Czech-comment findings must anchor on the line WITH the diacritics, not the
// block comment's first line (round 11) — the set snapshot cannot see lines.
{
  const czechSource = fs.readFileSync(path.join(CASES, 'bad', 'bad-czech-comments.js'), 'utf8').split('\n');
  const wantLine = czechSource.findIndex((l) => l.includes('Třetí řádek')) + 1;
  const czechLines = badDiagnostics
    .filter((d) => d.code.value === 'shoptet/no-czech-comments' && d.location.path.endsWith('bad-czech-comments.js'))
    .map((d) => d.location.range.start.line);
  if (wantLine > 0 && czechLines.includes(wantLine)) {
    pass(`czech comment anchors on the diacritics line (${wantLine})`);
  } else {
    fail(`czech anchor broken: expected line ${wantLine} among [${czechLines.join(', ')}]`);
  }
}

// Single-file mode must ignore case-insensitively like the dir globs (round 11).
const distTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrt-dist-'));
fs.mkdirSync(path.join(distTmp, 'DIST'));
fs.writeFileSync(path.join(distTmp, 'DIST', 'app.js'), 'console.log(1);\n');
const distRun = runRaw([path.join(distTmp, 'DIST', 'app.js'), '--rdjson']);
let distJson = null;
try { distJson = JSON.parse(distRun.stdout); } catch (e) { /* handled below */ }
if (distRun.status === 1 && distJson && distJson.diagnostics.length === 0 && (distJson.skipped || []).length === 1) {
  pass('single-file mode ignores DIST/ case-insensitively');
} else {
  fail(`single-file case contract broken: status ${distRun.status}, diags ${distJson ? distJson.diagnostics.length : 'n/a'}`);
}
fs.rmSync(distTmp, { recursive: true, force: true });

// Warnings-only input must exit 0 in plain mode — partners' non-PR gate must
// not turn red on recommendations (round 13).
const warnTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrt-warn-'));
fs.writeFileSync(path.join(warnTmp, 'warn-only.js'), 'export const a = 1; // Poznámka s ěščř\n');
const warnRun = runRaw([warnTmp]);
if (warnRun.status === 0) pass('plain mode exits 0 on warnings-only input');
else fail(`warnings-only plain run exited ${warnRun.status}`);
fs.rmSync(warnTmp, { recursive: true, force: true });

// Single-file happy path: a clean file passed directly exits 0.
const oneOk = runRaw(['test-cases/good/good-rest-omission.js']);
if (oneOk.status === 0) pass('single-file mode exits 0 on a clean file');
else fail(`single-file clean run exited ${oneOk.status}`);

// Unsupported single-file type: exit 1 + valid JSON (fail() variant).
const xyzTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrt-xyz-'));
fs.writeFileSync(path.join(xyzTmp, 'data.xyz'), 'whatever');
const xyzRun = runRaw([path.join(xyzTmp, 'data.xyz'), '--rdjson']);
let xyzJson = null;
try { xyzJson = JSON.parse(xyzRun.stdout); } catch (e) { /* handled below */ }
if (xyzRun.status === 1 && xyzJson && xyzJson.diagnostics.length === 0) pass('unsupported file type: exit 1 + valid JSON');
else fail(`unsupported-type contract broken: status ${xyzRun.status}`);
fs.rmSync(xyzTmp, { recursive: true, force: true });

// Foreign source extensions surface in skipped — not silently invisible (round 13).
const tsTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrt-ts-'));
fs.writeFileSync(path.join(tsTmp, 'typed.ts'), 'export const x = eval("1");\n');
fs.writeFileSync(path.join(tsTmp, 'app.js'), 'export const ok = 1;\n');
const tsRun = runRaw([tsTmp, '--rdjson']);
let tsJson = null;
try { tsJson = JSON.parse(tsRun.stdout); } catch (e) { /* handled below */ }
if (tsRun.status === 0 && tsJson && (tsJson.skipped || []).some((f) => f.endsWith('typed.ts'))) {
  pass('foreign source extension (.ts) surfaces in skipped');
} else {
  fail(`.ts contract broken: status ${tsRun.status}, skipped=${JSON.stringify(tsJson && tsJson.skipped)}`);
}
fs.rmSync(tsTmp, { recursive: true, force: true });

// Messages are bounded — a 70k-char identifier must not produce a comment-
// killing 70k message (round 13).
const longTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lrt-long-'));
fs.writeFileSync(path.join(longTmp, 'long.js'), 'export {};\nconst x' + 'y'.repeat(70000) + ' = 1;\n');
const longRun = runRaw([longTmp, '--rdjson']);
let longJson = null;
try { longJson = JSON.parse(longRun.stdout); } catch (e) { /* handled below */ }
const maxLen = longJson ? Math.max(...longJson.diagnostics.map((d) => d.message.length), 0) : -1;
if (maxLen > 0 && maxLen <= 1020) pass(`finding messages are bounded (max ${maxLen} chars)`);
else fail(`message bound broken: max ${maxLen}`);
fs.rmSync(longTmp, { recursive: true, force: true });

console.log(failures ? `\n${failures} failure(s).` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
