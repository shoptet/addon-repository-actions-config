# Rules catalog — Shoptet addons

**`catalog_version: 2026-07-28`** — the catalog version. The catalog evolves independently of the skill; on **every substantive rule change** (adding/removing a rule, changing a severity or a Gate) bump this value (date of the last change). The agent **must copy it into the output JSON** as the top-level `catalog_version` field (see `SKILL.md`, *Output contract*), so that for every finding it is clear which version of the rules it was produced against.

> A machine-readable catalog for the review agent. It contains **only the rules (A–J, P)**. Human orientation (process, marks, checklist) → `SKILL.md` and `CONTEXT.md`.
>
> **Rules B1 / B4 / B6 require knowledge of the Shoptet environment** (dataLayer keys, always-available globals, the list of core functions). The agent gets that from the companion file **`shoptet-reference.md`**, which is handed over together with this catalog. Without it, B1/B4/B6 are systematically weak.

**Record format** — every rule has the same fields in the same order:
`ID`, `Severity`, `Owner`, `Tool`, `Gate` (conditional rules only), `Problem`, `Why`, `Solution`, `Code replacement` (optional), `Note` (optional).

- **Severity:** `❌ blocking` · `⚠️ recommended` · `💡 tip` · `❌/⚠️ conditional (see Gate)` · `⚠️/💡 (non-blocking)`
- **Owner:** `Linter` (mechanical, enforceable) · `AI` (contextual judgment) · `Both` (linter does the mechanical part, AI the context)
- **Tool:** the specific tool; `—` = none (purely AI). Tools other than ESLint are marked.
- **Gate:** a binary criterion for `❌/⚠️` rules — when it blocks and when it doesn't. Binding for the AI and for humans.
- **Code replacement:** a fenced block present = a concrete replacement → a `suggestion` can be generated from it. Without it, `Solution` is only prose advice.

---

# A. Security

### A1 — XSS / unsafe HTML insertion
- **ID:** A1
- **Severity:** ❌/⚠️ conditional (see Gate)
- **Owner:** Both
- **Tool:** `eslint-plugin-no-unsanitized`
- **Gate:** Severity scales with the **source and the attack surface** — but the finding is
  **always reported** and A1 **never drops below ⚠️ `recommended`** (no 💡, no silence). The
  Gate question (binary): *Can an untrusted actor supply the value AND does it render to
  another visitor?* YES → ❌ / NO → ⚠️. Two judgment axes:
  - **Trustworthiness of the source** — who can put malicious content into the value:
    **untrusted** = an external API, an XML/feed import, input from another user/customer;
    **semi-trusted/admin** = the e-shop's configuration, content filled in by the editors/owner
    (e.g. a product name, alt text) — they have full access to the e-shop anyway.
  - **Attack surface** — who the value executes for: **cross-user** = it renders to another
    visitor; **self-XSS** = it comes back exclusively to whoever entered it (e.g. a customer's
    own name in their client section).
  - ❌ blocking: an untrusted source **and** a cross-user surface. ⚠️ recommended (hardening):
    a semi-trusted/admin source **or** only a self-XSS surface.
  - **Conservative default:** when you're not sure where the value comes from, treat it as
    untrusted; when you can't prove it returns only to the person who entered it, treat the
    surface as cross-user → ❌. Doubt plays in favor of security.
  - It is a **judgment axis of source × surface, not a lookup table** — the examples in
    parentheses are illustrations, not a list of "safe/unsafe fields". Judge the concrete flow
    of the concrete value.
  - **The escaping requirement does not change with severity:** ⚠️ doesn't mean "don't fix it",
    it means "it doesn't block the merge". The Solution below applies to both branches alike.
- **Problem:** Data (from an API, configuration, a user) is inserted into the DOM without
  sanitization — `element.innerHTML = data`, `JSON.stringify` straight into HTML, `.replace()`
  over an HTML string.
- **Why:** An attacker can inject `<script>`/`onerror` and run foreign code on the e-shop. The
  most common blocking problem of all.
- **Solution:** For text use `textContent` instead of `innerHTML`; for HTML sanitize
  (allowlist) or build via the DOM API (`createElement`/`append`), possibly DOMPurify; use
  a builder element and insert values as text.
- **Note:** `eslint-plugin-no-unsanitized` flags `innerHTML =` and similar sinks; the AI judges
  the real risk and the quality of the sanitization.
- **Note (overlap with E1):** Building HTML by concatenation (`'<div>' + apiData + '</div>'`)
  **is not just E1** (style) — if the string contains an **unsanitized value from an API /
  configuration / user, it is A1** (severity per the Gate above). Concatenation is a typical
  XSS vector precisely because it allows no escaping. When you see `+`-built HTML with data,
  judge it as A1; don't dismiss it as cosmetic E1.

### A2 — Checking / validating input parameters
- **ID:** A2
- **Severity:** ❌/⚠️ conditional (see Gate)
- **Owner:** AI
- **Tool:** —
- **Gate:** ❌ when the unhandled input **throws an exception that interrupts the rest of the
  addon's initialization** (`x.match(…)[1]` on `null`, `.getAttribute()`/`.replace()` over
  `undefined` in the init flow) **or ends up in a sensitive context** (DOM, URL, `fetch`);
  ⚠️ only when the failure is **contained** (an internal value with no downstream code
  depending on it). Careful: **"breaking the addon" is enough — the whole e-shop doesn't have
  to crash.** A crash in an init handler after which the rest of the setup silently doesn't run
  (further `setup*` functions) is ❌ (the addon is broken), not ⚠️ — and in the summary it
  belongs **at the top of the blockers**, not in the middle of the recommendations.
  **Conditionality of the crash does not reduce severity:** "it crashes *only if* the shop
  doesn't insert the config" / "*only if* the image has no `data-src`" / "that *probably* won't
  happen" **is no reason to give ⚠️ instead of ❌**. The Gate asks about the **consequence when
  it happens** (interrupts init → ❌), not about the probability. Low probability belongs in
  `confidence`, **not** in severity — don't discount ❌ to ⚠️.
