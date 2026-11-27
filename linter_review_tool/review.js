const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const { lintJavaScript } = require('./linters/eslint-linter');
const { lintStyles } = require('./linters/stylelint-linter');
const { lintHtml } = require('./linters/html-linter');
const { isReliable } = require('./profiles');
const { moduleSpecifiers } = require('@shoptet/addon-eslint-config');
const { verifyThirdParty } = require('./lib/third-party');

// TypeScript and JSX are linted by the same ESLint pass (the shared config's
// typescript-eslint block); `.d.ts` declaration files carry no runtime code and
// are skipped — visibly, via IGNORE below.
const JS_EXTENSIONS = ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'mts', 'cts'];

const PATTERNS = {
  js: `**/*.{${JS_EXTENSIONS.join(',')}}`,
  styles: '**/*.{css,scss,less}',
  html: '**/*.{html,htm}',
};

// Skip minified/generated files and vendored dependencies — reviewing them is
// noise (they are not the author's source). This is a naming-convention blind
// spot by design; skipped files are reported in the output (and surfaced in the
// CI run Summary) so partial coverage is visible, and it is documented in the
// README known limitations.
const IGNORED_MIN_EXTENSIONS = [...JS_EXTENSIONS, 'css', 'scss', 'less', 'html', 'htm'].join(',');
const IGNORE = [
  `**/*.min.{${IGNORED_MIN_EXTENSIONS}}`,
  `**/*.bundle.{${IGNORED_MIN_EXTENSIONS}}`,
  // TypeScript declaration files: types only, nothing that runs.
  '**/*.d.{ts,mts,cts}',
  // Test files: they never ship, and test code does on purpose what addon code
  // must not (mocking `window.shoptet`, asserting on 'javascript:' URLs,
  // selecting test fixtures by data-testid). Only the unambiguous conventions
  // of jest/vitest — a plain `test/` or `tests/` directory is NOT skipped, a
  // partner may name a feature folder that way (CZ3TDR1-978).
  `**/*.test.{${JS_EXTENSIONS.join(',')}}`,
  `**/*.spec.{${JS_EXTENSIONS.join(',')}}`,
  // Cypress specs and jest fixtures: the same unambiguous test conventions.
  `**/*.cy.{${JS_EXTENSIONS.join(',')}}`,
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/__fixtures__/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/vendor/**',
];

async function collect(targetPath, pattern) {
  // nocase: uppercase extensions (Foo.JS) must not silently escape the linter
  // on the case-sensitive CI filesystem (isIgnoredPath is case-insensitive too).
  return glob(pattern, {
    nodir: true,
    cwd: targetPath,
    absolute: true,
    ignore: IGNORE,
    nocase: true,
  });
}

/** Does a path match the IGNORE conventions? (single-file mode + skip listing) */
function isIgnoredPath(filePath) {
  // /i on BOTH halves — the globs collect nocase, so DIST/app.js must be
  // ignored in single-file mode exactly like dist/app.js is in dir mode.
  return (
    /(^|\/)(node_modules|dist|vendor|__tests__|__mocks__|__fixtures__)\//i.test(filePath) ||
    /\.(min|bundle)\.(js|mjs|cjs|jsx|ts|tsx|mts|cts|css|scss|less|html|htm)$/i.test(filePath) ||
    /\.d\.(ts|mts|cts)$/i.test(filePath) ||
    /\.(test|spec|cy)\.(js|mjs|cjs|jsx|ts|tsx|mts|cts)$/i.test(filePath)
  );
}

/**
 * Files matching the review patterns that the IGNORE list excludes. node_modules
 * trees are not enumerated (walking thousands of vendored files just to label
 * them "skipped" is pure cost) — dist/, vendor/ and *.min/*.bundle files are.
 */
// Source-looking extensions we do NOT lint — surfaced in `skipped` so the
// coverage gap is visible instead of silent (round 13; single-file mode
// rejects the same files loudly, dir mode must not disagree).
const FOREIGN_SOURCE_PATTERN = '**/*.{vue,svelte,coffee}';

async function collectSkipped(targetPath) {
  // The "all candidates" side includes foreign source extensions; the "kept"
  // side must NOT (they are never linted — that's what makes them skipped).
  const patterns = Object.values(PATTERNS);
  const allPatterns = patterns.concat(FOREIGN_SOURCE_PATTERN);
  // dot: true ONLY here — hidden files/dirs are never linted (tooling trees,
  // not addon source), but they must surface in `skipped` instead of vanishing
  // silently: the Summary's promise is that no coverage gap is silent (round 11).
  const [all, kept] = await Promise.all([
    Promise.all(
      allPatterns.map((p) =>
        glob(p, {
          nodir: true,
          cwd: targetPath,
          absolute: true,
          ignore: ['**/node_modules/**'],
          nocase: true,
          dot: true,
        }),
      ),
    ),
    Promise.all(patterns.map((p) => collect(targetPath, p))),
  ]);
  const keptSet = new Set(kept.flat());
  return all
    .flat()
    .filter((f) => !keptSet.has(f))
    .sort();
}

function classifyFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (JS_EXTENSIONS.includes(ext.slice(1))) return 'js';
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
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        try {
          if (fs.statSync(full).isDirectory()) found.push(full + path.sep);
        } catch {
          /* dangling symlink — nothing behind it to review */
        }
      } else if (entry.isDirectory()) {
        walk(full);
      }
    }
  };
  walk(root);
  return found;
}

