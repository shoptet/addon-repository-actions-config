/**
 * JavaScript linter — runs ESLint with the local Shoptet plugin and returns
 * findings in the shared review format.
 *
 * Files are parsed as ES modules (the format addon reviews assume). When a file
 * fails to parse as a module, it is re-parsed as a classic script to tell two
 * very different situations apart:
 *   - parses as a script → valid legacy JS that merely isn't a module: emit an
 *     actionable `shoptet/es-module-required` policy finding AND the full rule
 *     findings from the script run (so the author sees everything at once,
 *     not just one cryptic parse error);
 *   - fails both parses → genuinely broken JS: report the parse error itself.
 *
 * TypeScript / JSX files (`.ts`, `.tsx`, `.mts`, `.cts`, `.jsx`) are linted in
 * the same pass (the shared config's typescript-eslint block). They skip the
 * script re-parse: they are compiled before they ship, so "module vs legacy
 * script" is not a question their parse failure can answer — a fatal error
 * there is reported as the parse error itself.
 */

const fs = require('fs');
const path = require('path');
const { ESLint } = require('eslint');
const {
  configs,
  parsesAsScript,
  parsesAsJsxModule,
  jsxModuleParseError,
  globalCommentLocations,
  isRedundantGlobalReport,
} = require('@shoptet/addon-eslint-config');

const ROOT = path.join(__dirname, '..');

const TS_OR_JSX = /\.(ts|tsx|mts|cts|jsx)$/i;

// no-unused-vars under both ids: core on JS, the typescript-eslint extension
// on TS/JSX (same options, same trust filter).
const UNUSED_VARS_RULES = new Set(['no-unused-vars', '@typescript-eslint/no-unused-vars']);

// Core rules the shared config turns OFF on TypeScript/JSX because they
// misread that syntax (each replaced by a TS-aware variant, or dropped — see
// TYPESCRIPT_RULES in eslint.flat.config.js). An inline config comment
// (`/* eslint no-unused-vars: "error" */`) can switch one back on for a file,
// and it would then report TypeScript constructs it cannot read. The
// replacement already covers that code, so the core rule's reports are
// dropped on these files. `.jsx` keeps core no-redeclare and no-var.
// test/selftest.js asserts these sets equal what the config turns off.
const CORE_RULES_REPLACED_ON = {
  ts: new Set([
    'no-unused-vars',
    'no-use-before-define',
    'no-unused-expressions',
    'camelcase',
    'no-var',
    'no-redeclare',
    'getter-return',
  ]),
  jsx: new Set(['no-unused-vars', 'no-use-before-define', 'no-unused-expressions', 'camelcase']),
};

// Core rules the config replaces on EVERY extension (JS included) with a
// `shoptet/*` variant: core no-script-url reports every 'javascript:' string,
// shoptet/no-script-url only where the URL can run. Dropped for the same
// reason — only an inline config can switch them back on.
const CORE_RULES_REPLACED_EVERYWHERE = new Set(['no-script-url']);

/** The replaced-core set for a file, or null for plain JavaScript. */
function replacedCoreRules(filePath) {
  if (/\.jsx$/i.test(filePath)) return CORE_RULES_REPLACED_ON.jsx;
  if (TS_OR_JSX.test(filePath)) return CORE_RULES_REPLACED_ON.ts;
  return null;
}

// The flat config array (`configs.recommended`) already declares the
// `shoptet` plugin itself (A2 decision 2) — do NOT also pass a `plugins`
// option here, or ESLint throws "Cannot redefine plugin 'shoptet'".
//
// `overrideConfigFile: true` (rather than a path into the package, which now
// lives under node_modules) + `overrideConfig` is deliberate (A2 decision 3):
// pointing `overrideConfigFile` at a path inside a package risks ESLint
// deriving its base path from that path instead of from `cwd`, which would
// silently stop `files:` from matching and reintroduce A1's fail-green bug
// (zero findings, exit 0). Passing the config array directly sidesteps that
// entirely — `cwd` (set per call below) remains the sole basePath input.
const BASE_OPTIONS = {
  overrideConfigFile: true,
};

