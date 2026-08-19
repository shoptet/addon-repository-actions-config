const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const { lintJavaScript } = require('./linters/eslint-linter');
const { lintStyles } = require('./linters/stylelint-linter');
const { lintHtml } = require('./linters/html-linter');
const { isReliable } = require('./profiles');

const PATTERNS = {
  js: '**/*.{js,mjs,cjs}',
  styles: '**/*.{css,scss,less}',
  html: '**/*.{html,htm}',
};

// Skip minified/generated files and vendored dependencies — reviewing them is
// noise (they are not the author's source). This is a naming-convention blind
// spot by design; skipped files are reported in the output (and surfaced in the
// CI run Summary) so partial coverage is visible, and it is documented in the
// README known limitations.
const IGNORE = [
  '**/*.min.{js,mjs,cjs,css,scss,less}',
  '**/*.bundle.{js,mjs,cjs,css,scss,less}',
  '**/node_modules/**',
  '**/dist/**',
  '**/vendor/**',
];

async function collect(targetPath, pattern) {
  // nocase: uppercase extensions (Foo.JS) must not silently escape the linter
  // on the case-sensitive CI filesystem (isIgnoredPath is case-insensitive too).
  return glob(pattern, { nodir: true, cwd: targetPath, absolute: true, ignore: IGNORE, nocase: true });
}

/** Does a path match the IGNORE conventions? (single-file mode + skip listing) */
function isIgnoredPath(filePath) {
  // /i on BOTH halves — the globs collect nocase, so DIST/app.js must be
  // ignored in single-file mode exactly like dist/app.js is in dir mode.
  return (
    /(^|\/)(node_modules|dist|vendor)\//i.test(filePath) ||
    /\.(min|bundle)\.(js|mjs|cjs|css|scss|less)$/i.test(filePath)
  );
}

/**
 * Files matching the review patterns that the IGNORE list excludes. node_modules
 * trees are not enumerated (walking thousands of vendored files just to label
 * them "skipped" is pure cost) — dist/, vendor/ and *.min/*.bundle files are.
 */
async function collectSkipped(targetPath) {
  const patterns = Object.values(PATTERNS);
  // dot: true ONLY here — hidden files/dirs are never linted (tooling trees,
  // not addon source), but they must surface in `skipped` instead of vanishing
  // silently: the Summary's promise is that no coverage gap is silent (round 11).
  const [all, kept] = await Promise.all([
    Promise.all(patterns.map((p) => glob(p, { nodir: true, cwd: targetPath, absolute: true, ignore: ['**/node_modules/**'], nocase: true, dot: true }))),
    Promise.all(patterns.map((p) => collect(targetPath, p))),
  ]);
  const keptSet = new Set(kept.flat());
  return all.flat().filter((f) => !keptSet.has(f)).sort();
}

function classifyFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return 'js';
  if (ext === '.css' || ext === '.scss' || ext === '.less') return 'styles';
  if (ext === '.html' || ext === '.htm') return 'html';
  return null;
}

/**
 * Symlinked DIRECTORIES are a coverage gap glob will not descend into (and
 * following them would escape the review tree and can loop on cycles), so they
 * are surfaced in `skipped` instead — the Summary's promise is that no
 * coverage gap is silent. Symlinked files are linted like any other file.
 */
function collectSymlinkedDirs(root) {
  const found = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        try {
          if (fs.statSync(full).isDirectory()) found.push(full + path.sep);
        } catch { /* dangling symlink — nothing behind it to review */ }
      } else if (entry.isDirectory()) {
        walk(full);
      }
    }
  };
  walk(root);
  return found;
}

async function gatherFiles(targetPath, stats) {
  if (stats.isDirectory()) {
    const [js, styles, html, skipped] = await Promise.all([
      collect(targetPath, PATTERNS.js),
      collect(targetPath, PATTERNS.styles),
      collect(targetPath, PATTERNS.html),
      collectSkipped(targetPath),
    ]);
    skipped.push(...collectSymlinkedDirs(targetPath));
    skipped.sort();
    return { js, styles, html, skipped };
  }

  const kind = classifyFile(targetPath);
  if (!kind) return null;
  // Single-file mode honors the same IGNORE conventions as directory mode —
  // otherwise `review.js dist/app.min.js` would lint what the CI never does.
  if (isIgnoredPath(targetPath)) {
    return { js: [], styles: [], html: [], skipped: [targetPath] };
  }
  return { js: [], styles: [], html: [], skipped: [], [kind]: [targetPath] };
}

