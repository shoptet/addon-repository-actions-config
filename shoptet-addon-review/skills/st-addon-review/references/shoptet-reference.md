# Shoptet referenční doplněk — pro pravidla B1 / B4 / B6

> **Companion k `rules-catalog.md`.** Review agent ho dostane spolu s katalogem. Bez něj jsou B1 (dataLayer), B4 (vždy dostupné globály) a B6 (nepřepisovat core) systematicky slabé — agent by poznal jen to, co je jmenované v příkladu pravidla.
>
> **Zdroj a platnost:** snapshot z `github.com/shoptet/templates-assets@master` (`00/js/main-3g.js` import manifest, `00/js/modules`, `00/js/libs`, `shared/js/libs`, `dataLayerHelper.js`, `globalFunctions.js`) + dev dokumentace dataLayer, staženo 2026-06-30. **Inventář modulů/funkcionality (§3) je díky manifestu `main-3g.js` kompletní pro šablonu `00`.** Naopak **member-level `shoptet.*` API (§2) je stále jen částečné** — přesné názvy metod jednotlivých namespaces nejsou všechny ověřené. **Když konkrétní metoda v seznamu není, neznamená to, že neexistuje** — ověř v repu a na developers.shoptet.com. Verze šablon (`00`, `07`, `09`, `10`, `11`, `12`, `13`, `14`) odpovídají `shoptet.abilities.about.id`; `00` je společný základ.

---

## 1. dataLayer — povrch (pro B1)

**Přístup:**
- `getShoptetDataLayer()` — vrátí celý objekt
- `getShoptetDataLayer('key')` — vrátí konkrétní klíč
- `dataLayer[0].shoptet` — přímý přístup
- událost `ShoptetDataLayerUpdated` (na `document`) — když se dataLayer aktualizuje

**Top-level klíče:**

| Klíč | Obsah | Dostupné na |
|------|-------|-------------|
| `pageType` | typ stránky (`homepage`, `category`, `productDetail`, `cart`, `thankYou`) | všude |
| `currency` | třípísmenný kód měny | všude |
| `language` | jazyk (`cs`, `en`, `de`, …) | všude |
| `projectId` | identifikátor e-shopu (max 6 číslic) | všude |
| `cart` | pole položek v košíku | všude |
| `cartInfo` | doplňková data košíku (doprava zdarma, kupóny) | (dle kontextu) |
| `product` | metadata produktu | jen `productDetail` |
| `stocks` | sklady / odběrná místa | jen `productDetail` |
| `order` | kompletní data objednávky | jen `thankYou` |

**`product` (vnořené):** `id`, `guid`, `hasVariants`, `code` (jen bez variant), `codes`, `name`, `appendix`, `manufacturer`, `manufacturerGuid`, `currentCategory`, `defaultCategory`, `currency`, `priceWithVat`
> **Kód produktu (ověřeno na živém Shoptetu 2026-07-08 — POZOR, oficiální docs to mají neúplně):**
> závisí na variantách.
> - **Bez variant** (`hasVariants: false`): kód je v `product.code` (řetězec, např. `"341"`)
>   a *zároveň* v `product.codes[0].code` (ale jako **číslo** `341`).
> - **S variantami** (`hasVariants: true`): `product.code` **neexistuje**; kódy variant jsou jen
>   v `product.codes[]` (řetězce, např. `"345/FIA"`).
> Robustně: `hasVariants ? product.codes.map(c => c.code) : (product.code ?? product.codes?.[0]?.code)`.
> **Čtení `product.code` u produktu bez variant tedy NENÍ nález** — je to správně. Oficiální
> dataLayer dokumentace `code` (singulár) neuvádí; je to mezera v docs, ne v realitě —
> nespoléhej na „co není v docs, neexistuje".
**`order` (vnořené):** `orderNo`, `storeName`, `total`, `totalWithoutVat`, `shipping`, `tax`, `city`, `country`, `content`, `currencyCode`, `customer`, `discountCoupons`

> **Pro B1:** Pokud partner čte cokoli z výše uvedeného parsováním DOMu nebo hardcoded hodnotou, má to číst z dataLayer. Číselné identifikátory typů → `shoptet.abilities.about.id` (ne mapování class name).
>
> **Pozor na false positive (B1):** B1 je o **získávání dat**, ne o cílení prvků. Používat **class selektory** k napojení chování/stylu je v Shoptetu běžné a často jediné možné (žádný stabilní hook, `data-testid` zakázán B7) — samotná „křehkost class selektoru" **není nález**. Nálezem je až čtení *dat* z DOMu, která jsou v dataLayer/`shoptet.abilities` (B1), vazba na `data-testid` (B7) nebo selektor mimo vlastní kontejner (B8).