// In flat config, `cwd` doubles as ESLint's `basePath` — any resolved file
// outside it is silently dropped to a WARNING ("File ignored because outside
// of base path"), which the gate does not count, so a hardcoded `cwd: ROOT`
// makes every finding for a file outside the tool's own directory vanish
// (the workflow runs this tool against a sibling `src/`, which is exactly
// that case). The fix is to derive `cwd` from the common ancestor directory
// of the actual file list being linted, per run, instead of a fixed root.
//
// Realpath-vs-as-given: deliberately AS-GIVEN (path.resolve only, no
// fs.realpathSync). Measured against ESLint 9's own source (`eslint` and
// `@eslint/config-array` — neither calls `realpath` anywhere): the
// "external"/basePath check is a plain `path.relative(basePath, filePath)`
// on the paths exactly as ESLint received them, with no realpath
// normalization on either side. `os.tmpdir()` on macOS returns a symlink
// (`/var/folders/...` -> `/private/var/folders/...`): realpath-ing the
// ancestor while the files passed to `eslint.lintFiles()` stay as-given (as
// `review.js`'s glob returns them) would make `cwd` and the file paths
// disagree on which root they share, reintroducing the exact "outside of
// base path" bug this exists to fix. Keeping both sides as-given is what
// keeps them consistent.
function toResolvedDir(filePath) {
  return path.dirname(path.resolve(filePath));
}

function commonAncestorDir(filePaths) {
  if (!filePaths.length) return ROOT; // no files to lint — cwd is irrelevant, keep a sane default

  const dirs = filePaths.map(toResolvedDir);
  let common = dirs[0].split(path.sep);

  for (let i = 1; i < dirs.length; i += 1) {
    const parts = dirs[i].split(path.sep);
    let j = 0;
    while (j < common.length && j < parts.length && common[j] === parts[j]) j += 1;
    common = common.slice(0, j);
  }

  const joined = common.join(path.sep);
  // Either a single dir (no loop ran) or a multi-file list whose only shared
  // segment is the root itself (no meaningful common ancestor beyond it).
  return joined || path.parse(dirs[0]).root;
}

// no-unused-vars is only trustworthy when the author actually opted into
// module semantics: a file with no import/export statement parses as a module
// all the same, but it ships as a classic script — its top-level functions may
// be wired from HTML (onclick="…") and, through `var` hoisting, even nested
// declarations reach the shared global scope, so ESLint cannot see the callers.
// Checked on the AST, not with a regex (a comment mentioning "export" must not
// count as module syntax). Filtering the WHOLE rule (not just top-level
// declarations) is deliberate: hoisting makes "top-level" non-deterministic,
// and accepted false negatives beat false positives in this profile.
function usesModuleSyntax(filePath, filename = filePath) {
  // .mjs is a module by CONVENTION regardless of content. For everything else
  // a single script-parse decides: import/export, import.meta and top-level
  // await are all SyntaxErrors in script mode, so "cannot run as a classic
  // script" IS the module commitment (round 13 — shared with the
  // no-core-overwrite rule via script-detect.js).
  // .mts likewise. TypeScript/JSX get the AST-marker check (the filename
  // selects it inside parsesAsScript) — espree would fail on any type
  // annotation and call every .ts file a module.
  if (/\.m[jt]s$/i.test(filePath)) return true;
  try {
    return !parsesAsScript(fs.readFileSync(filePath, 'utf8'), filename);
  } catch {
    return false; // unreadable → the lint run itself will surface that
  }
}

// ESLint's report for a directive that names a rule the file's config does
// not define (`// eslint-disable-next-line react-hooks/exhaustive-deps`, or a
// runner-only id such as `shoptet/es-module-required` / `CodeQuality`). It
// carries the directive's id as its ruleId and error severity, so an id that
// happens to be in RELIABLE_RULES would gate on a comment. It is never a
// defect in the code, only in a comment ESLint could not apply — dropped.
const UNKNOWN_RULE_DIRECTIVE = /^Definition for rule '[^']+' was not found\.$/;

// `/* global $, shoptet */` naming a global the config already declares is
// only redundant — no runtime effect, nothing wrong in the code — yet core
// no-redeclare (builtinGlobals, ESLint 9 default) reports each name as
// `redeclaredAsBuiltin`, positioned INSIDE that comment. Exactly those reports
// are dropped (CZ3TDR1-979): a redeclaration in code is positioned in code, and
// `builtinGlobals` stays on. The rule id stays `no-redeclare` (a wrapper would
// have to rename it, changing every existing finding's fingerprint).
// The comments come from the parser (globalCommentLocations in the shared
// package), not from a regex over the raw text — a `/* global` inside a string
// or a line comment, or an identifier glued to the closing delimiter, must
// never hide a redeclaration in code.
function globalCommentsOf(filePath, filename = filePath) {
  try {
    return globalCommentLocations(fs.readFileSync(filePath, 'utf8'), filename);
  } catch {
    return null; // unreadable — filter nothing
  }
}