- **Problem:** A function doesn't account for an empty/missing input (`undefined`, an empty
  video, a missing URL).
- **Why:** The script crashes on the unhandled value and breaks the rest of the page.
- **Solution:** A guard at the start + default parameter values.
- **Code replacement:**
  ```js
  function createMp4Slide(url = '') {
    if (!url) return '';
    // ...
  }
  ```

### A3 — Mutating inputs / separating input from state
- **ID:** A3
- **Severity:** ❌ blocking
- **Owner:** Both
- **Tool:** ESLint `no-param-reassign`
- **Problem:** A function overwrites its input parameter; one variable serves both as user
  input and as internal state.
- **Why:** Unexpected side effects, hard to debug.
- **Solution:** A local copy (`const local = {...input}`) and separate variables for input and
  internal state.

### A4 — Sensitive data in the code
- **ID:** A4
- **Severity:** ❌ blocking
- **Owner:** Both
- **Tool:** secret-scan (gitleaks / trufflehog) — **not ESLint**
- **Problem:** A token / API key visible in production (client-side) code.
- **Why:** Anyone can read client-side code.
- **Solution:** Verify the token is allowed to be public (bound to the origin/e-shop);
  otherwise serve it from a backend with request-origin checking.
- **Note:** The secret-scan detects the token pattern; the AI judges the sensitivity.

### A5 — External links with target="_blank"
- **ID:** A5
- **Severity:** ⚠️ recommended
- **Owner:** Both
- **Tool:** runtime (htmlhint / axe over the rendered HTML) / grep
- **Problem:** A link opening a new window without `rel`.
- **Why:** The opened page can manipulate the original page via `window.opener` (reverse
  tabnabbing).
- **Solution:** Always `rel="noopener noreferrer"`.
- **Note:** Links are built as HTML strings (not JSX) → `react/jsx-no-target-blank` won't
  catch it; the mechanical part is runtime, not ESLint.

---

# B. Integration with Shoptet

### B1 — Reading data via the dataLayer / official API
- **ID:** B1
- **Severity:** ❌/⚠️ conditional (see Gate)
- **Owner:** AI
- **Tool:** —
- **Gate:** ❌ when obtaining the data depends on DOM parsing / hardcoded values that break on
  a template change (a functional risk); ⚠️ otherwise (a fallback exists, it's a minor
  simplification).
- **Problem:** The addon determines the language, page type, product code etc. its own way
  (DOM parsing, hardcoded values).
- **Why:** Custom DOM parsing breaks on a template change; the official API is stable and
  uniform.
- **Solution:** Use `getShoptetDataLayer()`; for numeric identifiers use
  `shoptet.abilities.about.id` instead of mapping from a class name.
- **Note:** The list of available keys and their availability per page type →
  `shoptet-reference.md` §1.
- **Note (what is NOT a finding):** Targeting DOM elements via **class selectors** is common in
  Shoptet addons and often the **only possible** way — the template offers no stable hook for
  most elements and `data-testid` is moreover forbidden (B7). The mere "fragility of a class
  selector" is therefore **not a finding** (not even as judgment) — don't call it out when no
  stable alternative exists. B1 applies only to **obtaining data** available via the
  dataLayer/`shoptet.abilities` (language, page type, product ID → mapping from a class name IS
  a finding here). The neighboring cases remain real too: binding to `data-testid` (B7),
  a selector reaching **outside the addon's own container** (B8), or a concretely more stable
  hook the partner bypassed.
- **Code replacement:**
  ```js
  const lang = getShoptetDataLayer('language');
  const isProduct = getShoptetDataLayer('pageType') === 'productDetail';
  const { product } = getShoptetDataLayer();
  // with variants the code lives only in codes[]; without variants product.code also exists (see shoptet-reference §1)
  const code = product?.hasVariants
    ? product.codes.map(c => c.code)
    : (product?.code ?? product?.codes?.[0]?.code);
  ```

### B2 — Breakpoints from Shoptet
- **ID:** B2
- **Severity:** ⚠️ recommended
- **Owner:** AI
- **Tool:** —
- **Problem:** Custom/random breakpoints (e.g. `550px`, `767px`) that don't match the template.
- **Why:** The addon then wraps at different points than the rest of the template —
  inconsistent behavior across devices.
- **Solution:** Read from `shoptet.config.breakpoints`, or use the official values: min-width
  xs `480` / sm `768` / md `992` / lg `1200` / xl `1440`; max-width xs `479` / sm `767` / md
  `991` / lg `1199` / xl `1439`.

### B3 — Configuration via the Shoptet API instead of generating it
- **ID:** B3
- **Severity:** ⚠️ recommended
- **Owner:** AI
- **Tool:** —
- **Problem:** The addon forces the user to generate/paste configuration manually.
- **Why:** The manual procedure is error-prone and unfriendly; via the API the settings are
  reliable and updatable.
- **Solution:** Insert the settings via the API (inline JSON into the header); the code only
  reads them.
- **Code replacement:**
  ```js
  const myAddonConfig = { eshopSpecificData: /* … */ };
  // → in the code: myAddonConfig.eshopSpecificData
  ```

### B4 — Unnecessary checks of Shoptet objects
- **ID:** B4
- **Severity:** ⚠️ recommended
- **Owner:** AI
- **Tool:** —
- **Problem:** Defensive checks on objects that are always available (`shoptet`, `screen`,
  `dataLayer`).
- **Why:** Unnecessary extra code that only hurts readability.
- **Solution:** `shoptet`, `dataLayer` and `screen` are always defined in the browser — drop
  the check.
- **Note:** The list of "always defined" Shoptet objects is the same as the declaration of
  Shoptet globals for ESLint `no-undef` in D1 — maintain it as one shared source. The concrete
  enumeration (`shoptet.*` namespaces, `dataLayer`, `getShoptetDataLayer`, jQuery) →
  `shoptet-reference.md` §2.

