# Příručka pro code review Shoptet doplňků

Praktický průvodce odvozený z reálných review připomínek. U každého bodu je **Problém**, **Proč to vadí** a **Řešení**. Cílem je, aby PR prošel bez....

## Jak značit závažnost
| Značka | Význam | Co s tím |
|--------|--------|----------|
| ❌ | **blokující** | bez opravy se doplněk neschválí |
| ⚠️ | velmi doporučené | opravit, pokud není pádný důvod ne |
| 💡 | tip / nice-to-have | dle uvážení, návrh zlepšení kvality nebo začištění kódu |
| ❓ | dotaz | reviewer si není jistý záměrem — vysvětlit nebo opravit |

---

# A. Bezpečnost

## A1. XSS / nebezpečné vkládání HTML  ❌
**Problém:** Data (z API, konfigurace, uživatele) se vkládají do DOM bez ošetření — `element.innerHTML = data`, `JSON.stringify` přímo do HTML, `.replace()` nad HTML stringem.
**Proč:** Útočník může vložit `<script>`/`onerror` a spustit cizí kód na e-shopu. Nejčastější blokující problém vůbec.
**Řešení:**
- Tam, kde stačí text, použij `textContent` místo `innerHTML`.
- Pokud musíš vkládat HTML, sanitizuj (allowlist tagů/atributů) nebo skládej přes DOM API (`document.createElement`, `el.append(...)`).
- V případě potřeby použít DOMPurify.
- Vytvoř si jeden „builder" element a vkládej hodnoty jako text, ne konkatenací stringů.

## A2. Kontrola / validace vstupních parametrů  ❌/⚠️
**Problém:** Funkce nepočítá s prázdným/chybějícím vstupem (`undefined`, prázdné video, chybějící URL).
**Řešení:** Guard na začátku + výchozí hodnoty parametrů.
```js
function createMp4Slide(url = '') {
  if (!url) return '';
  // ...
}
function getYoutubeId(url = '') { /* ... */ }
```

## A3. Mutace vstupů / oddělení vstupu od stavu  ❌
**Problém:** Funkce přepisuje svůj vstupní parametr; jedna proměnná slouží zároveň jako uživatelský vstup i jako interní stav.
**Proč:** Nečekané vedlejší efekty, těžko se ladí.
**Řešení:** Udělej si lokální kopii (`const local = {...input}`) a drž oddělené proměnné pro vstup a interní stav.

## A4. Citlivá data v kódu  ❌
**Problém:** Token / API klíč viditelný v produkčním (klientském) kódu.
**Proč:** Klientský kód si přečte kdokoli.
**Řešení:** Ověř, že token opravdu může být veřejný (např. je vázaný na origin/eshop). Jinak ho vydávej z backendu s kontrolou původu requestu.

## A5. Externí odkazy `target="_blank"`  ⚠️
**Problém:** Odkaz do nového okna bez `rel`.
**Řešení:** Vždy `rel="noopener noreferrer"` (ochrana proti `window.opener` útoku).

---

# B. Integrace se Shoptetem

## B1. Čtení dat přes dataLayer / oficiální API  ❌/⚠️
**Problém:** Doplněk si jazyk, typ stránky, kód produktu apod. zjišťuje vlastní cestou (parsování DOMu, hardcoded hodnoty).
**Řešení:** Používej `getShoptetDataLayer()`:
```js
const lang = getShoptetDataLayer('language');
const isProduct = getShoptetDataLayer('pageType') === 'productDetail';
const { product } = getShoptetDataLayer();
const code = product?.code || product?.codes?.[0]?.code || null;
```
Pro číselné identifikátory typů použij `shoptet.abilities.about.id` místo mapování na class name.

## B2. Breakpointy ze Shoptetu  ⚠️
**Problém:** Vlastní/náhodné breakpointy (např. `550px`, `767px`), které nesedí se šablonou.
**Řešení:** Čti z `shoptet.config.breakpoints`, případně použij oficiální hodnoty:
- **min-width:** xs `480`, sm `768`, md `992`, lg `1200`, xl `1440`
- **max-width:** xs `479`, sm `767`, md `991`, lg `1199`, xl `1439`

## B3. Konfigurace přes Shoptet API místo generování  ⚠️
**Problém:** Doplněk nutí uživatele generovat/vkládat konfiguraci ručně.
**Řešení:** Nastavení vkládej přes API (inline JSON do hlavičky), v kódu ho jen čteš:
```js
const myAddonConfig = { eshopSpecificData: /* … */ };
// → v kódu: myAddonConfig.eshopSpecificData
```

