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
 * or ESLint throws "Cannot redefine plugin".
 *
 * TypeScript / JSX (`.ts`, `.tsx`, `.mts`, `.cts`, `.jsx`) get a second block:
 * the same rules on the typescript-eslint parser (syntax only — no `tsconfig`,
 * no type information, so it stays fast and works on any repository), with
 * exactly the core rules that misread TypeScript syntax swapped for their
 * `@typescript-eslint/*` equivalents (see TYPESCRIPT_RULES below). `.jsx`
 * rides the same parser on purpose: espree's scope analysis does not count a
 * JSX use (`<Inner />`, the classic-runtime `React` import) as a reference,
 * so core no-unused-vars would report used code there.
 */

const globals = require('globals');
const tseslint = require('typescript-eslint');

const shoptetPlugin = require('./rules');
const { withoutTypeOnlyUses } = require('./rules/typescript-unused-vars');

// The typescript-eslint plugin with one rule narrowed: no-unused-vars without
// its "only used as a type" reports (see rules/typescript-unused-vars.js).
// Registered under the upstream namespace on purpose, so rule ids — and
// partners' eslint-disable comments — stay `@typescript-eslint/…`.
const typescriptPlugin = {
  ...tseslint.plugin,
  rules: {
    ...tseslint.plugin.rules,
    'no-unused-vars': withoutTypeOnlyUses(tseslint.plugin.rules['no-unused-vars']),
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
    'no-unused-vars': [
      'error',
      { vars: 'all', args: 'none', caughtErrors: 'none', ignoreRestSiblings: true },
    ],
    'no-unreachable': 'error', // F2
    // F2 ❌ — but the everyday callback idioms `cb && cb()` and
    // `cond ? a() : b()` must not gate; genuinely dead expressions still do.
    'no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
    // TDZ / use-before-define (catches ReferenceError on const/let/class used early).
    // variables: false is the right cut — a reference from a NESTED scope (the
    // "function above its config" pattern) cannot throw at runtime and must not
    // gate; a genuine same-scope TDZ still does.
    'no-use-before-define': ['error', { functions: false, classes: true, variables: false }],
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
  // further: a value used only in types (`keyof typeof TABLE`) is not reported.
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': JS_RULES['no-unused-vars'],
  // Off on TypeScript, with no replacement. Core no-redeclare reports function
  // overloads and declaration merging; the typescript-eslint extension still
  // reports the everyday value+type pair `export const Mode = {…} as const;
  // export type Mode = …` (seen on a real partner addon) — a false positive in
  // both. A genuine redeclaration (`let x` twice, two implementations of one
  // function) is a TypeScript compile error (TS2451/TS2393), so the build
  // itself already blocks it. README known limitations.
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
  // not chosen by the author — see rules/shoptet-camelcase.js.
  camelcase: 'off',
  'shoptet/camelcase': JS_RULES.camelcase,
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

// JSX files: an import used only by compiled JSX (`h` / `Fragment` for
// Preact, `jsx` for Emotion) looks unused — the JSX factory is configured in
// tsconfig/babel, which this profile never reads. typescript-eslint already
// counts the default `React` factory; these are the other common factory
// names. Exempting them can only hide a finding, never add one.
const jsxConfig = {
  files: ['**/*.[tT][sS][xX]', '**/*.[jJ][sS][xX]'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      JS_RULES['no-unused-vars'][0],
      { ...JS_RULES['no-unused-vars'][1], varsIgnorePattern: '^(h|Fragment|jsx|createElement)$' },
    ],
  },
};

module.exports = [javascriptConfig, typescriptConfig, jsxConfig];
