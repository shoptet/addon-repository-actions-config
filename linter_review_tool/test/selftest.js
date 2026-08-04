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
  return JSON.parse(stdout).diagnostics;
}

function groupRulesByFile(diagnostics) {
  const byFile = new Map();
  for (const d of diagnostics) {
    // paths come back relative to cwd (linter_review_tool) → strip test-cases/
    const key = d.location.path.replace(/^test-cases\//, '');
    if (!byFile.has(key)) byFile.set(key, new Set());
    byFile.get(key).add(d.code.value);
  }
  return byFile;
}

let failures = 0;
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`); };
const pass = (msg) => console.log(`  ✓ ${msg}`);

// ── 1+3: bad fixtures — exact rule sets + completeness ──────────────────────
console.log('bad/ fixtures:');
const badFindings = groupRulesByFile(runReview('test-cases/bad'));
const badFilesOnDisk = fs.readdirSync(path.join(CASES, 'bad')).map((f) => `bad/${f}`);

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
const goodFilesOnDisk = fs.readdirSync(path.join(CASES, 'good')).map((f) => `good/${f}`);
for (const file of goodFilesOnDisk) {
  const rules = goodFindings.get(file);
  if (rules && rules.size) fail(`${file}: expected clean but got [${[...rules].sort().join(', ')}]`);
  else pass(`${file}: clean`);
}

console.log(failures ? `\n${failures} failure(s).` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
