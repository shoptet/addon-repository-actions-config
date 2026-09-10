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
 * The `shoptet` plugin is deliberately NOT declared here. It stays
 * programmatic in `linters/eslint-linter.js`'s `new ESLint({ plugins: {
 * shoptet: require('../rules') } })` option, which flat config merges into
 * every config object unchanged. Declaring it a second time here would give
 * this file two sources of truth for the same plugin; the ESLint options
 * object is the single one.
 */

const globals = require('globals');

module.exports = [
  {
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
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
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
      },
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
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
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
      'max-lines': [
        'warn',
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
      'max-lines-per-function': [
        'warn',
        { max: 50, skipBlankLines: true, skipComments: true },
      ], // C2
      'max-statements': ['warn', 20], // C2
      'complexity': ['warn', 10], // C2

      // ─────────────────────────────────────────────────────────────
      // JS best practices (E — ⚠️/💡)
      // ─────────────────────────────────────────────────────────────
      'prefer-const': 'warn', // D2
      'prefer-template': 'warn', // E1
      'no-useless-concat': 'warn', // E1
      'radix': 'warn', // E9
      'camelcase': ['warn', { properties: 'never' }], // I3

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
      // on the same line in module mode — accepted, tracked separately.
      'no-global-assign': 'error',
    },
  },
];