// `lintedAs` is the filename the file was linted under — the real path,
// except for a `.js` file with JSX, linted as `.jsx` (see lintJsxInJs).
function pushMessages(findings, result, lintedAs = result.filePath) {
  const replacedCore = replacedCoreRules(lintedAs);
  let globalComments; // read lazily, only when a candidate report exists
  for (const message of result.messages) {
    if (!message.fatal && UNKNOWN_RULE_DIRECTIVE.test(message.message)) continue;
    if (replacedCore && replacedCore.has(message.ruleId)) continue;
    if (CORE_RULES_REPLACED_EVERYWHERE.has(message.ruleId)) continue;
    if (message.ruleId === 'no-redeclare' && message.messageId === 'redeclaredAsBuiltin') {
      if (globalComments === undefined)
        globalComments = globalCommentsOf(result.filePath, lintedAs);
      if (globalComments && isRedundantGlobalReport(message, globalComments)) continue;
    }
    findings.push({
      file: result.filePath,
      line: message.line || 1,
      column: message.column || 1,
      message: message.message,
      ruleId: message.ruleId || 'CodeQuality',
      severity: message.severity === 2 ? 'blocker' : 'recommend',
    });
  }
}

// A `.js` / `.mjs` file that fails both plain parses (module, then script)
// because it contains JSX is linted under its `.jsx` name, through the
// config's JSX block — the same parser, rules and runner filters as a real
// `.jsx` file — and reported under its own path. Only when espree accepts it
// as a module with JSX (parsesAsJsxModule): typescript-estree would also
// accept TypeScript syntax, which must stay a parse error in a `.js` file.
// JSX is never turned on up front, so every other `.js` file is linted
// exactly as before. `.cjs` (CommonJS has no JSX build) and a classic script
// with JSX keep the parse error. Returns false when the retry does not apply.
async function lintJsxInJs(eslint, mjsEslint, filePath, findings) {
  if (!/\.m?js$/i.test(filePath)) return false;
  let source;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch {
    return false;
  }
  if (!parsesAsJsxModule(source)) return false;
  const lintedAs = filePath.replace(/\.m?js$/i, '.jsx');
  // `.mjs` is a module by its extension, and rules read that from the
  // filename (shoptet/no-core-overwrite exempts `.mjs`), so it keeps its own
  // name and gets the JSX blocks retargeted to it; a `.js` file is linted
  // under its `.jsx` name, exactly as a `.jsx` file.
  const isMjs = /\.mjs$/i.test(filePath);
  const [result] = isMjs
    ? await mjsEslint().lintText(source, { filePath })
    : await eslint.lintText(source, { filePath: lintedAs });
  if (!result || result.messages.some((m) => m.fatal)) return false;
  result.filePath = filePath;
  if (
    result.messages.some((m) => UNUSED_VARS_RULES.has(m.ruleId)) &&
    !usesModuleSyntax(filePath, lintedAs)
  ) {
    result.messages = result.messages.filter((m) => !UNUSED_VARS_RULES.has(m.ruleId));
  }
  pushMessages(findings, result, lintedAs);
  return true;
}

// A `.js` / `.mjs` file that fails every parse: when the JSX parse got to a
// later line than the plain module parse, the file is JSX broken elsewhere (a
// duplicate declaration after the JSX, say), and the plain error — on the
// first `<` — points the partner at the wrong line. Report the JSX parse's
// error instead; otherwise keep the original. The finding stays a CodeQuality
// blocker either way.
function preferJsxParseError(moduleResult) {
  if (!/\.m?js$/i.test(moduleResult.filePath)) return;
  const fatal = moduleResult.messages.find((m) => m.fatal);
  if (!fatal) return;
  let jsxError;
  try {
    jsxError = jsxModuleParseError(fs.readFileSync(moduleResult.filePath, 'utf8'));
  } catch {
    return;
  }
  if (!jsxError || !jsxError.line) return;
  // A LATER LINE only: TypeScript syntax in a `.js` file (`<any>foo`,
  // `<T,>(x) => x`) lets the JSX parse get a few columns further on the same
  // line, and its message ("Unterminated JSX contents") would talk about JSX
  // the partner never wrote.
  if (jsxError.line <= fatal.line) return;
  fatal.message = `Parsing error: ${jsxError.message}`;
  fatal.line = jsxError.line;
  fatal.column = jsxError.column;
}

