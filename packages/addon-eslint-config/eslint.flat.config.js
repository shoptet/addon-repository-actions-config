/**
 * Flat config for the JS linter (ESLint 9/10, CommonJS on purpose — the tool
 * stays CommonJS, nothing here requires ESM).
 *
 * `eslint:recommended` is intentionally NOT spread here, and `@eslint/js` is
 * intentionally NOT required at all. That set is 61 rules on ESLint 9 but 64
 * on ESLint 10 (10 adds `no-unassigned-vars`, `no-useless-assignment`,
 * `preserve-caught-error`), and this file is also published for ESLint-10
 * consumers — a spread would silently mean two different rule sets
 * depending on which ESLint resolves it.
 *
 * `profiles.js`'s `isReliable()` is the only filter ever applied to a
 * finding before it reaches output, so a recommended rule that isn't in
 * `RELIABLE_RULES` can never surface regardless of whether it's enabled here.
 * Cross-checking `RELIABLE_RULES` against the rules already declared below
 * (which used to inherit `error` purely from `extends: 'eslint:recommended'`)
 * leaves exactly 14 core rules that need to be enumerated explicitly. That
 * enumeration is behaviourally identical to spreading recommended for
 * anything this tool can ever report, and — unlike a spread — is stable
 * across ESLint majors.
 *
 * The `shoptet` plugin IS declared here (self-contained on purpose): this
 * config is published as `@shoptet/addon-eslint-config` and consumed by
 * external runners (this repo's `linter_review_tool` and, from the next
 * slice, the `shoptet` CLI) that have no equivalent of the old in-repo
 * `new ESLint({ plugins: { shoptet: require('../rules') } })` wiring to fall
 * back on. Declaring it here is now the single source of truth for the
 * plugin — consumers must NOT also pass a `shoptet` plugin option to `ESLint`,
 * or ESLint throws "Cannot redefine plugin". The same holds for
 * `@typescript-eslint`: the TypeScript block registers its own narrowed copy
 * of that plugin, so this config cannot be combined with typescript-eslint's
 * own configs (`...tseslint.configs.recommended`) in one array.
 *
 * TypeScript / JSX (`.ts`, `.tsx`, `.mts`, `.cts`, `.jsx`) get a second block:
 * the same rules on the typescript-eslint parser (syntax only — no `tsconfig`,
 * no type information, so it stays fast and works on any repository), with
 * exactly the core rules that misread TypeScript syntax swapped for their
 * `@typescript-eslint/*` equivalents (see TYPESCRIPT_RULES below). `.jsx`
 * rides the same parser on purpose: espree's scope analysis does not count a
 * JSX use (`<Inner />`, the classic-runtime `React` import) as a reference,
 * so core no-unused-vars would report used code there.
 *
 * The TypeScript toolchain (`typescript-eslint`, `typescript`) is a hard
 * dependency of this package and is loaded with this module — also by a
 * consumer that only ever lints JavaScript.
 */

const globals = require('globals');
const tseslint = require('typescript-eslint');

const shoptetPlugin = require('./rules');
const { typescriptExtensionRules } = require('./rules/typescript-extensions');

// The typescript-eslint plugin with the three extension rules this config uses
// narrowed to the gate's bar (rules/typescript-extensions.js): they honour an
// eslint-disable naming the core id too, and no-unused-vars drops what
// TypeScript itself does not call unused. Registered under the upstream
// namespace on purpose, so rule ids stay `@typescript-eslint/…`.
const typescriptPlugin = {
  ...tseslint.plugin,
  rules: {
    ...tseslint.plugin.rules,
    ...typescriptExtensionRules(tseslint.plugin.rules),
  },
};

const LANGUAGE_GLOBALS = {
  ...globals.browser,
  ...globals.es2021,
  // Shoptet core globals — readonly, injected by the runtime.
  Shoptet: 'readonly',
  shoptet: 'readonly',
  dataLayer: 'readonly',
  screen: 'readonly',
  getShoptetDataLayer: 'readonly',
  $: 'readonly',
  jQuery: 'readonly',
};

// ESLint 9 flipped this default from off to 'warn'. A partner disabling
// no-undef (deliberately 'off' in this profile, see below) then reads as
// an "unused" disable directive — surfaced as a bogus CodeQuality finding
// (ruleId: null) that also gates as file-level. Keep the pre-9 behaviour.
const LINTER_OPTIONS = {
  reportUnusedDisableDirectives: false,
};