---

## 2. Vždy dostupné globály (pro B4 — a zároveň zdroj pro ESLint `globals` v D1)

Tyto objekty jsou v kontextu doplňku **vždy definované** → defenzivní kontrola (`if (typeof shoptet !== 'undefined')`) je zbytečná (B4). Současně musí být deklarované v ESLint `languageOptions.globals`, jinak `no-undef` hlásí false-positives (D1).

> **Pozor na false positive (B5):** „vždy definované" znamená i to, že **`undefined` z nedoběhlého / špatně řazeného Shoptet skriptu není reálné riziko** — Shoptet garantuje, že globály i core jsou v době běhu doplňku připravené. Domněnka „tohle může být undefined, pokud ještě nedoběhl skript" tedy **není nález**; nenavrhuj guardy proti ní. Reálné je až to, co doplněk zavádí sám (`setTimeout` hack, init mimo lifecycle event) nebo čtení **obsahu donačteného AJAXem** (ten fakt ještě být nemusí → napojit na správný event, §4). Viz B5.

- **Standard prohlížeče:** `window`, `document`, `screen`, `navigator`, `location`
- **jQuery:** `$`, `jQuery` (Shoptet ji načítá)
- **dataLayer:** `dataLayer` (pole), `getShoptetDataLayer()`
- **`shoptet` (root)** + namespaces (níže)

**Známé `shoptet.*` namespaces** (kurátorovaný výčet z `globalFunctions.js`):

| Namespace | K čemu (vybrané členy) |
|-----------|------------------------|
| `shoptet.config` | konfigurace — `breakpoints.{sm,…}`, `animationDuration`, `agreementCookieName/Expire`, `mobileHeaderVersion`, `thumbnailsDirection` |
| `shoptet.abilities` | schopnosti šablony — `about.id`, `config.navigation_breakpoint`, `feature.fixed_header`, `feature.smart_labels` |
| `shoptet.common` | `throttle` |
| `shoptet.helpers` | `toFloat` |
| `shoptet.cookie` | `create` |
| `shoptet.consent` | `cookiesConsentSubmit`, `openCookiesSettingModal` |
| `shoptet.modal` | `open`, `close`, `shoptetResize`, `config.*` |
| `shoptet.popups` | `showPopupWindow`, `hideContentWindows` |
| `shoptet.global` | `showPopupWindow`, `hideContentWindows`, `toggleRegionsWrapper`, … |
| `shoptet.menu` | `toggleMenu`, `hideNavigation`, `hideSubmenu`, `splitMenu` |
| `shoptet.layout` | `detectResolution`, `getScrollOffset` |
| `shoptet.images` | `unveil` (lazy-load) |
| `shoptet.products` | `checkThumbnails`, `setThumbnailsDirection`, `splitWidgetParameters`, `unveilProductVideoTab` |
| `shoptet.validator` | `initValidator`, `handleValidators` (+ `validatorZipCode`, `validatorCompanyId`, `validatorRequired`) |
| `shoptet.watchdog` | `initWatchdog` (hlídací pes / hlídání dostupnosti) |
| `shoptet.scripts` | `registerFunction`, `libs.global.forEach` |
| `shoptet.checkout` | `handleWithSidebar`, … |
| `shoptet.content` | `colorboxHeader`, `colorboxFooter` |
| `shoptet.messages`, `shoptet.runtime`, `shoptet.events`, `shoptet.dev` | systémové (zprávy, běhový stav, eventy, `dev.deprecated`) |

**Další funkcionalita pod `shoptet.*`** zaváděná `shared/js/libs/*` a `00/js/libs/*` (z `main-3g.js`) — namespaces existují, přesné členy neověřené: `cart`/`cartShared`, `tracking`/`fbShareTracker`, `csrf`/`csrfLink`, `image360`, `stockAvailabilities`, `ajax` (request/response), `variants` (surcharges/split/simple/unavailable), `xyDiscounts`, `phoneInput`, `cofidis`, `adminBar`, `tabs`, `topProducts`.

> Výčet členů není úplný — `shoptet.*` má víc metod napříč verzemi šablon. Pro D1 stačí deklarovat root globály (`shoptet`, `dataLayer`, `getShoptetDataLayer`, `$`, `jQuery`).

---

## 3. Core funkcionalita — nereimplementovat, využít (pro B6)