## B4. Zbytečné kontroly Shoptet objektů  ⚠️
**Problém:** Defenzivní kontroly nad objekty, které jsou vždy dostupné (`shoptet`, `screen`, `dataLayer`).
**Řešení:** `shoptet`, `dataLayer` i `screen` jsou v prohlížeči vždy definované — kontrolu vynech.

## B5. Lifecycle / race conditions  ❌/⚠️
**Problém:** Inicializace obchází životní cyklus přes `setTimeout(fn, 0)`, kód běží dřív, než je jádro připravené; míchané listenery na `DOMContentLoaded` a `ShoptetDOMContentLoaded`.
**Proč:** Náhodné chyby ze souběhu, dvojí spuštění.
**Řešení:** Inicializuj v `ShoptetDOMContentLoaded`, nepoužívej `setTimeout` hacky. Sjednoť, kdy co běží.

## B6. Nepřepisovat / využít Shoptet core  ❌/⚠️
**Problém:** Doplněk si píše vlastní implementaci toho, co Shoptet už má, nebo přímo přepisuje core funkce (`initColorBox`, funkce z `templates-assets`).
**Proč:** Rozbije se při aktualizaci jádra, kolize s ostatními.
**Řešení:** Využij existující řešení (např. `colorbox`, který už v Shoptetu je). Core funkce nepřepisuj, pokud pro to není opravdový důvod.

## B7. Zákaz `data-testid` selektorů  ❌
**Problém:** Doplněk se váže na atributy `data-testid` (čtení i zápis).
**Proč:** *„Negarantujeme jejich stabilitu, kdykoli je můžeme z produkce odstranit.
**Řešení:** Vázat se na běžné CSS třídy, ne na testovací atributy.

## B8. Side-efekty / izolace doplňku  ❌
**Problém:** Doplněk ovlivňuje prvky mimo sebe — selektor zasáhne cizí elementy, globálně se spouští `resize` event.
**Proč:** Rozbíjí e-shop a ostatní doplňky.
**Řešení:** Všechny selektory zužuj na vlastní kontejner doplňku, eventy a změny drž v jeho rozsahu.

---

# C. Struktura a architektura kódu

## C1. Monolit → rozdělení do modulů  ❌/⚠️
**Problém:** Veškerá logika v jednom obrovském souboru (i funkce o 400 řádcích).
**Proč:** Chceme držet logiku v menších a přehlednějších celcích, které se budou lépe kontrolovat, udržovat, příp.testovat. Chceme zavést maximální velikost souboru na 200 řádků.
**Řešení:** Rozděl do logických ES modulů a importuj do jednoho vstupního bodu.

## C2. Refactoring / menší metody  ⚠️
**Problém:** Jedna funkce dělá příliš mnoho (parsování, generování HTML/CSS, slider, resize…), „switch hell", složité větvení.
**Řešení:** Rozsekej na menší pojmenované metody, použij early returns:
```js
async render() {
  if (!this.isValidPage()) return;
  const html = await this.fetchHtml(this.getProductCode(), this.getSettings());
  this.insert(this.getDestination(), this.wrap(html));
}
```
Pro mnoho variant místo `switch` použij konfigurační objekt.

## C3. Duplicita / DRY  ❌/⚠️
**Problém:** Skoro identické funkce, opakovaný blok kódu, stejný selektor na desítkách míst, stejná podmínka ve více funkcích.
**Řešení:** Sjednoť do jedné funkce (případně s parametrem), opakovaný kód do helperu, opakovaný selektor/hodnotu do `const`, společnou podmínku vytáhni nahoru.

## C4. Zanořené IFy / cykly  ❌
**Problém:** Hluboké vnoření, `.each` v `.each`, „pyramidy hrůzy" / callback hell.
**Řešení:** Zploštit — `async/await`, ternární operátory, jQuery `filter`/`find`, brzké returny.

## C5. Umístění / scope / deklarace  ⚠️
**Problém:** Funkce zbytečně definovaná uvnitř jiné, deklarace proměnných roztroušené, kód v cyklu, který tam nepatří.
**Řešení:** Funkci nezávislou na vnitřním stavu definuj vně; deklarace na začátek funkce; invariantní kód vytáhni mimo cyklus.

## C6. ES6 třídy / struktura objektů  ⚠️
**Problém:** Zavádějící „objekt", který supluje třídu.
**Řešení:** Použij skutečnou ES6 třídu s privátními metodami, nebo čistý konfigurační objekt.

---

# D. Rozsah proměnných a závislosti

## D1. Globální → blokové proměnné  ❌
**Problém:** Plošné globální proměnné, `var`.
**Proč:** Kolize s jinými doplňky a e-shopem.
**Řešení:** `const`/`let`, nikdy `var`. Doplň chybějící deklarace.