async function main() {
  const args = process.argv.slice(2);
  // rdjson mode emits Diagnostic JSON on stdout (for PR comments).
  const rdjson = args.includes('--rdjson');
  const targetPathArg = args.find((arg) => !arg.startsWith('--')) || 'src';
  const targetPath = path.resolve(process.cwd(), targetPathArg);

  let stats;
  try {
    stats = fs.statSync(targetPath);
  } catch (error) {
    fail(rdjson, `Path not found: ${targetPath}`);
  }

  const files = await gatherFiles(targetPath, stats);
  if (!files) {
    fail(rdjson, `Unsupported file type: ${targetPath}`);
  }

  const total = files.js.length + files.styles.length + files.html.length;
  if (total === 0) {
    // Fail closed either way — but say WHY: "all candidates skipped" is a very
    // different situation from "nothing matched at all".
    const message = files.skipped.length
      ? `${files.skipped.length} candidate file(s) found in ${targetPath}, but all were skipped (minified/vendored/hidden/symlinked) — nothing lintable.`
      : `No reviewable files (.js/.mjs/.cjs/.css/.scss/.less/.html) found in ${targetPath}`;
    fail(rdjson, message, files.skipped.map((f) => path.relative(process.cwd(), f)));
  }

  // In rdjson mode stdout must stay pure JSON, so log to stderr.
  const info = rdjson ? console.error : console.log;
  info(
    `🔍 Reviewing ${total} file(s) in: ${targetPath} ` +
      `(js: ${files.js.length}, styles: ${files.styles.length}, html: ${files.html.length})`
  );

  const rawFindings = [];
  try {
    const [jsFindings, styleFindings, htmlFindings] = await Promise.all([
      files.js.length ? lintJavaScript(files.js) : [],
      files.styles.length ? lintStyles(files.styles) : [],
      files.html.length ? lintHtml(files.html) : [],
    ]);
    rawFindings.push(...jsFindings, ...styleFindings, ...htmlFindings);
  } catch (error) {
    fail(rdjson, `Review execution failed: ${error.message}`);
  }

  // Keep only reliable (near-zero-false-positive) rules — the linter is a
  // deterministic gate; heuristic/contextual checks are the AI skill's job.
  const findings = dedupe(rawFindings).filter((f) => isReliable(f.ruleId));

  const skipped = files.skipped.map((f) => path.relative(process.cwd(), f));

  if (rdjson) {
    // A successful run: emit the diagnostics; the CI reconcile step decides the
    // PR verdict (blockers gate). process.exitCode + natural exit, NOT
    // process.exit(): exit() does not wait for a piped stdout to flush, so
    // payloads over 64 KiB would be truncated mid-JSON — with exit 0 (round 11).
    process.stdout.write(JSON.stringify({ ...toRdjson(findings), skipped }));
    process.exitCode = 0;
    return;
  }

  if (skipped.length) {
    info(`⏭️  ${skipped.length} file(s) skipped (minified/vendored/hidden/symlinked): ${skipped.join(', ')}`);
  }
  const { blockerCount } = report(findings);
  process.exitCode = blockerCount > 0 ? 1 : 0;
}

// Sentinel for fail(): aborts main() without process.exit(), so a piped stdout
// always flushes completely (same 64 KiB concern as the success path).
class HardFailure extends Error {}

function fail(rdjson, message, skipped = []) {
  // A hard error (missing src, no reviewable files, linter crash) must NOT look
  // like a clean run — exit non-zero so the CI step fails and reconcile is
  // skipped (fail-closed), instead of being read as "0 findings" and wiping the
  // review state. Still write valid JSON to stdout for any lenient consumer,
  // including the skipped list so the "why" is machine-readable too.
  if (rdjson) {
    process.stdout.write(JSON.stringify({ source: { name: SOURCE_NAME }, diagnostics: [], skipped }));
  }
  console.error(`::error::${message}`);
  process.exitCode = 1;
  throw new HardFailure(message);
}

const SOURCE_NAME = 'Shoptet Addon Review';

function toRdjson(findings) {
  return {
    source: { name: SOURCE_NAME },
    diagnostics: findings.map((finding) => ({
      message: finding.message,
      location: {
        path: path.relative(process.cwd(), finding.file),
        range: { start: { line: finding.line, column: finding.column } },
      },
      severity: finding.severity === 'blocker' ? 'ERROR' : 'WARNING',
      code: { value: finding.ruleId },
    })),
  };
}

function dedupe(findings) {
  const seen = new Set();
  const unique = [];
  for (const finding of findings) {
    // JSON.stringify, not join('|') — same hardening as findingFingerprint:
    // a message containing the separator must never make two different
    // findings collide and silently drop one before the gate.
    const key = JSON.stringify([
      finding.file,
      finding.line,
      finding.column,
      finding.ruleId,
      finding.message,
      finding.severity,
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(finding);
  }
  return unique;
}

function report(findings) {
  let blockerCount = 0;
  let recommendCount = 0;

  for (const finding of findings) {
    const relativePath = path.relative(process.cwd(), finding.file);
    const level = finding.severity === 'blocker' ? 'error' : 'warning';
    const title = finding.ruleId || 'CodeReview';
    const message = finding.message.replace(/\r?\n/g, ' ');

    if (finding.severity === 'blocker') blockerCount++;
    else recommendCount++;

    console.log(
      `::${level} file=${relativePath},line=${finding.line},col=${finding.column},title=${title}::${message}`
    );
  }

  if (findings.length === 0) {
    console.log('::notice title=CodeReview::✅ No issues found - code looks good!');
  } else {
    console.log(
      `::notice title=ReviewSummary::Found ${blockerCount} blocker(s) and ${recommendCount} recommendation(s)`
    );
  }

  return { blockerCount, recommendCount };
}

main().catch((error) => {
  if (error instanceof HardFailure) return; // already reported, exitCode set
  console.error(`::error::Fatal error: ${error.message}`);
  process.exitCode = 1;
});
