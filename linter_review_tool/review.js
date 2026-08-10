const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const { lintJavaScript } = require('./linters/eslint-linter');
const { lintStyles } = require('./linters/stylelint-linter');
const { lintHtml } = require('./linters/html-linter');
const { isReliable } = require('./profiles');

const PATTERNS = {
  js: '**/*.js',
  styles: '**/*.{css,scss,less}',
  html: '**/*.{html,htm}',
};

// Skip minified/generated files and vendored dependencies — reviewing them is
// noise (they are not the author's source). This is a naming-convention blind
// spot by design; skipped files are reported in the output (and surfaced in the
// CI run Summary) so partial coverage is visible, and it is documented in the
// README known limitations.
const IGNORE = [
  '**/*.min.{js,css,scss,less}',
  '**/*.bundle.{js,css,scss,less}',
  '**/node_modules/**',
  '**/dist/**',
  '**/vendor/**',
];

async function collect(targetPath, pattern) {
  return glob(pattern, { nodir: true, cwd: targetPath, absolute: true, ignore: IGNORE });
}

/** Does a path match the IGNORE conventions? (single-file mode + skip listing) */
function isIgnoredPath(filePath) {
  return (
    /(^|\/)(node_modules|dist|vendor)\//.test(filePath) ||
    /\.(min|bundle)\.(js|css|scss|less)$/i.test(filePath)
  );
}

/**
 * Files matching the review patterns that the IGNORE list excludes. node_modules
 * trees are not enumerated (walking thousands of vendored files just to label
 * them "skipped" is pure cost) — dist/, vendor/ and *.min/*.bundle files are.
 */
async function collectSkipped(targetPath) {
  const patterns = Object.values(PATTERNS);
  const [all, kept] = await Promise.all([
    Promise.all(patterns.map((p) => glob(p, { nodir: true, cwd: targetPath, absolute: true, ignore: ['**/node_modules/**'] }))),
    Promise.all(patterns.map((p) => collect(targetPath, p))),
  ]);
  const keptSet = new Set(kept.flat());
  return all.flat().filter((f) => !keptSet.has(f)).sort();
}

function classifyFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.js') return 'js';
  if (ext === '.css' || ext === '.scss' || ext === '.less') return 'styles';
  if (ext === '.html' || ext === '.htm') return 'html';
  return null;
}

async function gatherFiles(targetPath, stats) {
  if (stats.isDirectory()) {
    const [js, styles, html, skipped] = await Promise.all([
      collect(targetPath, PATTERNS.js),
      collect(targetPath, PATTERNS.styles),
      collect(targetPath, PATTERNS.html),
      collectSkipped(targetPath),
    ]);
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
    fail(rdjson, `No reviewable files (.js/.css/.scss/.html) found in ${targetPath}`);
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
    // PR verdict (blockers gate). Exit 0 so the workflow step counts as success.
    process.stdout.write(JSON.stringify({ ...toRdjson(findings), skipped }));
    process.exit(0);
  }

  if (skipped.length) {
    info(`⏭️  ${skipped.length} file(s) skipped as minified/vendored: ${skipped.join(', ')}`);
  }
  const { blockerCount } = report(findings);
  process.exit(blockerCount > 0 ? 1 : 0);
}

function fail(rdjson, message) {
  // A hard error (missing src, no reviewable files, linter crash) must NOT look
  // like a clean run — exit non-zero so the CI step fails and reconcile is
  // skipped (fail-closed), instead of being read as "0 findings" and wiping the
  // review state. Still write valid JSON to stdout for any lenient consumer.
  if (rdjson) {
    process.stdout.write(JSON.stringify({ source: { name: SOURCE_NAME }, diagnostics: [] }));
  }
  console.error(`::error::${message}`);
  process.exit(1);
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
    const key = [
      finding.file,
      finding.line,
      finding.column,
      finding.ruleId,
      finding.message,
      finding.severity,
    ].join('|');
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
  console.error(`::error::Fatal error: ${error.message}`);
  process.exit(1);
});