## D2. `const` místo `let`  ⚠️
**Problém:** `let` u hodnoty, která se nemění.
**Řešení:** Co se nepřiřazuje znovu, deklaruj jako `const`.

## D3. Předávání závislostí: parametr místo `window`  ⚠️
**Problém:** Hodnoty/elementy se sdílí přes `window` nebo globál.
**Řešení:** Předávej je funkci jako parametr; element, který už byl nalezen, posílej dál, nehledej znovu.

## D4. Namespace / prefix / kolize  ❌
**Problém:** Obecné názvy proměnných, `localStorage` klíčů a `id` elementů.
**Proč:** Pád jiných doplňků nebo e-shopu.
**Řešení:** Zabal do namespace a dej unikátní prefix (např. `elevate_`) na proměnné, `localStorage` klíče i `id`. Nepoužívej jméno autora v názvech — pojmenuj podle funkcionality.

---

# E. JavaScript — best practices

## E1. Template literals / DOM API místo skládání stringů  ❌
**Problém:** HTML se skládá `'<div class="' + x + '">'`.
**Řešení:** Template literals (backticky) nebo DOM API. Bezpečnější i čitelnější. Skládej a přiřazuj string jednou, ne opakovaně.

## E2. Moderní JS  ⚠️
**Problém:** Zastaralé konstrukce (`XMLHttpRequest`, ruční smyčky).
**Řešení:** `fetch` + `async/await`, `forEach`/`map`, `clone` kde dává smysl.
```js
async function load(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
```

## E3. jQuery idiomy  ⚠️
**Problém:** Opakované `$(this)`, zbytečný `.detach()`, `filter` tam, kde stačí `find`.
**Řešení:** Cachuj `const $this = $(this);`, používej `find`, zbytečné volání odstraň.

## E4. Strict equality `===`  ❌
**Problém:** Loose equality `==`.
**Řešení:** Vždy `===` / `!==`.

## E5. Debounce / throttle  💡
**Problém:** Náročný handler na častém eventu (`resize`, `scroll`).
**Řešení:** Obal do `debounce`/`throttle`.

## E6. Event listenery  ⚠️
**Problém:** Listenery se přidávají opakovaně bez odebrání; zbytečná kombinace více eventů.
**Řešení:** Před přidáním odeber starý listener; často stačí jen `click` (spouští se i na mobilu). Klik na overlay detekuj přímo na overlay.
```js
if (resizeListener) window.removeEventListener('resize', resizeListener);
resizeListener = debounce(handleResize, 150);
window.addEventListener('resize', resizeListener);
```

## E7. localStorage v try/catch  ⚠️
**Problém:** Práce s `localStorage` bez ošetření (může vyhodit výjimku, být plné/zakázané).
**Řešení:** Obal do `try/catch`. Neukládej klíče, které se nikde nečtou.

## E8. Error handling / `response.ok`  ⚠️
**Problém:** `fetch` bez kontroly stavu, chybějící `try/catch`.
**Řešení:** Kontroluj `response.ok`, ošetři chyby.

## E9. Drobné JS opravy / redundance  💡
- `parseInt(x, 10)` — vždy radix.
- Odstraň redundantní `.trim()`, zbytečné převody na string, zbytečné `> 0`.
- `/gi` flag netřeba, když je text už lowercase.

## E10. Magic constants  ⚠️
**Problém:** Natvrdo čísla (`3600000`), URL, názvy šablon, HTTP statusy v kódu.
**Řešení:** Vytáhni do pojmenovaných konstant / konfigurace.

## E11. Konzistence / pojmenování  💡
**Problém:** Nekonzistentní hodnoty (`Math.min(3` vs jinde jiné), zavádějící názvy funkcí (`render`, která nic nerenderuje), `element` parametr, který je ve skutečnosti selector.
**Řešení:** Sjednoť hodnoty; název ať odpovídá tomu, co funkce/parametr dělá (`shouldRender`, `selector`).

---

# F. Čistota produkčního kódu

## F1. Odstranit zakomentovaný kód  ❌ 
**Problém:** Zakomentované bloky kódu v produkci.
**Řešení:** Smazat. Historie je v gitu.

## F2. Nepoužívaný / mrtvý kód a soubory  ❌
**Problém:** Nepoužívané proměnné (`index`, který se nečte), nebuildované soubory, nepotřebné složky.
**Řešení:** Odstranit vše, co se nevyužívá.