const javascriptConfig = {
  plugins: {
    shoptet: shoptetPlugin,
    // Registered with no rule turned on: an `eslint-disable … @typescript-eslint/…`
    // comment in a .js file (common in mixed TS/JS repositories) must resolve.
    // Unregistered, ESLint reports "Definition for rule … was not found" under
    // that id at error severity — and three of those ids are in RELIABLE_RULES,
    // so the directive itself would gate.
    '@typescript-eslint': typescriptPlugin,
  },
  // Character-class patterns (not a bare "**/*") rather than the plain
  // lowercase default: flat config would otherwise silently skip a
  // same-content file with an uppercase extension (`bad-upper.JS`) as
  // "no matching configuration" — review.js's own file discovery is
  // already case-insensitive (`nocase: true`), so the config must match
  // whatever case variant it hands over. A bare `**/*` was tried and
  // rejected: ESLint's config-array matcher treats an all-universal
  // `files` pattern as decorative and never lets it alone satisfy "this
  // file has a config" (see @eslint/config-array's `matchFound` handling),
  // so it must stay scoped to the JS-ish extensions actually handled here.
  files: ['**/*.[jJ][sS]', '**/*.[mM][jJ][sS]', '**/*.[cC][jJ][sS]'],
  linterOptions: LINTER_OPTIONS,
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: LANGUAGE_GLOBALS,
  },
  rules: {
    // ─────────────────────────────────────────────────────────────
    // eslint:recommended subset actually observable through
    // RELIABLE_RULES (see file header) — enumerated at 'error'
    // rather than inherited from a spread.
    // ─────────────────────────────────────────────────────────────
    'no-const-assign': 'error',
    'no-dupe-keys': 'error',
    'no-dupe-args': 'error',
    'no-obj-calls': 'error',
    'no-func-assign': 'error',
    'use-isnan': 'error',
    'valid-typeof': 'error',
    'no-import-assign': 'error',
    'no-class-assign': 'error',
    'getter-return': 'error',
    'no-setter-return': 'error',
    'no-dupe-else-if': 'error',
    'no-self-assign': 'error',
    'no-debugger': 'error',

    // ─────────────────────────────────────────────────────────────
    // Custom Shoptet rules (error → blocker, warn → recommendation)
    // ─────────────────────────────────────────────────────────────
    'shoptet/no-testid-selector': 'error', // B7 ❌
    'shoptet/no-settimeout-hack': 'error', // B5 ❌
    'shoptet/no-core-overwrite': 'error', // B6 ❌
    'shoptet/no-czech-comments': 'warn', // I1 ⚠️ (heuristic — reduced FP, non-gating)
    'shoptet/prefer-fetch': 'warn', // E2 ⚠️
    'shoptet/no-redundant-checks': 'warn', // B4 ⚠️

    // ─────────────────────────────────────────────────────────────
    // Security & correctness (❌)
    // ─────────────────────────────────────────────────────────────
    'no-eval': 'error', // A1
    'no-implied-eval': 'error', // A1
    'no-script-url': 'error', // A1
    'no-param-reassign': ['error', { props: false }], // A3
    // E4 ❌ — but `x == null` is the deliberate, safe nullish guard (matches
    // exactly null/undefined, no coercion surprises) and must not gate.
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'no-console': 'error', // F3
    // F3 ❌ — window./globalThis./self.console would bypass core no-console
    'shoptet/no-global-console': 'error',
    // F2 ❌ — args: 'none': callback signatures are dictated by the API, not
    // the author; an unused `event` param is not dead code (round 10).
    // ignoreRestSiblings: true — `const { password, ...safe } = user` is THE
    // idiomatic key-omission in modern ESM; the "unused" name is the point
    // (round 12).
    // caughtErrors: 'none' — ESLint 9 flipped the default of this option
    // from 'none' to 'all', which would turn every unused `catch (error)
    // {}` into a blocker; explicit here to keep the pre-9 behaviour.
    // destructuredArrayIgnorePattern: '^_' — `const [_, date, time] = match`
    // names a position the author deliberately skips; `_` is the universal
    // "unused on purpose" marker, not dead code.
    'no-unused-vars': [
      'error',
      {
        vars: 'all',
        args: 'none',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
        destructuredArrayIgnorePattern: '^_',
      },
    ],
    'no-unreachable': 'error', // F2
    // F2 ❌ — but the everyday callback idioms `cb && cb()` and
    // `cond ? a() : b()` must not gate; genuinely dead expressions still do.
    'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
    // TDZ / use-before-define (catches ReferenceError on const/let/class used early).
    // variables: false is the right cut — a reference from a NESTED scope (the
    // "function above its config" pattern) cannot throw at runtime and must not
    // gate; a genuine same-scope TDZ still does. classes: false is the same cut
    // for classes (`function fail() { throw new AppError() }` above
    // `class AppError`). Accepted false negative: a nested reference that runs
    // during module load, before the class line. allowNamedExports: true —
    // `export { helper }; const helper = …` is a live binding, read only after
    // the module has run, so it cannot hit the TDZ either.
    'no-use-before-define': [
      'error',
      { functions: false, classes: false, variables: false, allowNamedExports: true },
    ],
    'no-var': 'error', // D1
    'no-implicit-globals': 'error', // D1
    'no-redeclare': 'error', // D1

    // ─────────────────────────────────────────────────────────────
    // Structure & complexity (C — mostly ⚠️, deep nesting ❌)
    // ─────────────────────────────────────────────────────────────
    'max-depth': ['error', 4], // C4 ❌
    'max-nested-callbacks': ['error', 3], // C4 ❌
    // C1 ⚠️ per the catalog: length alone does not block — the monolith call
    // (cohesion, structure) belongs to the AI/human pass.
    'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }], // C2
    'max-statements': ['warn', 20], // C2
    complexity: ['warn', 10], // C2

    // ─────────────────────────────────────────────────────────────
    // JS best practices (E — ⚠️/💡)
    // ─────────────────────────────────────────────────────────────
    'prefer-const': 'warn', // D2
    'prefer-template': 'warn', // E1
    'no-useless-concat': 'warn', // E1
    radix: 'warn', // E9
    camelcase: ['warn', { properties: 'never' }], // I3

    // ─────────────────────────────────────────────────────────────
    // Misc safety nets
    // ─────────────────────────────────────────────────────────────
    'no-empty': 'off',
    'no-mixed-spaces-and-tabs': 'warn',
    'no-unexpected-multiline': 'off',
    // Deliberately off despite catalog D1: detection is deterministic, but a
    // positive finding is only as true as the globals list above — and the
    // Shoptet runtime injects globals (core functions, per-template) that we
    // cannot enumerate exhaustively. That breaks the zero-false-positive bar
    // required for this profile ("too many undefs" — original main).
    'no-undef': 'off',
    'no-extend-native': 'warn', // B6-ish
    // B6 ❌ — `shoptet = {}` (replacing the whole core object) must gate just
    // like overwriting a single property does (shoptet/no-core-overwrite).
    // NOTE: on ESLint 9 this also duplicates a `no-implicit-globals` finding
    // on the same line in module mode — accepted, tracked in
    // doc/plans/rule-unification/a0-baseline.md, "What the ordering slip actually cost".
    'no-global-assign': 'error',
  },
};