Pokud partner píše vlastní implementaci něčeho z tabulky, je to nález B6 (přepíše/duplikuje to, co Shoptet už dodává v `templates-assets/00/js/modules/`). Soubor v repu = `00/js/modules/<soubor>`.

| Funkcionalita | Shoptet poskytuje | Modul / API |
|---------------|-------------------|-------------|
| **Lightbox / modal** | colorbox + modal API | `jquery.colorbox.js`, `shoptet.modal.open/close` |
| **Zoom obrázku produktu** | cloud-zoom | `jquery.cloud-zoom.*.js`, `cloudZoomInit.js` |
| **Dialogy / popupy** | dialogy, popupy | `dialogs.js`, `popups.js`, `shoptet.popups.*`, `shoptet.global.showPopupWindow` |
| **Tooltipy** | tooltips | `tooltips.js` |
| **Slider / carousel** | slider | `slider.js` |
| **Taby / accordion** | taby (i responzivní) | `tabsAccordion.js`, `tabsResponsive.js` |
| **Validace formulářů** | validátor + pravidla | `validator.js`, `shoptet.validator.initValidator/handleValidators`, zip/companyId/required validátory |
| **Množství / množstevní slevy** | quantity ovládání | `quantity.js`, `quantityDiscounts.js` |
| **Vyhledávání** | search | `search.js` |
| **Menu / navigace** | hlavní + top navigace | `menu.js`, `topNavigationMenu.js`, `shoptet.menu.*` |
| **Řazení produktů** | sorting | `productSorting.js` |
| **Hodnocení / hvězdičky** | rating | `ratingStars.js`, `ratingSubpage.js`, `discussions-and-ratings.js` |
| **Lazy-load obrázků** | unveil | `unveil.js`, `shoptet.images.unveil` |
| **Custom selecty** | select2 | `shared/js/modules/select2.js` |
| **Cookie lišta / souhlas** | cookie bar + consent | `cookieBar.js`, `shoptet.consent.*`, `shoptet.cookie.create` |
| **Čtečky / focus / skip links** | a11y helpery | `screenReader.js`, `focusManagement.js`, `focus-visible.js`, `skipLinks.js` |
| **Smart labels** | štítky | `smartLabels.js` |
| **Animace** | animace | `animations.js`, `shoptet.config.animationDuration` |
| **Scroll / offset** | scroll | `scroll.js`, `shoptet.layout.getScrollOffset` |
| **Hlídání dostupnosti** | watchdog | `watchdog.js`, `shoptet.watchdog.initWatchdog` |
| **Filtry** | filtrování | `filters.js` |
| **Responsivní obrázky (polyfill)** | picturefill | `shared/modules/picturefill.js` |
| **Throttle** | helper | `shoptet.common.throttle` |
| **Převod na float** | helper | `shoptet.helpers.toFloat` |
| **Detekce rozlišení** | helper | `shoptet.layout.detectResolution` |
| **AJAX na Shoptet endpointy** | request/response wrapper | `shared/js/libs/ajax/request`, `ajax/response` |
| **CSRF token pro requesty** | CSRF ochrana | `shared/js/libs/csrf`, `csrfLink` |
| **Košík — manipulace** | cart API | `shared/js/libs/cart`, `cartShared` |
| **Produktové varianty** | výběr variant, split, nedostupné, **příplatky** | `00/js/libs/variants/{common,variantsData,simple,split,unavailable,surcharges}` |
| **360° prohlížeč obrázku** | image360 | `shared/js/libs/image360` (pozor: addony si `.image360` psaly samy) |
| **Druhý obrázek produktu (hover)** | productInnerSecondImage | `productInnerSecondImage.js` |
| **Top produkty** | topProducts | `topProducts.js` |
| **Dostupnost skladem** | stockAvailabilities | `shared/js/libs/stockAvailabilities` |
| **Tracking / FB share** | tracking | `shared/js/libs/tracking`, `fbShareTracker` (pozor na GDPR) |
| **Telefonní input + validace** | phoneInput | `shared/js/libs/phoneInput`, `00/js/libs/validator/phone` |
| **Validátory PSČ / IČO / povinné** | validátory | `00/js/libs/validator/{zipcode,companyid,required}` |
| **Slevy XY / příplatky** | discounts | `shared/js/libs/xyDiscounts`, `variants/surcharges` |
| **Cofidis financování** | cofidis | `shared/js/libs/cofidis` |
| **Datepicker / autocomplete / selectmenu / UI slider** | jQuery UI widgety | `shared/js/jqueryui/{datepicker,autocomplete,selectmenu,slider,button,menu}` |
| **Carousel / dropdown / tab / tooltip** | Bootstrap komponenty | `00/js/bootstrap/{carousel,dropdown,tab,tooltip}` |