### B5 — Lifecycle / race conditions
- **ID:** B5
- **Severity:** ❌/⚠️ conditional (see Gate)
- **Owner:** AI
- **Tool:** —
- **Gate:** ❌ when the code genuinely depends on a `setTimeout` hack or causes concurrency
  errors / a non-idempotent re-run on AJAX updates; ⚠️ otherwise (preventive cleanup without
  a demonstrated impact).
- **Problem:** Initialization bypasses the life cycle via `setTimeout(fn, 0)`, code runs before
  the core is ready; or code bound to `ShoptetDOMContentLoaded` **is not idempotent** (it runs
  again on every AJAX update → accumulates listeners/elements). The mere combination of
  listeners on `DOMContentLoaded` + `ShoptetDOMContentLoaded` is a **correct pattern, not
  a finding** — see `shoptet-reference.md` §4.
- **Why:** Random concurrency errors; accumulation of listeners and duplicated elements after
  AJAX actions.
- **Solution:** Initialize the first load in the native `DOMContentLoaded`; for content loaded
  later via AJAX additionally `ShoptetDOMContentLoaded` — **idempotently**. Not
  `setTimeout`/polling. Specific variants: `ShoptetDOMPageContentLoaded` (pagination/filters),
  `ShoptetDOMCartContentLoaded` (cart) — see `shoptet-reference.md` §4.
- **Note (false assumption — NOT a finding):** "The global/core may be `undefined` because
  a Shoptet script hasn't finished or the scripts are ordered wrong" **is not a finding.**
  Shoptet guarantees that by the time the addon runs, the globals and core are ready
  (`shoptet`, `shoptet.*`, `getShoptetDataLayer`, `dataLayer`, `$`/`jQuery` — reference §2; the
  footer bundle runs after the core — §5). Don't propose guards against undefined and don't
  warn about script ordering. Distinguish *the global is ready* (guaranteed → an assumption,
  stay silent) from *the DOM/content isn't there yet* (real → B5). **Real B5 is introduced by
  the addon's own code:** a `setTimeout(fn,0)` hack, init at parse time instead of in
  a lifecycle event, double binding, and reading **content/DOM that only exists after an AJAX
  update event** (cart/filters/pagination — §4). Also watch the neighboring (non-B5) case:
  **dataLayer keys bound to a page type** (`product` only on `productDetail`) read elsewhere
  are a real problem — but that is **B1** (data availability), not "global undefined".

### B6 — Don't rewrite / do reuse Shoptet core
- **ID:** B6
- **Severity:** ❌/⚠️ conditional (see Gate)
- **Owner:** AI
- **Tool:** —
- **Gate:** Overlap with core (`shoptet-reference.md` §3) is a **necessary, not sufficient**
  condition. ❌ only for **obvious duplication** (the partner's version adds nothing over core)
  or an **overwrite/override of a core function**. ⚠️/❓ for a mere category overlap — the
  partner has their own slider/modal etc. but it does something extra; that does **not block**
  (many partners legitimately need a customized version).
- **Problem:** The addon writes its own implementation of something Shoptet already has, or
  directly overwrites core functions (`initColorBox`, functions from `templates-assets`).
- **Why:** It breaks on core updates; collisions with others.
- **Solution:** Use the existing solution (e.g. the `colorbox` that's already in Shoptet);
  don't overwrite core functions unless there is a genuine reason.
- **Note:** The list of functionality Shoptet already ships (and that should not be
  reimplemented) → `shoptet-reference.md` §3.

### B7 — data-testid selectors forbidden
- **ID:** B7
- **Severity:** ❌ blocking
- **Owner:** Both
- **Tool:** custom ESLint `no-restricted-syntax` / grep for `data-testid`
- **Problem:** The addon binds to `data-testid` attributes (reading or writing).
- **Why:** "We do not guarantee their stability; we may remove them from production at any
  time."
- **Solution:** Bind to regular CSS classes, not to testing attributes.
- **Note:** `no-restricted-syntax` catches static occurrences; the AI resolves dynamically
  built selectors.

### B8 — Side effects / addon isolation (JS and CSS)
- **ID:** B8
- **Severity:** ❌/⚠️ conditional (see Gate)
- **Owner:** AI
- **Tool:** —
- **Gate question (binary):** *Does the style/selector/side effect demonstrably reach outside
  the addon's own container?* YES → ❌ / NO → ⚠️ (a verified risky pattern) / ❓ (unclear
  intent). ❌ requires **evidence in the code**, not an assumption. Typically YES: a CSS rule
  on a **bare element** (`a`, `button`, `img`, `body`, `input`) or an otherwise unscoped global
  selector; `!important` on a Shoptet core/theme class; an extreme `z-index` fighting the
  header/modal; **dispatching a global event**
  (`window.dispatchEvent(new Event('resize'))` etc.) that disrupts foreign code / other addons;
  a JS listener whose **handler demonstrably reaches outside the container** (modifies foreign
  elements). Conversely, **merely listening** on `window`/`document` with a scoped handler
  (delegation with an `e.target.closest('.addon…')` filter, resize with a scoped impact)
  doesn't reach out — it is **not a finding** (the NO branch). On the NO branch pin the
  severity: **⚠️** for a verified risky pattern that demonstrably doesn't reach out (an
  unprefixed generic class that *could* collide); **❓** when the intent is unclear.
  **It is not about probability, but about evidence of reaching out** — a demonstrated leak is
  not discounted to ⚠️ by low occurrence.
- **Problem:** The addon affects elements outside itself — a selector (in CSS and in JS
  queries) hits foreign elements, a style overrides the e-shop's global/theme look, the addon
  dispatches a global event that disrupts foreign code.
- **Why:** It breaks the e-shop and other addons — with CSS it's the most common silent
  disaster (a bare `a {}` recolors the whole site, not just the addon).
- **Solution:** Narrow all selectors (CSS and JS) to the addon's own container; style only your
  own classes, not bare elements or core/theme; keep events and changes within the addon's
  scope.