const JS_RULES = javascriptConfig.rules;

// Core rules that misread TypeScript syntax, each replaced by its
// typescript-eslint extension (same options, same severity — the rule-equality
// test asserts the severities match). Everything else in JS_RULES runs
// unchanged on the TypeScript AST; the shoptet/* rules look through type-only
// wrappers (`(window as any).shoptet = …`) themselves.
const TYPESCRIPT_RULES = {
  // Blind to uses in type positions (`const x: Foo`, `implements Foo`) and to
  // enum members / `declare global` augmentations. The replacement is narrowed
  // further (rules/typescript-extensions.js): a value used only in types
  // (`keyof typeof TABLE`), an unused ambient `declare`, and in .tsx/.jsx an
  // import that may be the JSX factory are not reported.
  // ignoreUsingDeclarations: a `using` / `await using` binding exists for its
  // disposal at scope exit — never read, still not dead code.
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': [
    JS_RULES['no-unused-vars'][0],
    { ...JS_RULES['no-unused-vars'][1], ignoreUsingDeclarations: true },
  ],
  // Off on TypeScript, with no replacement. Core no-redeclare reports function
  // overloads and declaration merging; the typescript-eslint extension still
  // reports the everyday value+type pair `export const Mode = {…} as const;
  // export type Mode = …` (seen on a real partner addon) — a false positive in
  // both. A genuine redeclaration (`let x` twice, two implementations of one
  // function) is a TypeScript compile error (TS2451/TS2393), so the build
  // itself already blocks it. README known limitations. (`.jsx` keeps the core
  // rule — no tsc runs there; see jsxConfig below.)
  'no-redeclare': 'off',
  // Reports types used before their declaration. Kept to the runtime TDZ cut
  // of the JS rule: types and type references can never throw (typedefs:
  // false, ignoreTypeReferences), and an enum read from a nested scope cannot
  // either (enums: false — the JS rule's `variables: false` cut for enums).
  'no-use-before-define': 'off',
  '@typescript-eslint/no-use-before-define': [
    JS_RULES['no-use-before-define'][0],
    {
      ...JS_RULES['no-use-before-define'][1],
      enums: false,
      typedefs: false,
      ignoreTypeReferences: true,
    },
  ],
  // Knows TS-only expression nodes and directives in namespaces.
  'no-unused-expressions': 'off',
  '@typescript-eslint/no-unused-expressions': JS_RULES['no-unused-expressions'],
  // Ambient names (`declare const some_global`) are dictated by the runtime,
  // not chosen by the author, and a parameter property is a class property —
  // see rules/shoptet-camelcase.js. An eslint-disable naming `camelcase`
  // still applies.
  camelcase: 'off',
  'shoptet/camelcase': JS_RULES.camelcase,
  // Core no-var reports `declare var shoptet: X` (top level, `declare module`),
  // a line that compiles to nothing — rules/shoptet-no-var.js skips ambient
  // declarations. An eslint-disable naming `no-var` still applies.
  'no-var': 'off',
  'shoptet/no-var': JS_RULES['no-var'],
  // Off on TypeScript, no replacement: core getter-return cannot see that a
  // `switch` over a union is exhaustive (or that `assertNever()` returns
  // `never`), so it reports correct getters. tsc checks it with a declared
  // return type (TS2366). Of the core rules typescript-eslint's own
  // eslint-recommended turns off on TS, this is the only one this profile
  // enables that misreported TS idioms when measured. `.jsx` keeps it.
  'getter-return': 'off',
};

