# Shoptet referenční doplněk — pro pravidla B1 / B4 / B6

> **Companion k `rules-catalog.md`.** Review agent ho dostane spolu s katalogem. Bez něj jsou B1 (dataLayer), B4 (vždy dostupné globály) a B6 (nepřepisovat core) systematicky slabé — agent by poznal jen to, co je jmenované v příkladu pravidla.
>
> **Zdroj a platnost (provenance):**
> - **Repo:** `github.com/shoptet/templates-assets`
> - **Pin (commit):** `TODO` — snapshot k 2026-06-30 byl pořízen z `@master` **bez zaznamenání hashe**; při první regeneraci pinni na konkrétní commit a hash sem zapiš (viz *§6 Údržba a regenerace* na konci souboru). Dokud tu je `TODO`, ber datum níže jako jediné vodítko o stáří.
> - **Snapshot k datu:** 2026-06-30
> - **Rozsah odběru:** `00/js/main-3g.js` (import manifest), `00/js/modules`, `00/js/libs`, `shared/js/libs`, `dataLayerHelper.js`, `globalFunctions.js` + dev dokumentace dataLayer.
> - **Šablony:** `00`, `07`, `09`, `10`, `11`, `12`, `13`, `14` odpovídají `shoptet.abilities.about.id`; `00` je společný základ.
>
> **Úplnost:** Inventář modulů/funkcionality (§3) je díky manifestu `main-3g.js` **kompletní pro šablonu `00`**. Naopak member-level `shoptet.*` API (§2) je **stále jen částečné** — přesné názvy metod jednotlivých namespaces nejsou všechny ověřené. **Když konkrétní metoda v seznamu není, neznamená to, že neexistuje** — ověř v repu a na developers.shoptet.com (a pozor: i oficiální docs se pletou — viz případ `product.code`, proto se ověřuje proti repu, ne jen proti docs).

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
- **První (ne-AJAX) načtení stránky:** použij nativní `DOMContentLoaded` (footer bundle běží po jádru, §5, takže globály i core jsou připravené). Na `ShoptetDOMContentLoaded` se u prvotního loadu **nespoléhej** — oficiální docs ho popisují jako **AJAX** event a jeho vznik při prvním načtení negarantují ani nedoporučují k on-load initu.
- **Obsah donačtený AJAXem:** `ShoptetDOMContentLoaded` — obecný event; spustí se **pokaždé, když se část DOM donačte AJAXem** (vždy se pojí s konkrétním update eventem, např. `ShoptetDOMCartContentLoaded`). Sem patří kód, který se má aplikovat i na později donačtený obsah.
- **Pokrytí obojího:** navázat init na `DOMContentLoaded` (první načtení) **i** `ShoptetDOMContentLoaded` (AJAX re-render) je **správný, očekávaný vzor**, ne anti-pattern. Důsledek pro review: co běží z `ShoptetDOMContentLoaded`, se spustí **při každém AJAX update znovu** → **musí to být idempotentní** (guard „už jsem běžela?", žádné opakované `addEventListener` na týž prvek, žádné duplicitní vkládání elementů).
- **Reálný B5/E6 nález = neidempotentní re-run** (hromadění listenerů/elementů po AJAX akcích), **NE** „dvojí spuštění při prvním načtení" — to neplatí, protože `ShoptetDOMContentLoaded` při prvotním loadu nevzniká.
- `ShoptetDOMPageContentLoaded` — specifický: obsah po stránkování/filtrech (ne primární init).
- Registry: `shoptet.scripts.availableDOMLoadEvents`, `...availableDOMUpdateEvents`.

> **Oprava (2026-07-09):** dřívější znění tvrdilo, že `ShoptetDOMContentLoaded` „se spustí při prvním načtení i při AJAXu". Nepřesné — dle developers.shoptet.com je to AJAX event; pro prvotní load ho docs neuvádějí. Zdroj chyby: chybná paralela s nativním `DOMContentLoaded`.

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

---

## 6. Údržba a regenerace (jen pro údržbáře skillu — agent u review přeskoč)

> **Proč to tu je:** na téhle referenci stojí blokovatelná pravidla **B1/B4/B6** a celé sekce „co NENÍ nález". `@master` snapshot tiše stárne vůči pohyblivému cíli. Že to není hypotetické: **2026-07-09** se faktická chyba (`ShoptetDOMContentLoaded` prý běží i při prvním načtení) propsala **do tří souborů najednou** (tahle reference §4, pravidlo B5 v katalogu, checklist v guide). Postup níže má takovou chybu chytit **systematicky, ne náhodou**.

**Kdy regenerovat:** při větší změně `templates-assets`, při podezření na zastaralý fakt (falešný B1/B6 bloker), nebo periodicky (á 6 měsíců).

**Postup:**
1. **Pinni commit.** Zjisti aktuální hash `master` v `github.com/shoptet/templates-assets` a od začátku pracuj proti **němu**, ne proti pohyblivému `@master`:
   ```sh
   git clone --depth 1 https://github.com/shoptet/templates-assets
   git -C templates-assets rev-parse HEAD   # → tenhle hash zapiš do hlavičky (Pin)
   ```
2. **Přetáhni odběr** (rozsah viz hlavička): `00/js/main-3g.js` (import manifest — z něj je §3 kompletní pro šablonu `00`), `00/js/modules`, `00/js/libs`, `shared/js/libs`, `dataLayerHelper.js`, `globalFunctions.js`.
3. **Ověř proti repu, ne jen proti docs.** developers.shoptet.com se pletou (případ `product.code`). Když si fakt a docs odporují, vyhrává repo; rozpor poznamenej.
4. **Aktualizuj hlavičku:** nový `Pin` (hash) + `Snapshot k datu`. Bez zapsaného hashe je regenerace neúplná.
5. **KŘÍŽOVÁ KONTROLA ZÁVISLÝCH PRAVIDEL (nevynechat — tady vznikla chyba 07-09).** Každý změněný/opravený fakt projdi napříč soubory, které z něj žijí:
   - `rules-catalog.md` — pravidla **B1, B4, B6** (a jejich Gate / „co NENÍ nález") + cokoli, co cituje konkrétní klíč/metodu/event z reference.
   - `guide.md` — partnerský checklist (např. řádek o init eventech).
   - jinde v `shoptet-reference.md` — sekce „co NENÍ nález" a poznámky, které fakt opakují.

   Pravidlo: **fakt v referenci se nikdy nemění osamoceně** — buď se změní i závislá pravidla, nebo se ověří, že se jich netýká. Opravu datuj poznámkou u dotčeného místa (jako blok „Oprava (2026-07-09)" v §4).

**Ideál (zatím TODO):** kroky 1–2 skriptovat (clone na pin + extrakce odběru do diffovatelné podoby), ať je regenerace jedním příkazem a změny oproti minulému snapshotu jsou vidět mechanicky.