// The test-file conventions of IGNORE, on their own (CZ3TDR1-980): a skipped
// file that matches ONLY these — not node_modules/dist/vendor, minified,
// declaration, hidden or foreign — is skipped because it is a test, and a test
// file that production code imports ships after all.
const TEST_DIR = /(^|\/)(__tests__|__mocks__|__fixtures__)\//i;
const TEST_FILE = /\.(test|spec|cy)\.(js|mjs|cjs|jsx|ts|tsx|mts|cts)$/i;
// Minified/bundle exactly as IGNORE matches it (`*.min.<ext>`), so
// `helper.min.test.js` — skipped as a test, not as minified — stays eligible.
const OTHER_SKIP = new RegExp(
  `(^|/)(node_modules|dist|vendor)/|\\.(min|bundle)\\.(${IGNORED_MIN_EXTENSIONS.split(',').join('|')})$|\\.d\\.(ts|mts|cts)$|(^|/)\\.[^/]`,
  'i',
);

function isSkippedOnlyAsTest(relativePath) {
  const posix = relativePath.split(path.sep).join('/');
  if (!JS_EXTENSIONS.includes(path.extname(posix).slice(1).toLowerCase())) return false;
  return (TEST_DIR.test(posix) || TEST_FILE.test(posix)) && !OTHER_SKIP.test(posix);
}

/**
 * Where a relative specifier resolves to, the way a bundler resolves it: the
 * exact file, then each JS/TS extension, a TypeScript-style `.js` → `.ts`
 * twin, then `index.*`. Returns an existing file path or null. Bare
 * specifiers (`lodash`) and aliases (`@/x`) are not resolved — a false
 * negative, documented.
 */
function resolveRelative(fromFile, specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return null;
  // A query or hash (`./snippet.js?raw`, `?url`, `?inline`) loads the file as
  // text or a URL, not as code — not followed (a false negative for the rare
  // `?worker`, never a false positive).
  if (/[?#]/.test(specifier)) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base];
  for (const ext of JS_EXTENSIONS) candidates.push(`${base}.${ext}`);
  const twin = /\.(js|jsx|mjs|cjs)$/i.exec(base);
  if (twin) {
    const stem = base.slice(0, -twin[0].length);
    const tsExt = { js: ['ts', 'tsx'], jsx: ['tsx'], mjs: ['mts'], cjs: ['cts'] }[
      twin[1].toLowerCase()
    ];
    for (const ext of tsExt) candidates.push(`${stem}.${ext}`);
  }
  for (const ext of JS_EXTENSIONS) candidates.push(path.join(base, `index.${ext}`));
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      // not there — next candidate
    }
  }
  return null;
}

/**
 * A test file that a linted file imports (directly or through other imported
 * test files) is linted after all and leaves `skipped`: it ships with the
 * code that imports it. A test file nothing imports stays skipped.
 */
// Linted files that do not ship either, so their imports must not promote a
// test file: Storybook stories and test setup files (CRA's
// `src/setupTests.js`, `vitest.setup.ts`, `jest.setup.js`). A mock that only
// such a file imports is test code. A helper in a plain `tests/` directory
// cannot be told apart from a feature folder, so it still counts (README).
const DEV_ONLY_ROOT = /\.stories\.[^/]+$|(^|\/)setup-?tests\.[^/]+$|\.setup\.[^/]+$/i;

