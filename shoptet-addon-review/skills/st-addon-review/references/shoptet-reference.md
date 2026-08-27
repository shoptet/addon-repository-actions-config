# Shoptet reference companion — for rules B1 / B4 / B6

> **Companion to `rules-catalog.md`.** The review agent gets it together with the catalog. Without it, B1 (dataLayer), B4 (always-available globals) and B6 (don't rewrite core) are systematically weak — the agent would only recognize what's named in a rule's example.
>
> **Source and validity (provenance):**
> - **Repo:** `github.com/shoptet/templates-assets`
> - **Pin (commit):** `TODO` — the snapshot as of 2026-06-30 was taken from `@master` **without recording the hash**; on the first regeneration pin to a concrete commit and write the hash here (see *§6 Maintenance and regeneration* at the end of this file). While `TODO` is here, treat the date below as the only clue to its age.
> - **Snapshot as of:** 2026-06-30
> - **Extraction scope:** `00/js/main-3g.js` (import manifest), `00/js/modules`, `00/js/libs`, `shared/js/libs`, `dataLayerHelper.js`, `globalFunctions.js` + the dataLayer dev documentation.
> - **Templates:** `00`, `07`, `09`, `10`, `11`, `12`, `13`, `14` correspond to `shoptet.abilities.about.id`; `00` is the shared base.
>
> **Completeness:** The module/functionality inventory (§3) is, thanks to the `main-3g.js` manifest, **complete for template `00`**. In contrast, the member-level `shoptet.*` API (§2) is **still only partial** — the exact method names of the individual namespaces are not all verified. **When a specific method isn't in the list, that does not mean it doesn't exist** — verify in the repo and on developers.shoptet.com (and beware: even the official docs get things wrong — see the `product.code` case; that's why verification is done against the repo, not just the docs).

---

## 1. dataLayer — surface (for B1)

**Access:**
- `getShoptetDataLayer()` — returns the whole object
- `getShoptetDataLayer('key')` — returns a specific key
- `dataLayer[0].shoptet` — direct access
- the `ShoptetDataLayerUpdated` event (on `document`) — when the dataLayer gets updated

**Top-level keys:**

| Key | Contents | Available on |
|-----|----------|--------------|
| `pageType` | page type (`homepage`, `category`, `productDetail`, `cart`, `thankYou`) | everywhere |
| `currency` | three-letter currency code | everywhere |
| `language` | language (`cs`, `en`, `de`, …) | everywhere |
| `projectId` | e-shop identifier (max 6 digits) | everywhere |
| `cart` | array of cart items | everywhere |
| `cartInfo` | supplementary cart data (free shipping, coupons) | (context-dependent) |
| `product` | product metadata | `productDetail` only |
| `stocks` | warehouses / pickup points | `productDetail` only |
| `order` | complete order data | `thankYou` only |

**`product` (nested):** `id`, `guid`, `hasVariants`, `code` (only without variants), `codes`, `name`, `appendix`, `manufacturer`, `manufacturerGuid`, `currentCategory`, `defaultCategory`, `currency`, `priceWithVat`
> **Product code (verified on a live Shoptet 2026-07-08 — CAREFUL, the official docs have this incomplete):**
> it depends on the variants.
> - **Without variants** (`hasVariants: false`): the code is in `product.code` (a string, e.g. `"341"`)
>   and *also* in `product.codes[0].code` (but as the **number** `341`).
> - **With variants** (`hasVariants: true`): `product.code` **does not exist**; the variant codes are only
>   in `product.codes[]` (strings, e.g. `"345/FIA"`).
> Robustly: `hasVariants ? product.codes.map(c => c.code) : (product.code ?? product.codes?.[0]?.code)`.
> **Reading `product.code` on a product without variants is therefore NOT a finding** — it is correct. The official
> dataLayer documentation doesn't list `code` (singular); it's a gap in the docs, not in reality —
> don't rely on "what's not in the docs doesn't exist".
**`order` (nested):** `orderNo`, `storeName`, `total`, `totalWithoutVat`, `shipping`, `tax`, `city`, `country`, `content`, `currencyCode`, `customer`, `discountCoupons`

> **For B1:** If the partner reads anything from the above by parsing the DOM or via a hardcoded value, they should read it from the dataLayer. Numeric type identifiers → `shoptet.abilities.about.id` (not class-name mapping).
>
> **Watch the false positive (B1):** B1 is about **obtaining data**, not about targeting elements. Using **class selectors** to attach behavior/styles is common in Shoptet and often the only option (no stable hook, `data-testid` forbidden by B7) — the mere "fragility of a class selector" is **not a finding**. A finding starts at reading *data* from the DOM that lives in the dataLayer/`shoptet.abilities` (B1), binding to `data-testid` (B7), or a selector outside the addon's own container (B8).

---

## 2. Always-available globals (for B4 — and simultaneously the source for the ESLint `globals` in D1)

These objects are **always defined** in the addon's context → a defensive check (`if (typeof shoptet !== 'undefined')`) is unnecessary (B4). At the same time they must be declared in the ESLint `languageOptions.globals`, otherwise `no-undef` reports false positives (D1).

> **Watch the false positive (B5):** "always defined" also means that **`undefined` due to an unfinished / badly ordered Shoptet script is not a real risk** — Shoptet guarantees the globals and core are ready by the time the addon runs. The assumption "this could be undefined if a script hasn't finished yet" is therefore **not a finding**; don't propose guards against it. What is real is only what the addon introduces itself (a `setTimeout` hack, init outside a lifecycle event) or reading **content loaded later via AJAX** (that fact may not exist yet → attach to the right event, §4). See B5.

- **Browser standard:** `window`, `document`, `screen`, `navigator`, `location`
- **jQuery:** `$`, `jQuery` (Shoptet loads it)
- **dataLayer:** `dataLayer` (an array), `getShoptetDataLayer()`
- **`shoptet` (root)** + namespaces (below)

**Known `shoptet.*` namespaces** (a curated enumeration from `globalFunctions.js`):

| Namespace | What for (selected members) |
|-----------|------------------------------|
| `shoptet.config` | configuration — `breakpoints.{sm,…}`, `animationDuration`, `agreementCookieName/Expire`, `mobileHeaderVersion`, `thumbnailsDirection`, `cookiesConsentOptAnalytics` (the key for `shoptet.consent.isAccepted`) |
| `shoptet.abilities` | template capabilities — `about.id`, `config.navigation_breakpoint`, `feature.fixed_header`, `feature.smart_labels` |
| `shoptet.common` | `throttle` |
| `shoptet.helpers` | `toFloat` |
| `shoptet.cookie` | `create` |
| `shoptet.consent` | `cookiesConsentSubmit`, `openCookiesSettingModal`, `isAccepted(opt)`, `onAccept(cb)` — the consent API for P1 (always available by the time the addon runs; behavior details in the P1 catalog entry) |
| `shoptet.modal` | `open`, `close`, `shoptetResize`, `config.*` |
| `shoptet.popups` | `showPopupWindow`, `hideContentWindows` |
| `shoptet.global` | `showPopupWindow`, `hideContentWindows`, `toggleRegionsWrapper`, … |
| `shoptet.menu` | `toggleMenu`, `hideNavigation`, `hideSubmenu`, `splitMenu` |
| `shoptet.layout` | `detectResolution`, `getScrollOffset` |
| `shoptet.images` | `unveil` (lazy-load) |
| `shoptet.products` | `checkThumbnails`, `setThumbnailsDirection`, `splitWidgetParameters`, `unveilProductVideoTab` |
| `shoptet.validator` | `initValidator`, `handleValidators` (+ `validatorZipCode`, `validatorCompanyId`, `validatorRequired`) |
| `shoptet.watchdog` | `initWatchdog` (availability watchdog) |
| `shoptet.scripts` | `registerFunction`, `libs.global.forEach` |
| `shoptet.checkout` | `handleWithSidebar`, … |
| `shoptet.content` | `colorboxHeader`, `colorboxFooter` |
| `shoptet.messages`, `shoptet.runtime`, `shoptet.events`, `shoptet.dev` | system (messages, runtime state, events, `dev.deprecated`) |

**Further functionality under `shoptet.*`** introduced by `shared/js/libs/*` and `00/js/libs/*` (from `main-3g.js`) — the namespaces exist, the exact members are unverified: `cart`/`cartShared`, `tracking`/`fbShareTracker`, `csrf`/`csrfLink`, `image360`, `stockAvailabilities`, `ajax` (request/response), `variants` (surcharges/split/simple/unavailable), `xyDiscounts`, `phoneInput`, `cofidis`, `adminBar`, `tabs`, `topProducts`.

> The member enumeration is not complete — `shoptet.*` has more methods across template versions. For D1 it suffices to declare the root globals (`shoptet`, `dataLayer`, `getShoptetDataLayer`, `$`, `jQuery`).

---

## 3. Core functionality — don't reimplement, reuse (for B6)

If the partner writes their own implementation of something in the table, it's a B6 finding (it overwrites/duplicates what Shoptet already ships in `templates-assets/00/js/modules/`). File in the repo = `00/js/modules/<file>`.

| Functionality | Shoptet provides | Module / API |
|---------------|------------------|--------------|
| **Lightbox / modal** | colorbox + modal API | `jquery.colorbox.js`, `shoptet.modal.open/close` |
| **Product image zoom** | cloud-zoom | `jquery.cloud-zoom.*.js`, `cloudZoomInit.js` |
| **Dialogs / popups** | dialogs, popups | `dialogs.js`, `popups.js`, `shoptet.popups.*`, `shoptet.global.showPopupWindow` |
| **Tooltips** | tooltips | `tooltips.js` |
| **Slider / carousel** | slider | `slider.js` |
| **Tabs / accordion** | tabs (incl. responsive) | `tabsAccordion.js`, `tabsResponsive.js` |
| **Form validation** | validator + rules | `validator.js`, `shoptet.validator.initValidator/handleValidators`, zip/companyId/required validators |
| **Quantity / quantity discounts** | quantity controls | `quantity.js`, `quantityDiscounts.js` |
| **Search** | search | `search.js` |
| **Menu / navigation** | main + top navigation | `menu.js`, `topNavigationMenu.js`, `shoptet.menu.*` |
| **Product sorting** | sorting | `productSorting.js` |
| **Ratings / stars** | rating | `ratingStars.js`, `ratingSubpage.js`, `discussions-and-ratings.js` |
| **Image lazy-loading** | unveil | `unveil.js`, `shoptet.images.unveil` |
| **Custom selects** | select2 | `shared/js/modules/select2.js` |
| **Cookie bar / consent** | cookie bar + consent | `cookieBar.js`, `shoptet.consent.*`, `shoptet.cookie.create` |
| **Screen readers / focus / skip links** | a11y helpers | `screenReader.js`, `focusManagement.js`, `focus-visible.js`, `skipLinks.js` |
| **Smart labels** | labels | `smartLabels.js` |
| **Animations** | animations | `animations.js`, `shoptet.config.animationDuration` |
| **Scroll / offset** | scroll | `scroll.js`, `shoptet.layout.getScrollOffset` |
| **Availability watchdog** | watchdog | `watchdog.js`, `shoptet.watchdog.initWatchdog` |
| **Filters** | filtering | `filters.js` |
| **Responsive images (polyfill)** | picturefill | `shared/modules/picturefill.js` |
| **Throttle** | helper | `shoptet.common.throttle` |
| **Float conversion** | helper | `shoptet.helpers.toFloat` |
| **Resolution detection** | helper | `shoptet.layout.detectResolution` |
| **AJAX to Shoptet endpoints** | request/response wrapper | `shared/js/libs/ajax/request`, `ajax/response` |
| **CSRF token for requests** | CSRF protection | `shared/js/libs/csrf`, `csrfLink` |
| **Cart — manipulation** | cart API | `shared/js/libs/cart`, `cartShared` |
| **Product variants** | variant selection, split, unavailable, **surcharges** | `00/js/libs/variants/{common,variantsData,simple,split,unavailable,surcharges}` |
| **360° image viewer** | image360 | `shared/js/libs/image360` (careful: addons used to write `.image360` themselves) |
| **Second product image (hover)** | productInnerSecondImage | `productInnerSecondImage.js` |
| **Top products** | topProducts | `topProducts.js` |
| **Stock availability** | stockAvailabilities | `shared/js/libs/stockAvailabilities` |
| **Tracking / FB share** | tracking | `shared/js/libs/tracking`, `fbShareTracker` (watch GDPR) |
| **Phone input + validation** | phoneInput | `shared/js/libs/phoneInput`, `00/js/libs/validator/phone` |
| **ZIP / company-ID / required validators** | validators | `00/js/libs/validator/{zipcode,companyid,required}` |
| **XY discounts / surcharges** | discounts | `shared/js/libs/xyDiscounts`, `variants/surcharges` |
| **Cofidis financing** | cofidis | `shared/js/libs/cofidis` |
| **Datepicker / autocomplete / selectmenu / UI slider** | jQuery UI widgets | `shared/js/jqueryui/{datepicker,autocomplete,selectmenu,slider,button,menu}` |
| **Carousel / dropdown / tab / tooltip** | Bootstrap components | `00/js/bootstrap/{carousel,dropdown,tab,tooltip}` |

> **For B6 — watch the false positives:** presence in this table is a **necessary, not sufficient** condition. A mere category overlap (the partner has a slider/modal, Shoptet does too) **does not block** — many partners legitimately need a customized version that does something extra. Give ❌ only for **obvious duplication** (the version adds nothing over core) or an **overwrite/override of a core function**; for a mere overlap give **❓/⚠️, not ❌**. And when the partner solves something that is **not** in the table, B6 doesn't apply at all.

---

## 4. Shoptet events (for B5)

The addon should attach to the life cycle via the Shoptet events (`document.addEventListener('…', …)`), not via `setTimeout` polling. (Documentation: developers.shoptet.com.)

**Addon initialization (B5):**
- **First (non-AJAX) page load:** use the native `DOMContentLoaded` (the footer bundle runs after the core, §5, so the globals and core are ready). Do **not** rely on `ShoptetDOMContentLoaded` for the initial load — the official docs describe it as an **AJAX** event and neither guarantee its firing on first load nor recommend it for on-load init.
- **Content loaded later via AJAX:** `ShoptetDOMContentLoaded` — the generic event; it fires **every time a part of the DOM is loaded via AJAX** (always paired with a specific update event, e.g. `ShoptetDOMCartContentLoaded`). Code that should also apply to content loaded later belongs here.
- **Covering both:** attaching init to `DOMContentLoaded` (first load) **and** `ShoptetDOMContentLoaded` (AJAX re-render) is the **correct, expected pattern**, not an anti-pattern. Consequence for review: whatever runs from `ShoptetDOMContentLoaded` runs **again on every AJAX update** → **it must be idempotent** (an "already ran?" guard, no repeated `addEventListener` on the same element, no duplicated element insertion).
- **A real B5/E6 finding = a non-idempotent re-run** (accumulating listeners/elements after AJAX actions), **NOT** "double firing on first load" — that doesn't happen, because `ShoptetDOMContentLoaded` doesn't fire on the initial load.
- `ShoptetDOMPageContentLoaded` — specific: content after pagination/filters (not primary init).
- Registries: `shoptet.scripts.availableDOMLoadEvents`, `...availableDOMUpdateEvents`.

> **Correction (2026-07-09):** an earlier version claimed that `ShoptetDOMContentLoaded` "fires on the first load as well as on AJAX". Inaccurate — per developers.shoptet.com it is an AJAX event; the docs don't list it for the initial load. Source of the error: a wrong parallel with the native `DOMContentLoaded`.

**Specific AJAX update events:**
- `ShoptetDOMCartContentLoaded` — cart contents
- `ShoptetDOMCartCountUpdated` — cart item count
- `ShoptetDOMSearchResultsLoaded` — search results
- `ShoptetDOMPageMoreProductsLoaded` — additionally loaded "more products"
- `ShoptetDOMAdvancedOrderLoaded` — advanced order

**Data / cart:**
- `ShoptetDataLayerUpdated` — dataLayer updated
- `ShoptetCartUpdated` — cart changed

**Tracking** (relevant for GDPR — see the backlog): `ShoptetGoogleProductDetailTracked`, `ShoptetGoogleCartTracked`, `ShoptetFacebookPixelTracked`, `ShoptetTikTokPixelTracked`, `ShoptetGlamiPixelTracked`, `ShoptetProductsTracked`, `ShoptetPageMoreProductsRequested`, `ShoptetProductsList`.

> Custom events are registered via `availableCustomEvents` / `shoptet.scripts.registerFunction`. **The enumeration comes from a grep over a subset of files — not exhaustive.**

---

## 5. Addon structure and build pipeline (for A1, B3, C1, F5, G1, G3)

- **Boilerplate:** `github.com/shoptet/create-visual-addon-boilerplate` (`npx shoptet/create-visual-addon-boilerplate`), a webpack build. **"You must not change the folder structure"** because of the integration with the Addon Repository deployment.
- **`src/` layout:** the code is split by injection point — `src/header/`, `src/footer/`, `src/orderFinale/` (page header / footer / thank-you page).
- **The build merges and minifies** the files per location into one output — typically `scripts.header.min.js` and `scripts.footer.min.js` (CSS analogously). **Consequences for review:**
  - Multiple files in `footer` end up in one bundle → a real risk of **global variable/name collisions** (D1/D4).
  - Relying on a specific file name at runtime (e.g. `fetch`ing a JS file by name) **doesn't work** after minification/merging (a real remark from heureka-reviews).
- **E-shop-specific configuration:** insert as **inline JSON into the `header`** (via the API for HTML codes); the `footer` code only reads it (B3).
- **`$asset`** = serving the addon's assets from Shoptet storage — use it instead of an absolute foreign CDN URL (G5).
- **The production build is minified**; `dist`/dev builds don't belong in a PR (G1/F5); dev tools behind an ENV (`production` vs. `dev`, see F3).

---

## 6. Maintenance and regeneration (for skill maintainers only — agent, skip this during review)

> **Why this is here:** the blockable rules **B1/B4/B6** and the entire "what is NOT a finding" sections stand on this reference. An `@master` snapshot silently ages against a moving target. That this isn't hypothetical: on **2026-07-09** a factual error (`ShoptetDOMContentLoaded` supposedly runs on first load too) propagated **into three files at once** (this reference §4, rule B5 in the catalog, the checklist — today in `CONTEXT.md`). The procedure below is meant to catch such an error **systematically, not by luck**.

**When to regenerate:** on a bigger `templates-assets` change, on suspicion of a stale fact (a false B1/B6 blocker), or periodically (every ~6 months).

**Procedure:**
1. **Pin the commit.** Find the current `master` hash in `github.com/shoptet/templates-assets` and from the start work against **it**, not against the moving `@master`:
   ```sh
   git clone --depth 1 https://github.com/shoptet/templates-assets
   git -C templates-assets rev-parse HEAD   # → write this hash into the header (Pin)
   ```
2. **Re-pull the extraction** (scope per the header): `00/js/main-3g.js` (the import manifest — §3 is complete for template `00` thanks to it), `00/js/modules`, `00/js/libs`, `shared/js/libs`, `dataLayerHelper.js`, `globalFunctions.js`.
3. **Verify against the repo, not just the docs.** developers.shoptet.com gets things wrong (the `product.code` case). When a fact and the docs contradict each other, the repo wins; note the contradiction.
4. **Update the header:** the new `Pin` (hash) + `Snapshot as of`. Without the recorded hash the regeneration is incomplete.
5. **CROSS-CHECK THE DEPENDENT RULES (do not skip — this is where the 07-09 error was born).** Walk every changed/corrected fact across the files that live off it:
   - `rules-catalog.md` — rules **B1, B4, B6** (and their Gates / "what is NOT a finding") + anything that cites a specific key/method/event from the reference.
   - `CONTEXT.md` — the partner pre-submit checklist (e.g. the line about the init events).
   - elsewhere in `shoptet-reference.md` — the "what is NOT a finding" sections and notes that repeat the fact.

   Rule: **a fact in the reference never changes in isolation** — either the dependent rules change too, or it's verified that they're unaffected. Date the correction with a note at the affected spot (like the "Correction (2026-07-09)" block in §4).

**Ideal (still TODO):** script steps 1–2 (a clone at the pin + extraction into a diffable form), so regeneration is a single command and the changes against the previous snapshot are visible mechanically.