// The config's JSX blocks (the TypeScript/JSX block and the `.jsx` block),
// retargeted to `.mjs` with JSX parsing on — for an `.mjs` file with JSX only
// (see lintJsxInJs). Appended to the shared array, never mutating it.
const JSX_GLOB = '**/*.[jJ][sS][xX]';
function mjsAsJsxConfig() {
  const retargeted = configs.recommended
    .filter((block) => Array.isArray(block.files) && block.files.includes(JSX_GLOB))
    .map((block) => {
      const copy = { ...block, files: ['**/*.[mM][jJ][sS]'] };
      if (block.languageOptions) {
        copy.languageOptions = {
          ...block.languageOptions,
          parserOptions: {
            ...(block.languageOptions.parserOptions || {}),
            ecmaFeatures: { jsx: true },
          },
        };
      }
      return copy;
    });
  return [...configs.recommended, ...retargeted];
}

async function lintJavaScript(files) {
  const cwd = commonAncestorDir(files);
  const eslint = new ESLint({ ...BASE_OPTIONS, cwd, overrideConfig: configs.recommended });
  const results = await eslint.lintFiles(files);
  const findings = [];
  const moduleParseFailures = [];

  for (const result of results) {
    if (result.messages.some((m) => m.fatal)) {
      if (TS_OR_JSX.test(result.filePath)) pushMessages(findings, result);
      else moduleParseFailures.push(result);
    } else {
      if (
        result.messages.some((m) => UNUSED_VARS_RULES.has(m.ruleId)) &&
        !usesModuleSyntax(result.filePath)
      ) {
        result.messages = result.messages.filter((m) => !UNUSED_VARS_RULES.has(m.ruleId));
      }
      pushMessages(findings, result);
    }
  }

  if (moduleParseFailures.length) {
    const scriptEslint = new ESLint({
      ...BASE_OPTIONS,
      cwd,
      // Append (never mutate — `configs.recommended` is a shared module-level
      // array reused by the eslint instance above) the script-mode override
      // to the same config array, mirroring the pre-A2 behaviour where this
      // override was merged on top of the file-loaded config.
      overrideConfig: [...configs.recommended, { languageOptions: { sourceType: 'script' } }],
    });

    let mjsInstance = null;
    const mjsEslint = () => {
      if (!mjsInstance) {
        mjsInstance = new ESLint({ ...BASE_OPTIONS, cwd, overrideConfig: mjsAsJsxConfig() });
      }
      return mjsInstance;
    };
    for (const moduleResult of moduleParseFailures) {
      const [scriptResult] = await scriptEslint.lintFiles([moduleResult.filePath]);
      const brokenEvenAsScript = !scriptResult || scriptResult.messages.some((m) => m.fatal);

      if (brokenEvenAsScript) {
        // JavaScript with JSX (common in Vite / CRA templates): lint it
        // exactly as the same code in a `.jsx` file (CZ3TDR1-968).
        if (await lintJsxInJs(eslint, mjsEslint, moduleResult.filePath, findings)) continue;
        preferJsxParseError(moduleResult);
        // Not a module-format issue — the file is genuinely broken JS.
        // Report the original parse error (surfaces as a CodeQuality blocker).
        pushMessages(findings, moduleResult);
        continue;
      }

      const parseError = moduleResult.messages.find((m) => m.fatal);
      findings.push({
        file: moduleResult.filePath,
        line: (parseError && parseError.line) || 1,
        column: (parseError && parseError.column) || 1,
        message:
          'This file fails to parse as an ES module (it only parses as a legacy ' +
          'script), so it was linted in script mode. Addons are reviewed as ES ' +
          'modules — please convert it to module-compatible syntax. ' +
          `(Module parse error: ${parseError ? parseError.message : 'unknown'})`,
        ruleId: 'shoptet/es-module-required',
        severity: 'blocker',
      });
      // Full findings from the script parse — the author gets the complete
      // picture in one run instead of fixing one parse error per push.
      // Except no-unused-vars: in script mode a top-level function is a global
      // whose callers (HTML onclick handlers) ESLint cannot see, so its
      // positives are not trustworthy there. The module pass keeps the rule
      // only for files that actually use module syntax (see usesModuleSyntax).
      scriptResult.messages = scriptResult.messages.filter((m) => !UNUSED_VARS_RULES.has(m.ruleId));
      pushMessages(findings, scriptResult);
    }
  }

  return findings;
}

module.exports = { lintJavaScript, CORE_RULES_REPLACED_ON, CORE_RULES_REPLACED_EVERYWHERE };