function includeImportedTestFiles(files, targetPath) {
  const skippedTests = new Set(
    files.skipped.filter((file) => isSkippedOnlyAsTest(path.relative(targetPath, file))),
  );
  if (skippedTests.size === 0) return files;
  const promoted = new Set();
  const queue = files.js.filter(
    (file) => !DEV_ONLY_ROOT.test(path.relative(targetPath, file).split(path.sep).join('/')),
  );
  while (queue.length) {
    const file = queue.pop();
    let source;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const specifier of moduleSpecifiers(source, file)) {
      const target = resolveRelative(file, specifier);
      if (target && skippedTests.has(target) && !promoted.has(target)) {
        promoted.add(target);
        queue.push(target); // an imported mock may import another test file
      }
    }
  }
  if (promoted.size === 0) return files;
  return {
    ...files,
    js: [...files.js, ...promoted].sort(),
    skipped: files.skipped.filter((file) => !promoted.has(file)),
    importedTests: [...promoted].sort(),
  };
}

// Partner code outside `src/` (CZ3TDR1-937): with `--repo-root=<dir>`, the
// repository around the target is linted too, minus what never ships —
// everything IGNORE skips, plus build output and tooling, tests, Storybook and
// test setup files, and EVERY JS/TS file at the repository root (where build
// scripts live: webpack.config.js, Gruntfile.js, a partner's own
// proxySync.js). Outside the target, findings are NON-BLOCKING during the
// rollout (recommendations): a partner whose PR passes today is not blocked
// overnight, and a false positive there can never fail the gate.
const OUTSIDE_IGNORE = [
  ...IGNORE,
  '**/build/**',
  '**/coverage/**',
  '**/test/**',
  '**/tests/**',
  '**/cypress/**',
  '**/e2e/**',
  '**/grunt/**',
  '**/scripts/**',
  '**/*.config.*',
  '**/gruntfile.*',
  '**/gulpfile.*',
  '**/*.stories.*',
  '**/*.setup.*',
  '**/setuptests.*',
  '**/setup-tests.*',
];

// This tool's own checkout (the PR gate checks it out INTO the partner's
// workspace, as `review-tool/`) is never partner code.
const TOOL_ROOT = path.resolve(__dirname, '..');

function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function gatherOutside(repoRoot, targetPath, excludes) {
  const ignore = [...OUTSIDE_IGNORE];
  for (const dir of [targetPath, TOOL_ROOT, ...excludes]) {
    if (isInside(dir, repoRoot) && path.resolve(dir) !== path.resolve(repoRoot)) {
      const relative = path.relative(repoRoot, dir).split(path.sep).join('/');
      ignore.push(`${relative}/**`);
    }
  }
  if (isInside(repoRoot, targetPath)) return { js: [], styles: [], html: [] };
  const collectOutside = (pattern) =>
    glob(pattern, { nodir: true, cwd: repoRoot, absolute: true, ignore, nocase: true });
  const [js, styles, html] = await Promise.all([
    collectOutside(PATTERNS.js),
    collectOutside(PATTERNS.styles),
    collectOutside(PATTERNS.html),
  ]);
  const atRoot = (file) => path.dirname(file) === path.resolve(repoRoot);
  return {
    js: js.filter((file) => !atRoot(file)).sort(),
    styles: styles.sort(),
    html: html.sort(),
  };
}

/** Drop verified third-party files from a file set; returns the dropped ones. */
function withoutThirdParty(files, verified) {
  return {
    ...files,
    js: files.js.filter((file) => !verified.has(file)),
    styles: files.styles.filter((file) => !verified.has(file)),
  };
}