- **Note (overlap with H1):** Cosmetic inconsistency (units, a redundant `z-index`) is H1
  (non-blocking). As soon as a style **demonstrably reaches outside the addon** (a bare
  element, a theme override, `!important` on core), it is not H1 — it is **B8 (severity per
  the Gate)**.

---

# C. Code structure and architecture

### C1 — Monolith → split into modules
- **ID:** C1
- **Severity:** ❌/⚠️ conditional (see Gate)
- **Owner:** Both
- **Tool:** ESLint `max-lines`, `max-lines-per-function` (the line threshold is enforced by the linter)
- **Gate:** Distinguish quality from quantity — unreviewability blocks, length doesn't.
  - ❌ blocks only for an **unreviewable monolith**: one file / one function mixes unrelated
    responsibilities (parsing + HTML generation + slider + resize…) such that the code can't
    reasonably be walked or safely changed.
  - ⚠️ for **mere length**: the file is long but the logic is cohesive and readable. Length by
    itself does not block.
  - Working threshold for ⚠️: ~400 lines per file / ~80 lines per function (indicative, not
    a hard block). Counting lines belongs to the linter via `max-lines`; the AI handles the
    qualitative monolith, not the line count.
- **Problem:** All the logic in one huge file with mixed responsibilities (typically including
  a single function hundreds of lines long).
- **Why:** Smaller, cohesive units are easier to check, maintain, and test. What blocks is the
  mixing and unreviewability, not the length as such.
- **Solution:** Split into logical ES modules by responsibility and import them into one entry
  point.

### C2 — Refactoring / smaller methods
- **ID:** C2
- **Severity:** ⚠️ recommended
- **Owner:** Both
- **Tool:** ESLint `complexity`, `max-statements`
- **Problem:** One function does too much (parsing, HTML/CSS generation, slider, resize…),
  "switch hell", complex branching.
- **Why:** Large functions with many responsibilities are hard to read, test, and debug.
- **Solution:** Cut into smaller named methods, use early returns; for many variants
  a configuration object instead of a `switch`.
- **Code replacement:**
  ```js
  async render() {
    if (!this.isValidPage()) return;
    const html = await this.fetchHtml(this.getProductCode(), this.getSettings());
    this.insert(this.getDestination(), this.wrap(html));
  }
  ```

### C3 — Duplication / DRY
- **ID:** C3
- **Severity:** ❌/⚠️ conditional (see Gate)
- **Owner:** Both
- **Tool:** jscpd / SonarJS `sonarjs/no-identical-functions` — **not core ESLint**
- **Gate:** ❌ when non-trivial logic is duplicated (risk that a fix/security patch gets
  applied in only one place); ⚠️ otherwise (minor repetition, purely cosmetic simplification).
- **Problem:** Nearly identical functions, a repeated code block, the same selector in dozens
  of places, the same condition in multiple functions.
- **Why:** A fix/change then has to be made in several places and it's easy to forget one.
- **Solution:** Unify into one function (possibly parameterized), repeated code into a helper,
  a repeated selector/value into a `const`, hoist the shared condition up.

### C4 — Nested IFs / loops
- **ID:** C4
- **Severity:** ❌ blocking
- **Owner:** Both
- **Tool:** ESLint `max-depth`, `max-nested-callbacks`
- **Problem:** Deep nesting, `.each` inside `.each`, "pyramids of doom" / callback hell.
- **Why:** Hurts readability and performance and increases the risk of errors.
- **Solution:** Flatten — `async/await`, ternaries, jQuery `filter`/`find`, early returns.

### C5 — Placement / scope / declarations
- **ID:** C5
- **Severity:** ⚠️ recommended
- **Owner:** AI
- **Tool:** —
- **Problem:** A function needlessly defined inside another, variable declarations scattered
  around, code inside a loop that doesn't belong there.
- **Why:** A needlessly large scope and scattered declarations complicate understanding the
  code flow (and code in a loop runs repeatedly for no reason).
- **Solution:** Define a function independent of inner state outside; declarations at the top
  of the function; hoist invariant code out of the loop.

### C6 — ES6 classes / object structure
- **ID:** C6
- **Severity:** ⚠️ recommended
- **Owner:** AI
- **Tool:** —
- **Problem:** A misleading "object" standing in for a class.
- **Why:** A pseudo-object obscures the real structure; a class with private methods is more
  readable and better encapsulated.
- **Solution:** Use a real ES6 class with private methods, or a plain configuration object.

---

# D. Variable scope and dependencies

### D1 — Global → block-scoped variables
- **ID:** D1
- **Severity:** ❌ blocking
- **Owner:** Linter
- **Tool:** ESLint `no-var`, `no-undef`, `no-implicit-globals`
- **Problem:** Widespread global variables, `var`.
- **Why:** Collisions with other addons and the e-shop.
- **Solution:** `const`/`let`, never `var`; add the missing declarations.
- **Note:** `no-undef` will report `getShoptetDataLayer()`, `shoptet.*` etc. as errors until
  you declare the list of Shoptet globals in the ESLint config
  (`languageOptions.globals`). Without it you get an avalanche of false positives. This list is
  one shared source for D1 (allowed globals) and B4 (always defined).

### D2 — const instead of let
- **ID:** D2
- **Severity:** ⚠️ recommended
- **Owner:** Linter
- **Tool:** ESLint `prefer-const`
- **Problem:** `let` on a value that never changes.
- **Why:** `const` signals the value doesn't change and protects against accidental
  overwriting.
- **Solution:** Whatever is never reassigned, declare as `const`.

### D3 — Passing dependencies: parameters instead of window
- **ID:** D3
- **Severity:** ⚠️ recommended
- **Owner:** AI
- **Tool:** —
- **Problem:** Values/elements are shared via `window` or a global.
- **Why:** It creates a hidden dependency and collision risk; a parameter is explicit and more
  testable.
- **Solution:** Pass them to the function as parameters; an element that was already found,
  pass along — don't look it up again.

