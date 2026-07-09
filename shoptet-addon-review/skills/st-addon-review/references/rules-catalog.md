# Katalog pravidel — Shoptet doplňky

> Strojově čitelný katalog pro review agenta. Obsahuje **jen pravidla (A–J)**. Lidská část (proces, „typická struktura review", checklist) je v `GUIDE.md`.
>
> **Pravidla B1 / B4 / B6 vyžadují znalost Shoptet prostředí** (dataLayer klíče, vždy dostupné globály, seznam core funkcí). Tu agent dostane z companion souboru **`shoptet-reference.md`**, který se předává spolu s tímto katalogem. Bez něj jsou B1/B4/B6 systematicky slabé.

**Formát záznamu** — každé pravidlo má stejná pole ve stejném pořadí:
`ID`, `Severity`, `Vlastník`, `Nástroj`, `Gate` (jen u podmíněných), `Problém`, `Proč`, `Řešení`, `Náhrada kódu` (volitelně), `Pozn.` (volitelně).

- **Severity:** `❌ blokující` · `⚠️ doporučené` · `💡 tip` · `❌/⚠️ podmíněné (viz Gate)` · `⚠️/💡 (neblokuje)`
- **Vlastník:** `Linter` (mechanické, vynutitelné) · `AI` (kontextové posouzení) · `Oba` (linter mechanickou část, AI kontext)
- **Nástroj:** konkrétní nástroj; `—` = žádný (čistě AI). Nástroje mimo ESLint jsou označené.
- **Gate:** binární kritérium pro `❌/⚠️` pravidla — kdy blokuje a kdy ne. Závazné pro AI i člověka.
- **Náhrada kódu:** přítomný fenced blok = konkrétní náhrada → lze z něj generovat `suggestion`. Bez něj je `Řešení` jen prozaická rada.

---

# A. Bezpečnost

### A1 — XSS / nebezpečné vkládání HTML
- **ID:** A1
- **Severity:** ❌ blokující
- **Vlastník:** Oba
- **Nástroj:** `eslint-plugin-no-unsanitized`
- **Problém:** Data (z API, konfigurace, uživatele) se vkládají do DOM bez ošetření — `element.innerHTML = data`, `JSON.stringify` přímo do HTML, `.replace()` nad HTML stringem.
- **Proč:** Útočník může vložit `<script>`/`onerror` a spustit cizí kód na e-shopu. Nejčastější blokující problém vůbec.
- **Řešení:** Pro text `textContent` místo `innerHTML`; pro HTML sanitizovat (allowlist) nebo skládat přes DOM API (`createElement`/`append`), případně DOMPurify; používat builder element a hodnoty vkládat jako text.
- **Pozn.:** `eslint-plugin-no-unsanitized` flagne `innerHTML =` a podobné sinky; AI posoudí reálné riziko a kvalitu sanitizace.
- **Pozn. (překryv s E1):** Skládání HTML konkatenací (`'<div>' + apiData + '</div>'`) **není jen E1** (styl) — pokud je v řetězci **neošetřená hodnota z API / konfigurace / uživatele, je to A1** (blokující). Konkatenace je typický XSS vektor právě proto, že neumožňuje escapování. Když vidíš `+`-skládání HTML s daty, posuď ho jako A1, ne ho odbýt jako kosmetické E1.

### A2 — Kontrola / validace vstupních parametrů
- **ID:** A2
- **Severity:** ❌/⚠️ podmíněné (viz Gate)
- **Vlastník:** AI
- **Nástroj:** —
- **Gate:** ❌ když neošetřený vstup **vyhodí výjimku, která přeruší zbytek inicializace doplňku** (`x.match(…)[1]` na `null`, `.getAttribute()`/`.replace()` nad `undefined` v init toku) **nebo skončí v citlivém kontextu** (DOM, URL, `fetch`); ⚠️ jen když je selhání **ohraničené** (interní hodnota, na kterou nenavazuje další kód). Pozor: **„shodit doplněk" stačí — nemusí spadnout celý e-shop.** Pád v init handleru, po němž tiše neproběhne zbytek setupu (další `setup*` funkce), je ❌ (doplněk je rozbitý), ne ⚠️ — a v souhrnu patří **na čelo blokujících**, ne doprostřed doporučených. **Podmíněnost pádu závažnost nesnižuje:** „spadne, *jen když* shop nevloží config" / „*jen když* obrázek nemá `data-src`" / „to se *asi* nestane" **není důvod dát ⚠️ místo ❌**. Gate se ptá na **následek, když to nastane** (přeruší init → ❌), ne na pravděpodobnost. Nízká pravděpodobnost patří do `confidence`, **ne** do severity — nediskontuj ❌ na ⚠️.
- **Problém:** Funkce nepočítá s prázdným/chybějícím vstupem (`undefined`, prázdné video, chybějící URL).
- **Proč:** Skript spadne na neošetřené hodnotě a rozbije zbytek stránky.
- **Řešení:** Guard na začátku + výchozí hodnoty parametrů.
- **Náhrada kódu:**
  ```js
  function createMp4Slide(url = '') {
    if (!url) return '';
    // ...
  }
  ```

### A3 — Mutace vstupů / oddělení vstupu od stavu
- **ID:** A3
- **Severity:** ❌ blokující
- **Vlastník:** Oba
- **Nástroj:** ESLint `no-param-reassign`
- **Problém:** Funkce přepisuje svůj vstupní parametr; jedna proměnná slouží zároveň jako uživatelský vstup i jako interní stav.
- **Proč:** Nečekané vedlejší efekty, těžko se ladí.
- **Řešení:** Lokální kopie (`const local = {...input}`) a oddělené proměnné pro vstup a interní stav.

### A4 — Citlivá data v kódu
- **ID:** A4
- **Severity:** ❌ blokující
- **Vlastník:** Oba
- **Nástroj:** secret-scan (gitleaks / trufflehog) — **ne ESLint**
- **Problém:** Token / API klíč viditelný v produkčním (klientském) kódu.
- **Proč:** Klientský kód si přečte kdokoli.
- **Řešení:** Ověř, že token smí být veřejný (vázaný na origin/eshop); jinak ho vydávej z backendu s kontrolou původu requestu.
- **Pozn.:** Secret-scan detekuje vzor tokenu, AI posoudí citlivost.

### A5 — Externí odkazy target="_blank"
- **ID:** A5
- **Severity:** ⚠️ doporučené
- **Vlastník:** Oba
- **Nástroj:** runtime (htmlhint / axe nad vyrenderovaným HTML) / grep
- **Problém:** Odkaz do nového okna bez `rel`.
- **Proč:** Otevřená stránka může přes `window.opener` zmanipulovat původní stránku (reverse tabnabbing).
- **Řešení:** Vždy `rel="noopener noreferrer"`.
- **Pozn.:** Odkazy se skládají jako HTML stringy (ne JSX) → `react/jsx-no-target-blank` nezabere; mechanická část je runtime, ne ESLint.

---

# B. Integrace se Shoptetem

### B1 — Čtení dat přes dataLayer / oficiální API
- **ID:** B1
- **Severity:** ❌/⚠️ podmíněné (viz Gate)
- **Vlastník:** AI
- **Nástroj:** —
- **Gate:** ❌ když získání dat závisí na parsování DOMu / hardcoded hodnotách, které se při změně šablony rozbijí (funkční riziko); ⚠️ jinak (existuje fallback, jde o drobné zjednodušení).
- **Problém:** Doplněk si jazyk, typ stránky, kód produktu apod. zjišťuje vlastní cestou (parsování DOMu, hardcoded hodnoty).
- **Proč:** Vlastní parsování DOMu se rozbije při změně šablony; oficiální API je stabilní a jednotné.
- **Řešení:** Používej `getShoptetDataLayer()`; pro číselné identifikátory `shoptet.abilities.about.id` místo mapování na class name.
- **Pozn.:** Seznam dostupných klíčů a jejich dostupnost dle typu stránky → `shoptet-reference.md` §1.
- **Pozn. (co NENÍ nález):** Cílit DOM prvky přes **class selektory** je v Shoptet doplňcích běžný
  a často **jediný možný** způsob — šablona pro většinu prvků nenabízí stabilní hook a `data-testid`
  je navíc zakázané (B7). Samotná „křehkost class selektoru" tedy **není nález** (ani jako judgment) —
  nevytýkej ji, když stabilní alternativa neexistuje. B1 platí jen na **získávání dat** dostupných
  přes dataLayer/`shoptet.abilities` (jazyk, typ stránky, ID produktu → mapování na class name je
  tady nález). Reálné zůstávají i sousední případy: vazba na `data-testid` (B7), selektor sahající
  **mimo vlastní kontejner** doplňku (B8), nebo konkrétně stabilnější hook, který partner obešel.
- **Náhrada kódu:**
  ```js
  const lang = getShoptetDataLayer('language');
  const isProduct = getShoptetDataLayer('pageType') === 'productDetail';
  const { product } = getShoptetDataLayer();
  const code = product?.codes?.[0]?.code || null; // kód je v poli codes[]; samostatné product.code neexistuje
  ```

### B2 — Breakpointy ze Shoptetu
- **ID:** B2
- **Severity:** ⚠️ doporučené
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Vlastní/náhodné breakpointy (např. `550px`, `767px`), které nesedí se šablonou.
- **Proč:** Doplněk se pak zalamuje jinde než zbytek šablony — nekonzistentní chování napříč zařízeními.
- **Řešení:** Čti z `shoptet.config.breakpoints`, případně použij oficiální hodnoty: min-width xs `480` / sm `768` / md `992` / lg `1200` / xl `1440`; max-width xs `479` / sm `767` / md `991` / lg `1199` / xl `1439`.

### B3 — Konfigurace přes Shoptet API místo generování
- **ID:** B3
- **Severity:** ⚠️ doporučené
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Doplněk nutí uživatele generovat/vkládat konfiguraci ručně.
- **Proč:** Ruční postup je chybový a nepřívětivý; přes API je nastavení spolehlivé a aktualizovatelné.
- **Řešení:** Nastavení vkládej přes API (inline JSON do hlavičky), v kódu ho jen čteš.
- **Náhrada kódu:**
  ```js
  const myAddonConfig = { eshopSpecificData: /* … */ };
  // → v kódu: myAddonConfig.eshopSpecificData
  ```

### B4 — Zbytečné kontroly Shoptet objektů
- **ID:** B4
- **Severity:** ⚠️ doporučené
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Defenzivní kontroly nad objekty, které jsou vždy dostupné (`shoptet`, `screen`, `dataLayer`).
- **Proč:** Zbytečný kód navíc, který jen zhoršuje čitelnost.
- **Řešení:** `shoptet`, `dataLayer` i `screen` jsou v prohlížeči vždy definované — kontrolu vynech.
- **Pozn.:** Seznam „vždy definovaných" Shoptet objektů je tentýž jako deklarace Shoptet globálů pro ESLint `no-undef` v D1 — udržuj jako jeden sdílený zdroj. Konkrétní výčet (`shoptet.*` namespaces, `dataLayer`, `getShoptetDataLayer`, jQuery) → `shoptet-reference.md` §2.

### B5 — Lifecycle / race conditions
- **ID:** B5
- **Severity:** ❌/⚠️ podmíněné (viz Gate)
- **Vlastník:** AI
- **Nástroj:** —
- **Gate:** ❌ když kód reálně závisí na `setTimeout` hacku nebo způsobuje chyby ze souběhu / dvojí spuštění; ⚠️ jinak (preventivní úklid bez prokázaného dopadu).
- **Problém:** Inicializace obchází životní cyklus přes `setTimeout(fn, 0)`, kód běží dřív, než je jádro připravené; míchané listenery na `DOMContentLoaded` a `ShoptetDOMContentLoaded`.
- **Proč:** Náhodné chyby ze souběhu, dvojí spuštění.
- **Řešení:** Inicializuj v `ShoptetDOMContentLoaded` (obecný event — spustí se i pro obsah donačtený AJAXem), ne přes `setTimeout`/polling. Specifické varianty: `ShoptetDOMPageContentLoaded` (stránkování/filtry), `ShoptetDOMCartContentLoaded` (košík) — viz `shoptet-reference.md` §4.
- **Pozn. (falešná domněnka — NENÍ nález):** „Globál/core může být `undefined`, protože nedoběhl Shoptet skript nebo jsou skripty špatně řazené" **není nález.** Shoptet garantuje, že v době běhu doplňku jsou globály i core připravené (`shoptet`, `shoptet.*`, `getShoptetDataLayer`, `dataLayer`, `$`/`jQuery` — reference §2; footer bundle běží po jádru — §5). Nenavrhuj guardy proti undefined ani nevaruj o pořadí skriptů. Rozliš *globál je připravený* (garantováno → domněnka, mlč) od *DOM/obsah ještě není* (reálné → B5). **Reálné B5 zavádí sám kód doplňku:** `setTimeout(fn,0)` hack, init v parse-time místo v lifecycle eventu, dvojí bind, a čtení **obsahu/DOMu, který je až po AJAX update eventu** (košík/filtry/stránkování — §4). Pozor i na sousední (ne-B5) případ: **dataLayer klíče vázané na typ stránky** (`product` jen na `productDetail`) čtené jinde jsou reálný problém — ale to je **B1** (dostupnost dat), ne „globál undefined".

### B6 — Nepřepisovat / využít Shoptet core
- **ID:** B6
- **Severity:** ❌/⚠️ podmíněné (viz Gate)
- **Vlastník:** AI
- **Nástroj:** —
- **Gate:** Překryv s core (`shoptet-reference.md` §3) je **nutná, ne postačující** podmínka. ❌ jen u **zjevné duplikace** (partnerova verze nepřináší nic navíc oproti core) nebo **přepisu/override core funkce**. ⚠️/❓ při pouhém překryvu kategorie — partner má vlastní slider/modal apod., ale dělá něco navíc; to **neblokuje** (řada partnerů legitimně potřebuje upravenou verzi).
- **Problém:** Doplněk si píše vlastní implementaci toho, co Shoptet už má, nebo přímo přepisuje core funkce (`initColorBox`, funkce z `templates-assets`).
- **Proč:** Rozbije se při aktualizaci jádra, kolize s ostatními.
- **Řešení:** Využij existující řešení (např. `colorbox`, který už v Shoptetu je); core funkce nepřepisuj, pokud pro to není opravdový důvod.
- **Pozn.:** Seznam funkcionality, kterou Shoptet už dodává (a nemá se reimplementovat) → `shoptet-reference.md` §3.

### B7 — Zákaz data-testid selektorů
- **ID:** B7
- **Severity:** ❌ blokující
- **Vlastník:** Oba
- **Nástroj:** custom ESLint `no-restricted-syntax` / grep na `data-testid`
- **Problém:** Doplněk se váže na atributy `data-testid` (čtení i zápis).
- **Proč:** „Negarantujeme jejich stabilitu, kdykoli je můžeme z produkce odstranit."
- **Řešení:** Vázat se na běžné CSS třídy, ne na testovací atributy.
- **Pozn.:** `no-restricted-syntax` chytí statické výskyty; AI dořeší dynamicky skládané selektory.

### B8 — Side-efekty / izolace doplňku
- **ID:** B8
- **Severity:** ❌ blokující
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Doplněk ovlivňuje prvky mimo sebe — selektor zasáhne cizí elementy, globálně se spouští `resize` event.
- **Proč:** Rozbíjí e-shop a ostatní doplňky.
- **Řešení:** Všechny selektory zužuj na vlastní kontejner doplňku, eventy a změny drž v jeho rozsahu.

---

# C. Struktura a architektura kódu

### C1 — Monolit → rozdělení do modulů
- **ID:** C1
- **Severity:** ❌/⚠️ podmíněné (viz Gate)
- **Vlastník:** Oba
- **Nástroj:** ESLint `max-lines`, `max-lines-per-function` (řádkový práh vynucuje linter)
- **Gate:** Rozliš kvalitu od kvantity — blokuje nereviewovatelnost, ne délka.
  - ❌ blokuje jen u **nereviewovatelného monolitu**: jeden soubor / jedna funkce mísí nesouvisející odpovědnosti (parsování + generování HTML + slider + resize…) tak, že kód nejde rozumně projít ani bezpečně změnit.
  - ⚠️ u **pouhé délky**: soubor je dlouhý, ale logika je soudržná a čitelná. Délka sama o sobě neblokuje.
  - Pracovní hranice pro ⚠️: ~400 ř. na soubor / ~80 ř. na funkci (orientační, kalibruj z eval sady — není to tvrdý blok). Počítání řádků patří linteru přes `max-lines`; AI řeší ten kvalitativní monolit, ne počet řádků.
- **Problém:** Veškerá logika v jednom obrovském souboru s promíchanými odpovědnostmi (typicky i jedna funkce o stovkách řádků).
- **Proč:** Menší, soudržné celky se lépe kontrolují, udržují a testují. Blokuje se promíchání a nereviewovatelnost, ne délka jako taková.
- **Řešení:** Rozděl do logických ES modulů podle odpovědnosti a importuj do jednoho vstupního bodu.

### C2 — Refactoring / menší metody
- **ID:** C2
- **Severity:** ⚠️ doporučené
- **Vlastník:** Oba
- **Nástroj:** ESLint `complexity`, `max-statements`
- **Problém:** Jedna funkce dělá příliš mnoho (parsování, generování HTML/CSS, slider, resize…), „switch hell", složité větvení.
- **Proč:** Velké funkce s mnoha odpovědnostmi se špatně čtou, testují i ladí.
- **Řešení:** Rozsekej na menší pojmenované metody, použij early returns; pro mnoho variant konfigurační objekt místo `switch`.
- **Náhrada kódu:**
  ```js
  async render() {
    if (!this.isValidPage()) return;
    const html = await this.fetchHtml(this.getProductCode(), this.getSettings());
    this.insert(this.getDestination(), this.wrap(html));
  }
  ```

### C3 — Duplicita / DRY
- **ID:** C3
- **Severity:** ❌/⚠️ podmíněné (viz Gate)
- **Vlastník:** Oba
- **Nástroj:** jscpd / SonarJS `sonarjs/no-identical-functions` — **ne core ESLint**
- **Gate:** ❌ když je duplikovaná netriviální logika (riziko, že se oprava/bezpečnostní fix provede jen na jednom místě); ⚠️ jinak (drobné opakování, čistě kosmetické zjednodušení).
- **Problém:** Skoro identické funkce, opakovaný blok kódu, stejný selektor na desítkách míst, stejná podmínka ve více funkcích.
- **Proč:** Opravu/změnu pak musíš dělat na více místech a snadno na některé zapomeneš.
- **Řešení:** Sjednoť do jedné funkce (případně s parametrem), opakovaný kód do helperu, opakovaný selektor/hodnotu do `const`, společnou podmínku vytáhni nahoru.

### C4 — Zanořené IFy / cykly
- **ID:** C4
- **Severity:** ❌ blokující
- **Vlastník:** Oba
- **Nástroj:** ESLint `max-depth`, `max-nested-callbacks`
- **Problém:** Hluboké vnoření, `.each` v `.each`, „pyramidy hrůzy" / callback hell.
- **Proč:** Zhoršuje čitelnost i výkon a zvyšuje riziko chyb.
- **Řešení:** Zploštit — `async/await`, ternární operátory, jQuery `filter`/`find`, brzké returny.

### C5 — Umístění / scope / deklarace
- **ID:** C5
- **Severity:** ⚠️ doporučené
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Funkce zbytečně definovaná uvnitř jiné, deklarace proměnných roztroušené, kód v cyklu, který tam nepatří.
- **Proč:** Zbytečně velký scope a roztroušené deklarace komplikují pochopení toku kódu (a kód v cyklu zbytečně běží opakovaně).
- **Řešení:** Funkci nezávislou na vnitřním stavu definuj vně; deklarace na začátek funkce; invariantní kód vytáhni mimo cyklus.

### C6 — ES6 třídy / struktura objektů
- **ID:** C6
- **Severity:** ⚠️ doporučené
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Zavádějící „objekt", který supluje třídu.
- **Proč:** Pseudo-objekt zastírá skutečnou strukturu; třída s privátními metodami je čitelnější a lépe zapouzdřená.
- **Řešení:** Použij skutečnou ES6 třídu s privátními metodami, nebo čistý konfigurační objekt.

---

# D. Rozsah proměnných a závislosti

### D1 — Globální → blokové proměnné
- **ID:** D1
- **Severity:** ❌ blokující
- **Vlastník:** Linter
- **Nástroj:** ESLint `no-var`, `no-undef`, `no-implicit-globals`
- **Problém:** Plošné globální proměnné, `var`.
- **Proč:** Kolize s jinými doplňky a e-shopem.
- **Řešení:** `const`/`let`, nikdy `var`; doplň chybějící deklarace.
- **Pozn.:** `no-undef` bude hlásit `getShoptetDataLayer()`, `shoptet.*` apod. jako chybu, dokud v ESLint configu nedeklaruješ seznam Shoptet globálů (`languageOptions.globals`). Bez něj dostaneš lavinu false-positives. Tento seznam je jeden sdílený zdroj pro D1 (povolený globál) i B4 (vždy definované).

### D2 — const místo let
- **ID:** D2
- **Severity:** ⚠️ doporučené
- **Vlastník:** Linter
- **Nástroj:** ESLint `prefer-const`
- **Problém:** `let` u hodnoty, která se nemění.
- **Proč:** `const` dává najevo, že se hodnota nemění, a chrání před nechtěným přepsáním.
- **Řešení:** Co se nepřiřazuje znovu, deklaruj jako `const`.

### D3 — Předávání závislostí: parametr místo window
- **ID:** D3
- **Severity:** ⚠️ doporučené
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Hodnoty/elementy se sdílí přes `window` nebo globál.
- **Proč:** Vzniká skrytá závislost a riziko kolize; parametr je explicitní a lépe testovatelný.
- **Řešení:** Předávej je funkci jako parametr; element, který už byl nalezen, posílej dál, nehledej znovu.

### D4 — Namespace / prefix / kolize
- **ID:** D4
- **Severity:** ❌ blokující
- **Vlastník:** Oba
- **Nástroj:** custom ESLint pravidlo (jediný povolený prefix z `package.json`)
- **Problém:** Obecné názvy proměnných, `localStorage` klíčů a `id` elementů.
- **Proč:** Pád jiných doplňků nebo e-shopu.
- **Řešení:** Zabal do namespace a dej unikátní prefix (např. `elevate_`) na proměnné, `localStorage` klíče i `id`; nepoužívej jméno autora v názvech. Jediný povolený prefix se odvozuje z `package.json` a vynucuje ho custom ESLint pravidlo (deterministicky); AI posoudí kvalitu zbytku názvu.

---

# E. JavaScript — best practices

### E1 — Template literals / DOM API místo skládání stringů
- **ID:** E1
- **Severity:** ❌ blokující
- **Vlastník:** Oba
- **Nástroj:** ESLint `prefer-template`
- **Problém:** HTML se skládá `'<div class="' + x + '">'`.
- **Proč:** Konkatenace je nečitelná a náchylná k chybám i XSS.
- **Řešení:** Template literals (backticky) nebo DOM API; string skládej a přiřaď jednou, ne opakovaně.
- **Pozn. (překryv s A1):** Když konkatenace míchá do HTML **data z API / konfigurace / uživatele**, nejde jen o styl — je to **XSS a řeší se jako A1 (blokující)**. E1 samotné je ❌ za formu; jakmile jsou v řetězci neošetřená data, eskaluj na A1.

### E2 — Moderní JS
- **ID:** E2
- **Severity:** ⚠️ doporučené
- **Vlastník:** Oba
- **Nástroj:** ESLint plugin `eslint-plugin-unicorn`
- **Problém:** Zastaralé konstrukce (`XMLHttpRequest`, ruční smyčky).
- **Proč:** Jsou upovídanější, hůř čitelné a náchylnější k chybám než moderní ekvivalenty.
- **Řešení:** `fetch` + `async/await`, `forEach`/`map`, `clone` kde dává smysl.
- **Náhrada kódu:**
  ```js
  async function load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }
  ```

### E3 — jQuery idiomy
- **ID:** E3
- **Severity:** ⚠️ doporučené
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Opakované `$(this)`, zbytečný `.detach()`, `filter` tam, kde stačí `find`.
- **Proč:** Opakované dotazy do DOMu zbytečně zatěžují výkon a zhoršují čitelnost.
- **Řešení:** Cachuj `const $this = $(this);`, používej `find`, zbytečné volání odstraň.

### E4 — Strict equality ===
- **ID:** E4
- **Severity:** ❌ blokující
- **Vlastník:** Linter
- **Nástroj:** ESLint `eqeqeq`
- **Problém:** Loose equality `==`.
- **Proč:** `==` provádí implicitní konverzi typů a vede k těžko odhalitelným chybám.
- **Řešení:** Vždy `===` / `!==`.

### E5 — Debounce / throttle
- **ID:** E5
- **Severity:** 💡 tip
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Náročný handler na častém eventu (`resize`, `scroll`).
- **Proč:** Handler se volá mnohokrát za sekundu a zbytečně zatěžuje prohlížeč (sekání).
- **Řešení:** Obal do `debounce`/`throttle`.

### E6 — Event listenery
- **ID:** E6
- **Severity:** ⚠️ doporučené
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Listenery se přidávají opakovaně bez odebrání; zbytečná kombinace více eventů.
- **Proč:** Neodebrané listenery se hromadí (memory leak, vícenásobné spuštění handleru).
- **Řešení:** Před přidáním odeber starý listener; často stačí jen `click` (spouští se i na mobilu); klik na overlay detekuj přímo na overlay.
- **Náhrada kódu:**
  ```js
  if (resizeListener) window.removeEventListener('resize', resizeListener);
  resizeListener = debounce(handleResize, 150);
  window.addEventListener('resize', resizeListener);
  ```

### E7 — localStorage v try/catch
- **ID:** E7
- **Severity:** ⚠️ doporučené
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Práce s `localStorage` bez ošetření (může vyhodit výjimku, být plné/zakázané).
- **Proč:** V privátním režimu / při plné kvótě `localStorage` vyhodí výjimku a shodí celý skript.
- **Řešení:** Obal do `try/catch`; neukládej klíče, které se nikde nečtou.

### E8 — Error handling / response.ok
- **ID:** E8
- **Severity:** ⚠️ doporučené
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** `fetch` bez kontroly stavu, chybějící `try/catch`.
- **Proč:** Bez kontroly stavu a chyb selže `fetch` tiše a doplněk se chová nepředvídatelně.
- **Řešení:** Kontroluj `response.ok`, ošetři chyby.

### E9 — Drobné JS opravy / redundance
- **ID:** E9
- **Severity:** 💡 tip
- **Vlastník:** Oba
- **Nástroj:** ESLint `radix`, `no-extra-boolean-cast`
- **Problém:** `parseInt` bez radixu, redundantní `.trim()` / převody na string, zbytečné `> 0`, nadbytečný `/gi` flag.
- **Proč:** Drobnosti samy o sobě nevadí, ale dohromady zhoršují čitelnost a občas skrývají chybu (např. `parseInt` bez radixu).
- **Řešení:** `parseInt(x, 10)`; odstraň redundance; `/gi` netřeba u lowercase textu.

### E10 — Magic constants
- **ID:** E10
- **Severity:** ⚠️ doporučené
- **Vlastník:** Oba
- **Nástroj:** ESLint `no-magic-numbers`
- **Problém:** Natvrdo čísla (`3600000`), URL, názvy šablon, HTTP statusy v kódu.
- **Proč:** Nepojmenované hodnoty jsou nesrozumitelné a při změně se musí dohledávat po celém kódu.
- **Řešení:** Vytáhni do pojmenovaných konstant / konfigurace.
- **Pozn.:** `no-magic-numbers` flaguje kandidáty, AI rozhodne, co je opravdu „magické".

### E11 — Konzistence / pojmenování
- **ID:** E11
- **Severity:** 💡 tip
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Nekonzistentní hodnoty (`Math.min(3` vs jinde jiné), zavádějící názvy funkcí (`render`, která nic nerenderuje), `element` parametr, který je ve skutečnosti selector.
- **Proč:** Zavádějící názvy a nekonzistence matou a zvyšují riziko chyb při úpravách.
- **Řešení:** Sjednoť hodnoty; název ať odpovídá tomu, co funkce/parametr dělá (`shouldRender`, `selector`).

---

# F. Čistota produkčního kódu

### F1 — Odstranit zakomentovaný kód
- **ID:** F1
- **Severity:** ❌ blokující
- **Vlastník:** Oba
- **Nástroj:** SonarJS `sonarjs/no-commented-code` (plugin)
- **Problém:** Zakomentované bloky kódu v produkci.
- **Proč:** Mrtvý kód mate čtenáře, zbytečně zvětšuje soubor a nikdo neví, jestli ještě platí.
- **Řešení:** Smazat. Historie je v gitu.

### F2 — Nepoužívaný / mrtvý kód a soubory
- **ID:** F2
- **Severity:** ❌ blokující
- **Vlastník:** Oba
- **Nástroj:** ESLint `no-unused-vars` (proměnné) + knip / ts-prune (soubory)
- **Problém:** Nepoužívané proměnné (`index`, který se nečte), nebuildované soubory, nepotřebné složky.
- **Proč:** Zvyšuje velikost a údržbu kódu a svádí k omylům (co se používá a co ne).
- **Řešení:** Odstranit vše, co se nevyužívá.

### F3 — console.log / debug v produkci
- **ID:** F3
- **Severity:** ❌/⚠️ podmíněné (viz Gate)
- **Vlastník:** Linter
- **Nástroj:** ESLint `no-console`
- **Gate:** ❌ když se `console`/debug dostane do produkčního buildu; ⚠️ jen u dev nástrojů odděleně izolovaných za `dev` ENV (do produkce se nedostanou).
- **Problém:** Výpisy do konzole, debug metody (200+ řádků, které klient nevyužije).
- **Proč:** Zatěžují konzoli i výkon prohlížeče koncového uživatele a mohou vyzradit interní informace.
- **Řešení:** Odstranit; debug nástroje vyčlenit do modulu povoleného jen pod `dev` ENV (produkční build běží s `production`).

### F4 — Logování chyb přes Sentry
- **ID:** F4
- **Severity:** ⚠️ doporučené
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Chyby se logují do konzole koncového uživatele.
- **Proč:** Do konzole uživatele nevidíš — o reálných chybách se nedozvíš, navíc ho to zatěžuje.
- **Řešení:** Použij řešení, které nezatěžuje uživatele — např. Sentry.

### F5 — Prázdné / dummy soubory, dev pozůstatky
- **ID:** F5
- **Severity:** ❌/⚠️ podmíněné (viz Gate)
- **Vlastník:** Oba
- **Nástroj:** CI/skript (`.gitignore`, dist, prázdné soubory) — **ne ESLint**
- **Gate:** ❌ když se do PR/produkce dostanou dev buildy nebo `dist` (riziko nasazení dev kódu); ⚠️ u prázdných/dummy souborů bez funkčního dopadu (úklid).
- **Problém:** Prázdné soubory, `dist` ve verzování, dev buildy, pozůstatky lokálního vývoje
  (např. prázdný `yarn.lock` pozůstatek vedle reálného lockfilu → viz i F6).
- **Proč:** Plní repo nepotřebným obsahem, zhoršují přehlednost a do produkce by se mohl dostat dev build.
- **Řešení:** `dist` ani dev buildy nepatří do PR; přepni na produkční build; smaž prázdné/dummy soubory.

### F6 — Balíčky / lock soubory
- **ID:** F6
- **Severity:** 💡 tip
- **Vlastník:** Oba
- **Nástroj:** depcheck — **ne ESLint**
- **Problém:** Nepoužívané npm balíčky; **víc než jeden lockfile různých správců** v repu —
  `package-lock.json` (npm), `yarn.lock` (yarn), `pnpm-lock.yaml` (pnpm), `bun.lockb`/`bun.lock` (bun).
  **Počítá se i prázdný / pozůstatkový lockfile** jiného správce, ne jen dvojice npm+yarn.
- **Proč:** Dva lockfily vedou k nekonzistentním instalacím; a nástroje/CI/`corepack` vybírají
  správce podle **přítomnosti** souboru — takže i prázdný `yarn.lock` vedle `pnpm-lock.yaml` může
  build přesměrovat na špatného správce. Nepoužité balíčky zbytečně nafukují závislosti.
- **Řešení:** Nech lockfile **jednoho** správce; ostatní (i prázdné) smaž. Odstraň nepoužívané
  závislosti. Prázdný lockfile je zároveň prázdný soubor → projeď i optikou F5.

---

# G. Build, tooling a soubory

### G1 — Minifikace
- **ID:** G1
- **Severity:** ❌ blokující
- **Vlastník:** Oba
- **Nástroj:** CI/build kontrola výstupu — **ne ESLint**
- **Problém:** Produkční kód není minifikovaný (i když to název kroku slibuje).
- **Proč:** Uživatel stahuje zbytečně velký kód.
- **Řešení:** Zapni reálnou minifikaci, případně použij build step z boilerplate.

### G2 — Build / webpack / vendor
- **ID:** G2
- **Severity:** ⚠️ doporučené
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Knihovny třetích stran (Fancybox, Splide) smíchané s vlastním kódem; obfuscator i přes vyjmuté názvy funkcí.
- **Proč:** Smíchaný vendor kód brání cachování a tree-shakingu a komplikuje review vlastního kódu.
- **Řešení:** Vendor knihovny do samostatných souborů; pro dev/prod přepínání `DefinePlugin`; měj na paměti tree-shaking.

### G3 — ES moduly / build nezávislý na pořadí
- **ID:** G3
- **Severity:** ❌ blokující
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Build závisí na názvech a pořadí souborů (např. `01-settings.js`, `02-…`); SCSS natahuje partial i index soubory dvakrát.
- **Proč:** Závislost na pořadí je křehká — přejmenování nebo přidání souboru build rozbije.
- **Řešení:** Přepiš na `import`/ES moduly — init funkce se volá explicitně, ne přes pořadí ani `window`; sjednoť SCSS importy.

### G4 — CI workflow / branch konfigurace
- **ID:** G4
- **Severity:** ❌ blokující
- **Vlastník:** Oba
- **Nástroj:** actionlint / CI validace — **ne ESLint**
- **Problém:** Chybí/špatně nastavený GitHub workflow file pro deploy; repo má `master`, ale konfigurace počítá jen s `main`.
- **Proč:** Bez správné konfigurace se doplněk nenasadí (deploy běží jen z očekávané větve).
- **Řešení:** Doplň workflow file; do konfigurace přidej `master` i `main`; deploy se spouští přes Actions z hlavní větve.

### G5 — Assety / fonty / CDN / obrázky
- **ID:** G5
- **Severity:** ⚠️ doporučené
- **Vlastník:** Oba
- **Nástroj:** stylelint (CSS `url()`) + custom grep na absolutní URL
- **Problém:** Absolutní URL na CDN vývojáře (`$asset`), fonty/obrázky mimo assety, chybějící atributy obrázků.
- **Proč:** Cizí CDN je mimo kontrolu Shoptetu (dostupnost, bezpečnost, GDPR) a může kdykoli vypadnout.
- **Řešení:** Soubory měj mezi assety, ne na cizí CDN; doplň `srcset`/`poster` kde dává smysl.

### G6 — Cache / výkon
- **ID:** G6
- **Severity:** ⚠️ doporučené
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Dotazování na obrázky/bannery, které nejsou v cache; obcházení cachování stylů; `find` uvnitř `map` při velkém počtu položek (v košíku mohou být desetitisíce).
- **Proč:** Zbytečné dotazy a obcházení cache zpomalují e-shop; u velkých kolekcí to znatelně zatíží prohlížeč.
- **Řešení:** Nedotazuj se na necachované zdroje, neobcházej cache, optimalizuj vyhledávání ve velkých kolekcích.

---

# H. CSS / vizuál

### H1 — CSS jednotky, z-index, media query, styly
- **ID:** H1
- **Severity:** ⚠️/💡 (neblokuje)
- **Vlastník:** Oba
- **Nástroj:** stylelint — **ne ESLint**
- **Problém:** `pt` místo `px`, zbytečný `z-index` na více třídách, `width` na `display:none`, přepis globálních stylů.
- **Proč:** Nekonzistentní jednotky a přepis globálních stylů rozbíjí vzhled e-shopu i ostatních prvků.
- **Řešení:** Konzistentní `px`; `z-index` jen tam, kde je potřeba; nepřepisuj globální styly e-shopu; část logiky řeš CSS třídou místo inline stylů.

### H2 — Deprecated HTML/CSS
- **ID:** H2
- **Severity:** ⚠️ doporučené
- **Vlastník:** Linter
- **Nástroj:** stylelint / htmlhint — **ne ESLint**
- **Problém:** Zastaralé tagy (`<big>`).
- **Proč:** Deprecated tagy nemusí prohlížeče do budoucna podporovat a nejsou sémantické.
- **Řešení:** Nahraď třídou (`<span class="text-lg">`).

### H3 — Velikost písma
- **ID:** H3
- **Severity:** 💡 tip
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Příliš malé písmo (11px).
- **Proč:** Špatně se čte a zhoršuje přístupnost.
- **Řešení:** Počítej s tím, že Shoptet velikosti písem zvětšuje — drž čitelné minimum.

---

# I. Lokalizace a pojmenování

### I1 — Komentáře a identifikátory v angličtině
- **ID:** I1
- **Severity:** ❌ blokující
- **Vlastník:** AI
- **Nástroj:** —
- **Problém:** Čeština/slovenština v komentářích a názvech.
- **Proč:** Kód čtou i vývojáři, kteří česky neumí; angličtina je standardní konvence a usnadňuje údržbu.
- **Řešení:** Veškeré komentáře i identifikátory anglicky. Pozor: někdy jsou české komentáře navíc zavádějící (popisují neexistující proměnné).

### I2 — Překlady / jazykové mutace
- **ID:** I2
- **Severity:** ❌/⚠️ podmíněné (viz Gate)
- **Vlastník:** AI
- **Nástroj:** —
- **Gate:** ❌ když má být doplněk vícejazyčný a obsah to znemožňuje, nebo špatný ISO kód láme funkci; ⚠️ u jednojazyčného doplňku (oddělení překladů je pak doporučení).
- **Problém:** Texty zadrátované v kódu, jen jeden jazyk, špatné ISO kódy.
- **Proč:** Zadrátované texty znemožňují vícejazyčnost a míchají obsah s logikou (každá změna textu = zásah do kódu).
- **Řešení:** Překlady do samostatného souboru (odděl obsah od logiky), počítej s vícejazyčností, správné ISO kódy (Slovinsko = `sl`); chybějící přeložené texty (i v `aria-label`) doplň.

### I3 — Naming konvence + smysluplné názvy
- **ID:** I3
- **Severity:** ⚠️ doporučené
- **Vlastník:** Oba
- **Nástroj:** ESLint `id-length`, `camelcase` (styl/délka)
- **Problém:** Nicneříkající názvy (`x`, `v`, `m`, `cnt`, `ifr`), snake_case v JS, zbytečné prefixy/suffixy (`prw`), jméno autora v názvech.
- **Proč:** Nicneříkající názvy nutí čtenáře dohledávat význam a zvyšují chybovost při úpravách.
- **Řešení:** Smysluplné názvy (`activeVideo`, `currentContent`, `imageMap`), camelCase, prefixy jen kde je třeba (namespace), nepoužívej jméno autora.
- **Pozn.:** `id-length`/`camelcase` chytnou délku a styl; smysluplnost posoudí AI.

### I4 — Formát ceny / čísla
- **ID:** I4
- **Severity:** ❌/⚠️ podmíněné (viz Gate)
- **Vlastník:** AI
- **Nástroj:** —
- **Gate:** ❌ když chybné parsování vede k chybné částce / rozbité funkci; ⚠️ u čistě kosmetického formátování bez dopadu na výpočet.
- **Problém:** Parsování ceny předpokládá jeden formát.
- **Proč:** Mezinárodní formáty (`1.234,50`, `1,234.50$`, `1 500 Kč`) se rozbijí.
- **Řešení:** Formátování přebírej od e-shopu / parsuj robustně napříč formáty.

---

# J. Přístupnost

### J1 — Sémantické tagy
- **ID:** J1
- **Severity:** ❌/⚠️ podmíněné (viz Gate)
- **Vlastník:** Oba
- **Nástroj:** runtime (axe nad vyrenderovaným DOMem, zatím mimo scope)
- **Gate:** ❌ když je interaktivní prvek nepřístupný (klikací `<div>` bez role/klávesnicové obsluhy = porušení WCAG); ⚠️ u čistě sémantického vylepšení (`<h4>` místo `<div>`) bez dopadu na ovládání.
- **Problém:** Klikací `<div>` místo `<button>`, vizuální nadpis jako `<div>` místo `<h4>`, prázdný `<div>` bez role/tabindex/aria.
- **Proč:** Bez sémantických tagů prvek nerozpozná čtečka ani klávesnice — nepřístupné a horší SEO.
- **Řešení:** Akce = `<button>`; nadpis = `<hX>` (čtečka pozná strukturu); interaktivní prvek musí mít roli/tabindex/aria.
- **Pozn.:** AI dělá statický best-effort; `eslint-plugin-jsx-a11y` na HTML stringech nezabere; reálně axe runtime nad vyrenderovaným DOMem.

### J2 — Čtečky / aria / WCAG
- **ID:** J2
- **Severity:** ❌/⚠️ podmíněné (viz Gate)
- **Vlastník:** Oba
- **Nástroj:** runtime (axe nad vyrenderovaným DOMem, zatím mimo scope)
- **Gate:** ❌ když informace nebo ovládání není pro čtečky/klávesnici vůbec dostupné (porušení WCAG úrovně A — např. autoplay bez pause, kritická informace jen vizuálně); ⚠️ u drobných vylepšení aria/popisků.
- **Problém:** Informace jen vizuálně (unicode hvězdičky), chybějící `aria-label`, autoplay bez pause.
- **Proč:** Uživatelé čteček se jinak nedostanou k informaci (např. hodnocení) ani neovládnou prvek (autoplay).
- **Řešení:** Skrytý text pro čtečky (`sr-only`) s číselnou hodnotou; `aria-label` s překladem; u autoplay vizuálně skryté pause tlačítko (WCAG 2.2.2, technika G4); `onblur` validace není přístupná a nedisabluj submit.
- **Pozn.:** Axe runtime odhalí chybějící `aria-label`, kontrast ap.; AI dělá statický best-effort a část ze statického HTML stringu nezachytí.