## F3. `console.log` / debug v produkci  ❌/⚠️
**Problém:** Výpisy do konzole, debug metody (200+ řádků, které klient nevyužije).
**Řešení:** Odstranit. Debug nástroje vyčlenit do samostatného modulu povoleného jen pod `dev` ENV (produkční build běží s `production`).

## F4. Logování chyb přes Sentry  ⚠️
**Problém:** Chyby se logují do konzole koncového uživatele.
**Řešení:** Použij řešení, které nezatěžuje uživatele — např. Sentry.

## F5. Prázdné / dummy soubory, dev pozůstatky  ⚠️/❌
**Problém:** Prázdné soubory, `dist` ve verzování, dev buildy, pozůstatky lokálního vývoje.
**Řešení:** `dist` ani dev buildy nepatří do PR; přepni na produkční build; smaž prázdné/dummy soubory.

## F6. Balíčky / lock soubory  💡
**Problém:** Nepoužívané npm balíčky, zároveň `package-lock.json` i `yarn.lock`.
**Řešení:** Odstraň nepoužívané závislosti; nech jen jeden lock file (jeden správce balíčků).

---

# G. Build, tooling a soubory

## G1. Minifikace  ❌
**Problém:** Produkční kód není minifikovaný (i když to název kroku slibuje).
**Proč:** Uživatel stahuje zbytečně velký kód.
**Řešení:** Zapni reálnou minifikaci, případně použij build step z boilerplate.

## G2. Build / webpack / vendor  ⚠️
**Problém:** Knihovny třetích stran (Fancybox, Splide) smíchané s vlastním kódem; obfuscator i přes vyjmuté názvy funkcí.
**Řešení:** Vendor knihovny do samostatných souborů; pro dev/prod přepínání použij `DefinePlugin`. Měj na paměti tree-shaking.

## G3. ES moduly / build nezávislý na pořadí  ❌
**Problém:** Build závisí na názvech a pořadí souborů (např. `01-settings.js`, `02-…`); SCSS natahuje partial i index soubory dvakrát.
**Řešení:** Přepiš na `import`/ES moduly — init funkce se volá explicitně, ne přes pořadí ani `window`. Sjednoť SCSS importy.

## G4. CI workflow / branch konfigurace  ❌
**Problém:** Chybí/špatně nastavený GitHub workflow file pro deploy; repo má `master`, ale konfigurace počítá jen s `main`.
**Řešení:** Doplň workflow file; do konfigurace přidej `master` i `main`. Deploy se spouští přes Actions z hlavní větve.

## G5. Assety / fonty / CDN / obrázky  ⚠️
**Problém:** Absolutní URL na CDN vývojáře (`$asset`), fonty/obrázky mimo assety, chybějící atributy obrázků.
**Řešení:** Soubory měj mezi assety, ne na cizí CDN; doplň `srcset`/`poster` kde dává smysl.

## G6. Cache / výkon  ⚠️
**Problém:** Dotazování na obrázky/bannery, které nejsou v cache; obcházení cachování stylů; `find` uvnitř `map` při velkém počtu položek (v košíku mohou být desetitisíce).
**Řešení:** Nedotazuj se na necachované zdroje, neobcházej cache, optimalizuj vyhledávání ve velkých kolekcích.

---

# H. CSS / vizuál

## H1. CSS — jednotky, z-index, media query, styly  ⚠️/💡
**Problém:** `pt` místo `px`, zbytečný `z-index` na více třídách, `width` na `display:none`, přepis globálních stylů.
**Řešení:** Konzistentní `px`; `z-index` jen tam, kde je potřeba; nepřepisuj globální styly e-shopu; část logiky řeš CSS třídou místo inline stylů.

## H2. Deprecated HTML/CSS  ⚠️
**Problém:** Zastaralé tagy (`<big>`).
**Řešení:** Nahraď třídou (`<span class="text-lg">`).

## H3. Velikost písma  💡
**Problém:** Příliš malé písmo (11px).
**Řešení:** Počítej s tím, že Shoptet velikosti písem zvětšuje — drž čitelné minimum.

---

# I. Lokalizace a pojmenování

## I1. Komentáře a identifikátory v angličtině  ❌
**Problém:** Čeština/slovenština v komentářích a názvech.
**Řešení:** Veškeré komentáře i identifikátory anglicky (standardní konvence). Pozor: někdy jsou české komentáře navíc zavádějící (popisují neexistující proměnné).

## I2. Překlady / jazykové mutace  ❌/⚠️
**Problém:** Texty zadrátované v kódu, jen jeden jazyk, špatné ISO kódy.
**Řešení:** Překlady do samostatného souboru (odděl obsah od logiky), počítej s vícejazyčností, správné ISO kódy (Slovinsko = `sl`). Chybějící přeložené texty (i v `aria-label`) doplň.