### D4 — Namespace / prefix / collisions
- **ID:** D4
- **Severity:** ❌ blocking
- **Owner:** Both
- **Tool:** custom ESLint rule (the single allowed prefix from `package.json`)
- **Problem:** Generic names for variables, `localStorage` keys and element `id`s.
- **Why:** Crashes of other addons or the e-shop.
- **Solution:** Wrap in a namespace and give a unique prefix (e.g. `elevate_`) to variables,
  `localStorage` keys and `id`s; don't use the author's name in identifiers. The single
  allowed prefix derives from `package.json` and is enforced by the custom ESLint rule
  (deterministically); the AI judges the quality of the rest of the name.

---

# E. JavaScript — best practices

### E1 — Template literals / DOM API instead of string concatenation
- **ID:** E1
- **Severity:** ❌ blocking
- **Owner:** Both
- **Tool:** ESLint `prefer-template`
- **Problem:** HTML is built with `'<div class="' + x + '">'`.
- **Why:** Concatenation is unreadable and prone to errors and XSS.
- **Solution:** Template literals (backticks) or the DOM API; build the string and assign once,
  not repeatedly.
- **Note (overlap with A1):** When the concatenation mixes **data from an API / configuration /
  a user** into the HTML, it's not just style — it is **XSS and is handled as A1 (severity per
  the A1 Gate)**. E1 by itself is ❌ for the form; as soon as unsanitized data is in the
  string, escalate to A1.

### E2 — Modern JS
- **ID:** E2
- **Severity:** ⚠️ recommended
- **Owner:** Both
- **Tool:** ESLint plugin `eslint-plugin-unicorn`
- **Problem:** Outdated constructs (`XMLHttpRequest`, manual loops).
- **Why:** They are more verbose, harder to read, and more error-prone than the modern
  equivalents.
- **Solution:** `fetch` + `async/await`, `forEach`/`map`, `clone` where it makes sense.
- **Code replacement:**
  ```js
  async function load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }
  ```

### E3 — jQuery idioms
- **ID:** E3
- **Severity:** ⚠️ recommended
- **Owner:** AI
- **Tool:** —
- **Problem:** Repeated `$(this)`, an unnecessary `.detach()`, `filter` where `find` suffices.
- **Why:** Repeated DOM queries needlessly burden performance and hurt readability.
- **Solution:** Cache `const $this = $(this);`, use `find`, remove unnecessary calls.

### E4 — Strict equality ===
- **ID:** E4
- **Severity:** ❌ blocking
- **Owner:** Linter
- **Tool:** ESLint `eqeqeq`
- **Problem:** Loose equality `==`.
- **Why:** `==` performs implicit type conversion and leads to hard-to-spot bugs.
- **Solution:** Always `===` / `!==`.

### E5 — Debounce / throttle
- **ID:** E5
- **Severity:** 💡 tip
- **Owner:** AI
- **Tool:** —
- **Problem:** An expensive handler on a frequent event (`resize`, `scroll`).
- **Why:** The handler fires many times per second and needlessly burdens the browser (jank).
- **Solution:** Wrap in `debounce`/`throttle`.

### E6 — Event listeners
- **ID:** E6
- **Severity:** ⚠️ recommended
- **Owner:** AI
- **Tool:** —
- **Problem:** Listeners are added repeatedly without removal; an unnecessary combination of
  multiple events.
- **Why:** Unremoved listeners accumulate (memory leak, the handler firing multiple times).
- **Solution:** Remove the old listener before adding; often `click` alone suffices (it fires
  on mobile too); detect a click on an overlay directly on the overlay.
- **Code replacement:**
  ```js
  if (resizeListener) window.removeEventListener('resize', resizeListener);
  resizeListener = debounce(handleResize, 150);
  window.addEventListener('resize', resizeListener);
  ```

### E7 — localStorage in try/catch
- **ID:** E7
- **Severity:** ⚠️ recommended
- **Owner:** AI
- **Tool:** —
- **Problem:** Working with `localStorage` without handling (it can throw, be full/disabled).
- **Why:** In private mode / with a full quota, `localStorage` throws and takes down the whole
  script.
- **Solution:** Wrap in `try/catch`; don't store keys that are never read.

### E8 — Error handling / response.ok
- **ID:** E8
- **Severity:** ⚠️ recommended
- **Owner:** AI
- **Tool:** —
- **Problem:** `fetch` without a status check, missing `try/catch`.
- **Why:** Without status and error checks, `fetch` fails silently and the addon behaves
  unpredictably.
- **Solution:** Check `response.ok`, handle errors.

### E9 — Minor JS fixes / redundancies
- **ID:** E9
- **Severity:** 💡 tip
- **Owner:** Both
- **Tool:** ESLint `radix`, `no-extra-boolean-cast`
- **Problem:** `parseInt` without a radix, a redundant `.trim()` / string conversions,
  an unnecessary `> 0`, a superfluous `/gi` flag.
- **Why:** The small things don't matter alone, but together they hurt readability and
  occasionally hide a bug (e.g. `parseInt` without a radix).
- **Solution:** `parseInt(x, 10)`; remove redundancies; `/gi` is unnecessary on lowercase text.

### E10 — Magic constants
- **ID:** E10
- **Severity:** ⚠️ recommended
- **Owner:** Both
- **Tool:** ESLint `no-magic-numbers`
- **Problem:** Hardcoded numbers (`3600000`), URLs, template names, HTTP statuses in the code.
- **Why:** Unnamed values are unintelligible and on a change must be hunted down across the
  whole codebase.
- **Solution:** Extract into named constants / configuration.
- **Note:** `no-magic-numbers` flags candidates; the AI decides what is truly "magic".

### E11 — Consistency / naming
- **ID:** E11
- **Severity:** 💡 tip
- **Owner:** AI
- **Tool:** —
- **Problem:** Inconsistent values (`Math.min(3` vs. a different one elsewhere), misleading
  function names (a `render` that renders nothing), an `element` parameter that is actually
  a selector.