> **Pro B6 — pozor na false positives:** přítomnost v této tabulce je **nutná, ne postačující** podmínka. Pouhý překryv kategorie (partner má slider/modal, Shoptet taky) **neblokuje** — řada partnerů legitimně potřebuje upravenou verzi, která dělá něco navíc. ❌ dej až u **zjevné duplikace** (verze nepřináší nic navíc oproti core) nebo **přepisu/override core funkce**; při pouhém překryvu dej **❓/⚠️, ne ❌**. A když partner řeší něco, co v tabulce **není**, B6 se neuplatní vůbec.

---

## 4. Shoptet eventy (pro B5)

Doplněk se má napojit na životní cyklus přes Shoptet eventy (`document.addEventListener('…', …)`), ne přes `setTimeout` polling. (Dokumentace: developers.shoptet.com.)

**Inicializace doplňku (B5):**
- `ShoptetDOMContentLoaded` — **obecný event; spustí se při prvním načtení i pokaždé, když se část DOM donačte AJAXem.** Doplněk inicializuj tady, aby se aplikoval i na později donačtený obsah. Vždy se pojí s konkrétním update eventem (např. `ShoptetDOMCartContentLoaded`).
- `ShoptetDOMPageContentLoaded` — **specifický**: nový obsah stránky po **stránkování nebo filtrech** (ne primární init).
- Registry dostupných eventů: `shoptet.scripts.availableDOMLoadEvents`, `shoptet.scripts.availableDOMUpdateEvents`.

**Konkrétní AJAX update eventy:**
- `ShoptetDOMCartContentLoaded` — obsah košíku
- `ShoptetDOMCartCountUpdated` — počet položek v košíku
- `ShoptetDOMSearchResultsLoaded` — výsledky vyhledávání
- `ShoptetDOMPageMoreProductsLoaded` — donačtené „další produkty"
- `ShoptetDOMAdvancedOrderLoaded` — pokročilá objednávka

**Data / košík:**
- `ShoptetDataLayerUpdated` — dataLayer aktualizován
- `ShoptetCartUpdated` — košík změněn

**Tracking** (relevantní pro GDPR — viz backlog): `ShoptetGoogleProductDetailTracked`, `ShoptetGoogleCartTracked`, `ShoptetFacebookPixelTracked`, `ShoptetTikTokPixelTracked`, `ShoptetGlamiPixelTracked`, `ShoptetProductsTracked`, `ShoptetPageMoreProductsRequested`, `ShoptetProductsList`.

> Vlastní eventy se registrují přes `availableCustomEvents` / `shoptet.scripts.registerFunction`. **Výčet je z grepu nad podmnožinou souborů — ne vyčerpávající.**

---

## 5. Struktura doplňku a build pipeline (pro A1, B3, C1, F5, G1, G3)

- **Boilerplate:** `github.com/shoptet/create-visual-addon-boilerplate` (`npx shoptet/create-visual-addon-boilerplate`), webpack build. **„Strukturu složek nesmíš měnit"** kvůli integraci s Addon Repository deploymentem.
- **Layout `src/`:** kód se dělí podle místa injektáže — `src/header/`, `src/footer/`, `src/orderFinale/` (hlavička stránky / patička / děkovací stránka).
- **Build slučuje a minifikuje** soubory dle umístění do jednoho výstupu — typicky `scripts.header.min.js` a `scripts.footer.min.js` (obdobně CSS). **Důsledky pro review:**
  - Víc souborů ve `footer` skončí v jednom bundlu → reálné riziko **kolize globálních proměnných/názvů** (D1/D4).
  - Spoléhat na konkrétní název souboru za běhu (např. `fetch` JS souboru podle jména) po minifikaci/sloučení **nefunguje** (reálná připomínka u heureka-reviews).
- **Konfigurace specifická pro e-shop:** vkládat jako **inline JSON do `header`** (přes API pro HTML kódy), v `footer` kódu jen číst (B3).
- **`$asset`** = servírování assetů doplňku ze Shoptet úložiště — používej místo absolutní cizí CDN URL (G5).
- **Produkční build je minifikovaný**; `dist`/dev buildy nepatří do PR (G1/F5); dev nástroje za ENV (`production` vs `dev`, viz F3).