async function gatherFiles(targetPath, stats) {
  if (stats.isDirectory()) {
    const [js, styles, html, skipped] = await Promise.all([
      collect(targetPath, PATTERNS.js),
      collect(targetPath, PATTERNS.styles),
      collect(targetPath, PATTERNS.html),
      collectSkipped(targetPath),
    ]);
    for (const dir of collectSymlinkedDirs(targetPath)) skipped.push(dir);
    skipped.sort();
    return includeImportedTestFiles({ js, styles, html, skipped }, targetPath);
  }

  const kind = classifyFile(targetPath);
  if (!kind) return null;
  // Single-file mode honors the same IGNORE conventions as directory mode —
  // otherwise `review.js dist/app.min.js` would lint what the CI never does.
  // The conventions match the CWD-RELATIVE path (documented semantics, round
  // 14): from inside the addon tree, /dist/ segments above the tree don't
  // skip; invoked from elsewhere with an absolute path, segments of that path
  // count. Target-relative would need the addon root, which single-file mode
  // doesn't know. CI (dir mode) is unaffected either way.
  const relative = path.relative(process.cwd(), targetPath);
  if (isIgnoredPath(relative)) {
    return { js: [], styles: [], html: [], skipped: [targetPath] };
  }
  // Hidden files: dir mode never lints them (they surface in skipped) — and a
  // hidden .js passed directly would be default-ignored by ESLint, remapped to
  // a recommend, and exit 0: a fake-clean (round 13). Same routing as dir mode.
  if (
    relative
      .split(path.sep)
      .some((segment) => segment.startsWith('.') && segment !== '.' && segment !== '..')
  ) {
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
  // --repo-root=<dir>: also lint partner code outside the target, non-blocking
  // (CZ3TDR1-937). --exclude=<dir> (repeatable): never part of that scope.
  const valueOf = (flag) =>
    args.filter((arg) => arg.startsWith(`${flag}=`)).map((arg) => arg.slice(flag.length + 1));
  const repoRootArg = valueOf('--repo-root')[0];
  const excludes = valueOf('--exclude').map((dir) => path.resolve(process.cwd(), dir));

  let stats;
  try {
    stats = fs.statSync(targetPath);
  } catch (error) {
    fail(rdjson, `Path not found: ${targetPath}`);
  }

  const gathered = await gatherFiles(targetPath, stats);
  if (!gathered) {
    fail(rdjson, `Unsupported file type: ${targetPath}`);
  }
  const outsideAll =
    repoRootArg && stats.isDirectory()
      ? await gatherOutside(path.resolve(process.cwd(), repoRootArg), targetPath, excludes)
      : { js: [], styles: [], html: [] };
  // Verified third-party files are skipped in both scopes, and listed.
  const verified = await verifyThirdParty([
    ...gathered.js,
    ...gathered.styles,
    ...outsideAll.js,
    ...outsideAll.styles,
  ]);
  const files = withoutThirdParty(gathered, verified);
  const outside = withoutThirdParty(outsideAll, verified);

  const total = files.js.length + files.styles.length + files.html.length;
  if (total === 0) {
    // Fail closed either way — but say WHY: "all candidates skipped" is a very
    // different situation from "nothing matched at all".
    const message = files.skipped.length
      ? `${files.skipped.length} candidate file(s) found in ${targetPath}, but all were skipped (minified/vendored/declaration/test/foreign-source/hidden/symlinked) — nothing lintable.`
      : `No reviewable files (.js/.mjs/.cjs/.jsx/.ts/.tsx/.mts/.cts/.css/.scss/.less/.html) found in ${targetPath}`;
    fail(
      rdjson,
      message,
      files.skipped.map((f) => path.relative(process.cwd(), f)),
    );
  }

  // In rdjson mode stdout must stay pure JSON, so log to stderr.
  const info = rdjson ? console.error : console.log;
  info(
    `🔍 Reviewing ${total} file(s) in: ${targetPath} ` +
      `(js: ${files.js.length}, styles: ${files.styles.length}, html: ${files.html.length})`,
  );

  const rawFindings = [];
  try {
    const [jsFindings, styleFindings, htmlFindings] = await Promise.all([
      files.js.length ? lintJavaScript(files.js) : [],
      files.styles.length ? lintStyles(files.styles) : [],
      files.html.length ? lintHtml(files.html) : [],
    ]);
    // No spread into push(): V8's argument limit (~125k) would throw on a
    // pathological file with six-figure findings and kill the whole run (round 13).
    for (const group of [jsFindings, styleFindings, htmlFindings]) {
      for (const finding of group) rawFindings.push(finding);
    }
    const outsideTotal = outside.js.length + outside.styles.length + outside.html.length;
    if (outsideTotal) {
      info(
        `🔍 Also reviewing ${outsideTotal} file(s) outside ${path.relative(process.cwd(), targetPath) || '.'} (non-blocking) ` +
          `(js: ${outside.js.length}, styles: ${outside.styles.length}, html: ${outside.html.length})`,
      );
      const outsideGroups = await Promise.all([
        outside.js.length ? lintJavaScript(outside.js) : [],
        outside.styles.length ? lintStyles(outside.styles) : [],
        outside.html.length ? lintHtml(outside.html) : [],
      ]);
      for (const group of outsideGroups) {
        for (const finding of group) rawFindings.push({ ...finding, severity: 'recommend' });
      }
    }
  } catch (error) {
    fail(rdjson, `Review execution failed: ${error.message}`);
  }

  // Keep only reliable (near-zero-false-positive) rules — the linter is a
  // deterministic gate; heuristic/contextual checks are the AI skill's job.
  const findings = dedupe(rawFindings).filter((f) => isReliable(f.ruleId));

  const skipped = files.skipped.map((f) => path.relative(process.cwd(), f));
  const thirdParty = [...verified]
    .map(([file, library]) => ({ file: path.relative(process.cwd(), file), library }))
    .sort((a, b) => a.file.localeCompare(b.file));
  const outsideSrc = [...outside.js, ...outside.styles, ...outside.html]
    .map((f) => path.relative(process.cwd(), f))
    .sort();

  if (rdjson) {
    // A successful run: emit the diagnostics; the CI reconcile step decides the
    // PR verdict (blockers gate). process.exitCode + natural exit, NOT
    // process.exit(): exit() does not wait for a piped stdout to flush, so
    // payloads over 64 KiB would be truncated mid-JSON — with exit 0 (round 11).
    // importedTests: test files linted because production code imports them
    // (CZ3TDR1-980) — the PR gate's Summary says why they were linted.
    const importedTests = (files.importedTests || []).map((f) => path.relative(process.cwd(), f));
    // thirdParty: verified library files, not linted; outsideSrc: files linted
    // outside the target, non-blocking (CZ3TDR1-937).
    process.stdout.write(
      JSON.stringify({
        ...toRdjson(findings),
        skipped,
        importedTests,
        thirdParty,
        outsideSrc,
      }),
    );
    process.exitCode = 0;
    return;
  }

  if (files.importedTests && files.importedTests.length) {
    info(
      `ℹ️  ${files.importedTests.length} test file(s) linted because production code imports them: ${files.importedTests.map((f) => path.relative(process.cwd(), f)).join(', ')}`,
    );
  }
  if (thirdParty.length) {
    info(
      `📦 ${thirdParty.length} third-party file(s) verified by content and not linted: ${thirdParty.map((t) => `${t.file} (${t.library})`).join(', ')}`,
    );
  }
  if (skipped.length) {
    info(
      `⏭️  ${skipped.length} file(s) skipped (minified/vendored/declaration/test/foreign-source/hidden/symlinked): ${skipped.join(', ')}`,
    );
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
    process.stdout.write(
      JSON.stringify({ source: { name: SOURCE_NAME }, diagnostics: [], skipped }),
    );
  }
  console.error(`::error::${message}`);
  process.exitCode = 1;
  throw new HardFailure(message);
}

const SOURCE_NAME = 'Shoptet Addon Review';

// Comment bodies cap at 64 KiB and the whole step Summary at 1 MiB — one
// pathological identifier in a message (70k chars measured) would void a
// 25-comment chunk or the entire Summary. Bound it once, here, so every
// consumer (comments, Summary, fingerprints) inherits the limit (round 13).
const MESSAGE_LIMIT = 1000;

function boundMessage(message) {
  return message.length > MESSAGE_LIMIT
    ? `${message.slice(0, MESSAGE_LIMIT)}… [truncated]`
    : message;
}

function toRdjson(findings) {
  return {
    source: { name: SOURCE_NAME },
    diagnostics: findings.map((finding) => ({
      message: boundMessage(finding.message),
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
      `::${level} file=${relativePath},line=${finding.line},col=${finding.column},title=${title}::${message}`,
    );
  }

  if (findings.length === 0) {
    console.log('::notice title=CodeReview::✅ No issues found - code looks good!');
  } else {
    console.log(
      `::notice title=ReviewSummary::Found ${blockerCount} blocker(s) and ${recommendCount} recommendation(s)`,
    );
  }

  return { blockerCount, recommendCount };
}

main().catch((error) => {
  if (error instanceof HardFailure) return; // already reported, exitCode set
  console.error(`::error::Fatal error: ${error.message}`);
  process.exitCode = 1;
});