const TYPESCRIPT_FILES = [
  '**/*.[tT][sS]',
  '**/*.[tT][sS][xX]',
  '**/*.[mM][tT][sS]',
  '**/*.[cC][tT][sS]',
  '**/*.[jJ][sS][xX]',
];

const typescriptConfig = {
  plugins: {
    shoptet: shoptetPlugin,
    '@typescript-eslint': typescriptPlugin,
  },
  // Same case-insensitive matching as the JS block (see the comment there).
  files: TYPESCRIPT_FILES,
  linterOptions: LINTER_OPTIONS,
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: LANGUAGE_GLOBALS,
    // Syntax only: no `project` / `tsconfig`, so no type-aware rules. JSX is
    // decided by the file extension (.tsx/.jsx) inside the parser itself.
    parser: tseslint.parser,
  },
  rules: { ...JS_RULES, ...TYPESCRIPT_RULES },
};

// `.jsx` rides the TypeScript block for its parser (JSX references), but it is
// plain JavaScript: no tsc runs, so "a redeclaration is a compile error" does
// not hold, there is no `declare`, and there are no union types to make a
// switch exhaustive. It keeps the core no-redeclare, no-var and getter-return —
// a duplicate top-level `function dup() {}` is reported, as the same code is a
// parse error in a `.js` module.
const JSX_KEEPS_CORE = ['no-redeclare', 'no-var', 'getter-return'];
const jsxConfig = {
  files: ['**/*.[jJ][sS][xX]'],
  rules: {
    ...Object.fromEntries(JSX_KEEPS_CORE.map((id) => [id, JS_RULES[id]])),
    'shoptet/no-var': 'off',
  },
};

module.exports = [javascriptConfig, typescriptConfig, jsxConfig];