## I3. Naming konvence + smysluplné názvy  ⚠️
**Problém:** Nicneříkající názvy (`x`, `v`, `m`, `cnt`, `ifr`), snake_case v JS, zbytečné prefixy/suffixy (`prw`), jméno autora v názvech.
**Řešení:** Smysluplné názvy (`activeVideo`, `currentContent`, `imageMap`), camelCase, prefixy jen kde je třeba (namespace), nepoužívej jméno autora.

## I4. Formát ceny / čísla  ❌/⚠️
**Problém:** Parsování ceny předpokládá jeden formát.
**Proč:** Mezinárodní formáty (`1.234,50`, `1,234.50$`, `1 500 Kč`) se rozbijí.
**Řešení:** Formátování přebírej od e-shopu / parsuj robustně napříč formáty.

---

# J. Přístupnost (accessibility)

## J1. Sémantické tagy  ❌/⚠️
**Problém:** Klikací `<div>` místo `<button>`, vizuální nadpis jako `<div>` místo `<h4>`, prázdný `<div>` bez role/tabindex/aria.
**Řešení:** Akce = `<button>`; nadpis = `<hX>` (čtečka pozná strukturu); interaktivní prvek musí mít roli/tabindex/aria.

## J2. Čtečky / aria / WCAG  ⚠️/❌
**Problém:** Informace jen vizuálně (unicode hvězdičky), chybějící `aria-label`, autoplay bez pause.
**Řešení:**
- Doplň skrytý text pro čtečky (`sr-only`) s číselnou hodnotou.
- `aria-label` s překladem.
- U autoplay přidej vizuálně skryté pause tlačítko v DOMu (WCAG 2.2.2, technika G4) — splní accessibility bez vizuálního dopadu.
- `onblur` validace není přístupná; nedisabluj submit.

---

# K. Forma komentáře a proces (jak probíhá review)

- **Code-suggestion bloky** — reviewer často navrhne přesnou opravu přes `` ```suggestion ``; jde přijmout jedním kliknutím.
- **Dotazy (❓)** — „je to záměrně?", „jaký je důvod?" → odpověz nebo uprav; reviewer si není jistý.
- **FYI / roadmapa** — nezávazné info („budeme měnit", „není bloker").
- **Git flow** — pro review musí být v PR vidět změny oproti `main`; neměň `main` a `prod` ve stejném PR, neslučuj revertované commity. Issues o deploji se vytváří automaticky (logování commitů do `main`).

---

## Typická struktura review

Souhrnné review má ustálený formát opakující se téměř doslovně napříč repy:

1. Pozdrav + poděkování za PR.
2. **Blokující problémy** — nutné pro schválení (typicky XSS, globální proměnné, debug logy, chybějící minifikace, čeština).
3. **Velmi doporučujeme opravit** — struktura kódu, accessibility.
4. Info, že další komentáře jsou u jednotlivých issues.
5. Podpis „Shoptet – [jméno]".

Následné review po opravách buď schválí (`APPROVED` / merge), nebo znovu otevře nedokončené body.

## Hlavní závěr

Review se snaží držet konzistentní a kvalitní kód pro Shoptet vizuální doplňky. Skoro každý větší PR naráží na stejnou sadu věcí: **bezpečnost (XSS), rozsah proměnných, používání oficiálního Shoptet dataLayer/API místo hacků, čistota produkčního kódu (žádné logy/debug/mrtvý kód), přístupnost a anglické komentáře.** 


# Rychlý checklist před odesláním PR

- [ ] Žádný `console.log` / debug v produkci
- [ ] Žádný zakomentovaný ani mrtvý kód, prázdné/dummy soubory, `dist`/dev buildy
- [ ] Kód minifikovaný; vendor knihovny oddělené
- [ ] Žádné globální proměnné/`var`; namespace + unikátní prefix
- [ ] Data čtená přes `getShoptetDataLayer()` / `shoptet.config.breakpoints`
- [ ] Žádné `data-testid` selektory; vázáno na CSS třídy
- [ ] HTML vkládané bezpečně (žádné XSS); validace vstupů
- [ ] Doplněk nic neovlivňuje mimo svůj kontejner
- [ ] Komentáře i identifikátory anglicky; překlady v samostatném souboru
- [ ] Přístupnost: sémantické tagy, `sr-only`, `aria-label`, pause u autoplay
- [ ] `===`, `const`/`let`, template literals, `fetch`+`try/catch`
- [ ] Inicializace v `ShoptetDOMContentLoaded`, žádné `setTimeout` hacky