- **Why:** Misleading names and inconsistencies confuse and raise the risk of errors during
  changes.
- **Solution:** Unify the values; let names match what the function/parameter does
  (`shouldRender`, `selector`).

---

# F. Production code cleanliness

### F1 — Remove commented-out code
- **ID:** F1
- **Severity:** ❌ blocking
- **Owner:** Both
- **Tool:** SonarJS `sonarjs/no-commented-code` (plugin)
- **Problem:** Commented-out code blocks in production.
- **Why:** Dead code confuses the reader, needlessly bloats the file, and nobody knows if it
  still holds.
- **Solution:** Delete it. History lives in git.

### F2 — Unused / dead code and files
- **ID:** F2
- **Severity:** ❌ blocking
- **Owner:** Both
- **Tool:** ESLint `no-unused-vars` (variables) + knip / ts-prune (files)
- **Problem:** Unused variables (an `index` that is never read), unbuilt files, unneeded
  folders.
- **Why:** Increases code size and maintenance and invites mistakes (what is used and what
  isn't).
- **Solution:** Remove everything that isn't used.

### F3 — console.log / debug in production
- **ID:** F3
- **Severity:** ❌/⚠️ conditional (see Gate)
- **Owner:** Linter
- **Tool:** ESLint `no-console`
- **Gate:** ❌ when `console`/debug makes it into the production build; ⚠️ only for dev tools
  cleanly isolated behind a `dev` ENV (they don't reach production).
- **Problem:** Console output, debug methods (200+ lines the client never uses).
- **Why:** They burden the end user's console and browser performance and can leak internal
  information.
- **Solution:** Remove; extract debug tools into a module enabled only under a `dev` ENV (the
  production build runs with `production`).

### F4 — Error logging via Sentry
- **ID:** F4
- **Severity:** ⚠️ recommended
- **Owner:** AI
- **Tool:** —
- **Problem:** Errors are logged to the end user's console.
- **Why:** You can't see the user's console — you never learn about real errors, and it burdens
  the user on top.
- **Solution:** Use a solution that doesn't burden the user — e.g. Sentry.

### F5 — Empty / dummy files, dev leftovers
- **ID:** F5
- **Severity:** ❌/⚠️ conditional (see Gate)
- **Owner:** Both
- **Tool:** CI/script (`.gitignore`, dist, empty files) — **not ESLint**
- **Gate:** ❌ when dev builds or `dist` make it into the PR/production (risk of deploying dev
  code); ⚠️ for empty/dummy files with no functional impact (cleanup).
- **Problem:** Empty files, `dist` under version control, dev builds, leftovers of local
  development (e.g. an empty leftover `yarn.lock` next to the real lockfile → see also F6).
- **Why:** They fill the repo with unneeded content, hurt clarity, and a dev build could reach
  production.
- **Solution:** Neither `dist` nor dev builds belong in a PR; switch to the production build;
  delete empty/dummy files.

### F6 — Packages / lock files
- **ID:** F6
- **Severity:** 💡 tip
- **Owner:** Both
- **Tool:** depcheck — **not ESLint**
- **Problem:** Unused npm packages; **more than one lockfile of different package managers** in
  the repo — `package-lock.json` (npm), `yarn.lock` (yarn), `pnpm-lock.yaml` (pnpm),
  `bun.lockb`/`bun.lock` (bun). **Even an empty / leftover lockfile** of another manager
  counts, not just the npm+yarn pair.
- **Why:** Two lockfiles lead to inconsistent installs; and tools/CI/`corepack` pick the
  manager by the **presence** of the file — so even an empty `yarn.lock` next to
  `pnpm-lock.yaml` can redirect the build to the wrong manager. Unused packages needlessly
  bloat the dependencies.
- **Solution:** Keep the lockfile of **one** manager; delete the others (even empty ones).
  Remove unused dependencies. An empty lockfile is also an empty file → run it through the F5
  lens too.

---

# G. Build, tooling and files

### G1 — Minification
- **ID:** G1
- **Severity:** ❌ blocking
- **Owner:** Both
- **Tool:** CI/build output check — **not ESLint**
- **Problem:** The production code is not minified (even when the step's name promises it).
- **Why:** The user downloads needlessly large code.
- **Solution:** Turn on real minification, or use the build step from the boilerplate.

### G2 — Build / webpack / vendor
- **ID:** G2
- **Severity:** ⚠️ recommended
- **Owner:** AI
- **Tool:** —
- **Problem:** Third-party libraries (Fancybox, Splide) mixed with the addon's own code; an
  obfuscator despite the exempted function names.
- **Why:** Mixed-in vendor code prevents caching and tree-shaking and complicates reviewing the
  own code.
- **Solution:** Vendor libraries into separate files; `DefinePlugin` for dev/prod switching;
  keep tree-shaking in mind.

### G3 — ES modules / an order-independent build
- **ID:** G3
- **Severity:** ❌ blocking
- **Owner:** AI
- **Tool:** —
- **Problem:** The build depends on file names and ordering (e.g. `01-settings.js`, `02-…`);
  SCSS pulls in partials and index files twice.
- **Why:** Order dependence is fragile — renaming or adding a file breaks the build.
- **Solution:** Rewrite to `import`/ES modules — the init function is called explicitly, not
  via ordering or `window`; unify the SCSS imports.

### G4 — CI workflow / branch configuration
- **ID:** G4
- **Severity:** ❌ blocking
- **Owner:** Both
- **Tool:** actionlint / CI validation — **not ESLint**
- **Problem:** A missing/misconfigured GitHub workflow file for deploy; the repo has `master`
  but the configuration only expects `main`.
- **Why:** Without correct configuration the addon won't deploy (the deploy runs only from the
  expected branch).
- **Solution:** Add the workflow file; add both `master` and `main` to the configuration; the
  deploy runs via Actions from the main branch.

### G5 — Assets / fonts / CDN / images
- **ID:** G5
- **Severity:** ⚠️ recommended
- **Owner:** Both
- **Tool:** stylelint (CSS `url()`) + a custom grep for absolute URLs
- **Problem:** Absolute URLs to the developer's CDN (`$asset`), fonts/images outside the
  assets, missing image attributes.
- **Why:** A foreign CDN is outside Shoptet's control (availability, security, GDPR) and can
  drop out at any time.
- **Solution:** Keep files among the assets, not on a foreign CDN; add `srcset`/`poster` where
  it makes sense.

### G6 — Cache / performance
- **ID:** G6
- **Severity:** ⚠️ recommended
- **Owner:** AI
- **Tool:** —
- **Problem:** Requesting images/banners that are not cached; bypassing style caching; `find`
  inside `map` over a large item count (a cart can hold tens of thousands).
- **Why:** Unnecessary requests and cache bypasses slow down the e-shop; on large collections
  it noticeably burdens the browser.
- **Solution:** Don't request uncached resources, don't bypass the cache, optimize lookups in
  large collections.

---

# H. CSS / visuals

> **How to walk CSS/SCSS** (so the "H" cell in the matrix isn't just a glance). For every style
> file walk these axes:
> - **Isolation** — does the selector/style reach outside the addon's container? Bare elements
>   (`a`, `button`, `img`), `!important` on core/theme, overriding global styles → **B8**
>   (blocking per the Gate), not H1.
> - **z-index** — an extreme (`99999`) fighting the header/modal → **B8**; a redundant z-index
>   on multiple classes → H1.
> - **Breakpoints** — media queries **outside** the Shoptet breakpoints → **B2**.
> - **Units / inline styles / deprecated / font size** → H1 / H2 / H3.
>
> **Mechanical things** (units, deprecated, part of specificity) are collected by
> **stylelint** — once it runs, don't report them manually (same as with ESLint); until then
> the CSS lint layer is degraded.
>
> **The static ceiling:** whether it *looks* right, responsiveness, overflow, stacking in
> context — static reading can't see that (the same ceiling as accessibility J = axe runtime).
> These visual defects are a **runtime matter for later** (screenshot/browser diff), not a gap
> in the catalog. So after a **thorough** static pass don't mark a CSS file with a plain `ok` —
> but not `❓ shallowly reviewed` either (that's a different thing: a lack of walking, see
> `SKILL.md` › step 4, removable by another pass). Use **`statically ok, runtime unverified`**
> — making it visible that visuals/responsiveness await runtime, not that you skimped on the
> pass (no further static pass removes this ceiling).

### H1 — CSS units, z-index, media queries, styles
- **ID:** H1
- **Severity:** ⚠️/💡 (non-blocking)
- **Owner:** Both
- **Tool:** stylelint — **not ESLint**
- **Problem:** `pt` instead of `px`, a redundant `z-index` on multiple classes, `width` on
  `display:none`.
- **Why:** Inconsistent units and style habits hurt the addon's maintainability and visual
  consistency.
- **Solution:** Consistent `px`; `z-index` only where needed; solve part of the logic with
  a CSS class instead of inline styles.
- **Note (overlap with B8):** "Overriding global styles" does **not** belong here as
  cosmetics — when a style demonstrably reaches outside the addon (a bare element, a theme
  override, `!important` on core), it is **B8 (isolation, blocking per the Gate)**, not H1. H1
  is only visual consistency inside the addon.

### H2 — Deprecated HTML/CSS
- **ID:** H2
- **Severity:** ⚠️ recommended
- **Owner:** Linter
- **Tool:** stylelint / htmlhint — **not ESLint**
- **Problem:** Deprecated tags (`<big>`).
- **Why:** Browsers may stop supporting deprecated tags and they aren't semantic.
- **Solution:** Replace with a class (`<span class="text-lg">`).

### H3 — Font size
- **ID:** H3
- **Severity:** 💡 tip
- **Owner:** AI
- **Tool:** —
- **Problem:** Too-small text (11px).
- **Why:** Hard to read and hurts accessibility.
- **Solution:** Keep in mind that Shoptet scales font sizes up — hold a readable minimum.

---

# I. Localization and naming

### I1 — Comments and identifiers in English
- **ID:** I1
- **Severity:** ❌ blocking
- **Owner:** AI
- **Tool:** —
- **Problem:** Czech/Slovak in comments and names.
- **Why:** The code is also read by developers who don't speak Czech; English is the standard
  convention and eases maintenance.
- **Solution:** All comments and identifiers in English. Careful: sometimes the Czech comments
  are misleading on top (describing variables that don't exist).

### I2 — Translations / language mutations
- **ID:** I2
- **Severity:** ❌/⚠️ conditional (see Gate)
- **Owner:** AI
- **Tool:** —
- **Gate:** ❌ when the addon is meant to be multilingual and the content makes that
  impossible, or a wrong ISO code breaks functionality; ⚠️ for a single-language addon
  (separating translations is then a recommendation).
- **Problem:** Texts hardwired in the code, a single language only, wrong ISO codes.
- **Why:** Hardwired texts make multilingual support impossible and mix content with logic
  (every text change = a code change).
- **Solution:** Translations into a separate file (separate content from logic), plan for
  multilingual support, correct ISO codes (Slovenia = `sl`); add the missing translated texts
  (including in `aria-label`).

### I3 — Naming conventions + meaningful names
- **ID:** I3
- **Severity:** ⚠️ recommended
- **Owner:** Both
- **Tool:** ESLint `id-length`, `camelcase` (style/length)
- **Problem:** Say-nothing names (`x`, `v`, `m`, `cnt`, `ifr`), snake_case in JS, needless
  prefixes/suffixes (`prw`), the author's name in identifiers.
- **Why:** Say-nothing names force the reader to hunt for the meaning and raise the error rate
  during changes.
- **Solution:** Meaningful names (`activeVideo`, `currentContent`, `imageMap`), camelCase,
  prefixes only where needed (namespace), don't use the author's name.
- **Note:** `id-length`/`camelcase` catch length and style; meaningfulness is judged by the AI.

### I4 — Price / number format
- **ID:** I4
- **Severity:** ❌/⚠️ conditional (see Gate)
- **Owner:** AI
- **Tool:** —
- **Gate:** ❌ when wrong parsing leads to a wrong amount / broken functionality; ⚠️ for purely
  cosmetic formatting with no impact on the computation.
- **Problem:** Price parsing assumes a single format.
- **Why:** International formats (`1.234,50`, `1,234.50$`, `1 500 Kč`) break it.
- **Solution:** Take the formatting from the e-shop / parse robustly across formats.

---

# J. Accessibility

### J1 — Semantic tags
- **ID:** J1
- **Severity:** ❌/⚠️ conditional (see Gate)
- **Owner:** Both
- **Tool:** runtime (axe over the rendered DOM, out of scope for now)
- **Gate:** ❌ when an interactive element is inaccessible (a clickable `<div>` without
  a role/keyboard support = a WCAG violation); ⚠️ for a purely semantic improvement (`<h4>`
  instead of `<div>`) with no impact on operation.
- **Problem:** A clickable `<div>` instead of `<button>`, a visual heading as a `<div>` instead
  of `<h4>`, an empty `<div>` without role/tabindex/aria.
- **Why:** Without semantic tags, neither a screen reader nor a keyboard recognizes the
  element — inaccessible and worse SEO.
- **Solution:** An action = `<button>`; a heading = `<hX>` (screen readers see the structure);
  an interactive element must have a role/tabindex/aria.
- **Note:** The AI makes a static best effort; `eslint-plugin-jsx-a11y` won't work on HTML
  strings; in reality axe runtime over the rendered DOM.

### J2 — Screen readers / aria / WCAG
- **ID:** J2
- **Severity:** ❌/⚠️ conditional (see Gate)
- **Owner:** Both
- **Tool:** runtime (axe over the rendered DOM, out of scope for now)
- **Gate:** ❌ when information or an operation is not available to screen readers/keyboard at
  all (a WCAG level A violation — e.g. autoplay without pause, critical information only
  visual); ⚠️ for minor aria/label improvements.
- **Problem:** Information only visual (unicode stars), a missing `aria-label`, autoplay
  without pause.
- **Why:** Screen-reader users otherwise can't reach the information (e.g. a rating) or operate
  the element (autoplay).
- **Solution:** Hidden text for screen readers (`sr-only`) with the numeric value;
  an `aria-label` with a translation; for autoplay a visually hidden pause button (WCAG 2.2.2,
  technique G4); `onblur` validation is not accessible, and don't disable the submit.
- **Note:** Axe runtime reveals missing `aria-label`s, contrast etc.; the AI makes a static
  best effort and part of it can't be caught from a static HTML string.

# P. Privacy / GDPR

### P1 — Cookie consent for tracking / analytics
- **ID:** P1
- **Severity:** ❌/⚠️ conditional (see Gate)
- **Owner:** AI
- **Tool:** —
- **Gate:** Gate question (binary): *Does the addon store or send visitor data for
  analytics/marketing purposes without verifying consent via `shoptet.consent`?* YES → ❌ /
  NO → ⚠️ or nothing (see the branches). The axis is the **purpose of the storage/sending**:
  - **Analytics/marketing** = a persistent visitor identifier (a UUID in localStorage/cookie),
    collecting visited URLs / the referrer, sending behavioral events to an external API,
    pixels. With no consent check at all → ❌. A check exists but is leaky (only once at init
    with no re-check in `onAccept`; consent revocation isn't verified per event) → ⚠️.
  - **Technically necessary** = storage required for the addon's own function (widget state,
    cart contents, configuration cache) **without identifying the visitor** — outside the rule,
    not reported.
  - **Conservative default:** when you can't demonstrate that the storage is technically
    necessary (a visitor identifier is stored and data goes somewhere), treat the purpose as
    analytical → the gate applies. Doubt plays in favor of privacy.
- **Problem:** The addon creates a persistent visitor identifier or sends tracking data
  (visited URLs, referrer, behavioral events) to an external API without verifying cookie
  consent via `shoptet.consent`.
- **Why:** Shoptet **explicitly requires** addons to run analytics/marketing cookies (and
  equivalent localStorage tracking) only with the visitor's consent — see the
  [official documentation](https://developers.shoptet.com/3rd-party-marketing-and-analytics-cookies-in-add-ons/).
  A violation is not style, but a breach of the platform's terms (and a GDPR/ePrivacy risk for
  the e-shop).
- **Solution:** Start tracking only after verifying consent; the `shoptet.consent` API is
  always available by the time the addon runs. For analytics
  `shoptet.config.cookiesConsentOptAnalytics` (for marketing cookies the analogous opt per the
  documentation above). Without consent don't generate an identifier, don't write tracking data
  to storage, and send nothing.
- **Code replacement:**
  ```js
  function hasAnalyticsConsent() {
    return shoptet.consent.isAccepted(shoptet.config.cookiesConsentOptAnalytics);
  }

  function startTrackingWhenConsented(startTracking) {
    if (hasAnalyticsConsent()) {
      startTracking();
      return;
    }
    shoptet.consent.onAccept(() => {
      if (hasAnalyticsConsent()) {
        startTracking();
      }
    });
  }
  ```
- **Note (three unintuitive API details):** (1) `shoptet.consent.isAccepted(...)` returns
  `true` even when the e-shop has the cookie bar disabled — no need to handle that case
  separately. (2) The `onAccept` callback fires on **every** submission of the bar, including
  a rejection — the `hasAnalyticsConsent()` check must be **inside** the callback, plus a guard
  against double starting (the user can submit the settings repeatedly). (3) Consent can later
  be **revoked** — verify on every event send (a cheap cookie read), not just once at
  initialization.
- **Note (scope):** The rule targets tracking done by **the addon's own logic** as well as the
  addon initializing third-party tools (a pixel, analytics). It does not concern storage
  without visitor identification — `localStorage` without try/catch is E7, general side
  effects are B8.
