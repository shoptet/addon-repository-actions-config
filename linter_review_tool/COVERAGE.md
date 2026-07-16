# Review-tool — pokrytí a spolehlivost

Shrnutí toho, co nástroj kontroluje, rozdělené podle **spolehlivosti detekce**:
co linter chytá spolehlivě na 100 %, kde spolehlivý být nemusí a proč, a co je
zcela mimo dosah statické analýzy.

## Co tool je (v kostce)

Orchestrátor 4 linterů nad `src/`:

- **ESLint** (JS) — vestavěná pravidla + ~19 custom `shoptet/*`
- **stylelint** (CSS/SCSS/LESS) — jednotky, z-index, `!important`, …
- **HTML a11y** (parse5) — přístupnost v `.html` souborech
- **cross-file** (espree) — duplicita napříč soubory

Výstup → GitHub anotace / reviewdog PR komentáře. Závažnost: `❌ error`
(blokuje CI) / `⚠️ warning` (doporučení). Minifikované/vendor soubory
(`*.min.*`, `dist/`, `vendor/`, `node_modules/`) se přeskakují.

---

## 🟢 A) Spolehlivé na 100 % (deterministické, nad AST)

Detekují **přesnou syntaktickou konstrukci**. Když to zahlásí, konstrukce tam
**prokazatelně je** — žádné plané poplachy z principu.

**Rozsah proměnných a syntaxe**

- `no-var`, `prefer-const`, `no-implicit-globals`, `no-redeclare` (D1/D2)
- `eqeqeq` — `==` vs `===` (E4)
- `prefer-template`, `no-useless-concat` (E1)
- `radix`, `camelcase`, `no-eval`, `no-script-url`

**Mrtvý kód / TDZ**

- `no-unused-vars`, `no-unreachable`, `no-unused-expressions` (F2)
- `no-use-before-define` — TDZ / ReferenceError

**Shoptet-specifické (přesný vzor)**

- `no-console` (F3), `no-param-reassign` (A3)
- `no-testid-selector` — `data-testid` (B7)
- `no-redundant-checks` — `typeof shoptet/dataLayer/screen` (B4)
- `no-settimeout-hack` — `setTimeout(fn, 0)` (B5)
- `prefer-fetch` — `new XMLHttpRequest` (E2)
- `no-core-overwrite` — přiřazení do `shoptet.*.* = …` (B6) *(viz caveat B4)*
- `namespace` → část `window.x = …` (D4)

**Metriky (počet je přesný)**

- `max-depth`, `max-nested-callbacks`, `max-lines`, `max-lines-per-function`,
  `max-statements`, `complexity` (C1/C2/C4)

**CSS/stylelint (přes reálný parser)**

- `unit-disallowed-list` (pt), `declaration-no-important`,
  `no-duplicate-selectors`, `color-no-invalid-hex`

> ⚠️ Nuance: detekce je 100%, ale **jestli je nález problém**, je u metrik a
> `no-console`/`!important` věc nastavení prahu / záměru (např. `console` v dev
> buildu). Konstrukci pozná jistě; hodnotu prahu volí člověk.

---

## 🟡 B) Kde linter nemusí být spolehlivý — a proč

Seskupeno podle **příčiny** nespolehlivosti.

### B1 — Chybí taint / data-flow (nepozná bezpečná vs. nebezpečná data)

- `no-xss`, `no-attribute-injection`, `require-response-ok`
- **Proč:** linter vidí *sink* (`innerHTML`, `.src`, `fetch`), ale nesleduje,
  **odkud data přitečou**. → plané poplachy na neškodných dynamických hodnotách;
  priorita rizika (cena z dataLayer vs. data z localStorage) je jen **hrubý
  textový signál**, ne skutečný taint.

### B2 — Text/regex heuristika (křehké „parsování")

- `no-commented-code`, `a11y-html-strings`, `no-target-blank`, `no-czech-strings`
- **Proč:** regex nad stringy není parser. → próza vypadající jako kód se
  označí; HTML poskládané jinak se mine; `a11y-html-strings` vidí jen HTML ve
  string/template literálech, **ne DOM stavěný přes API**.

### B3 — Odhad prahu / záměru

- `prefer-shoptet-init` (setTimeout ≤100 ms), `namespace` (prefix localStorage
  klíče), `min-font-size`, `max-z-index`
- **Proč:** `setTimeout(fn, 50)` může být lifecycle hack **i** legitimní
  debounce — linter nerozliší. Práh 100 ms / 12 px / z-index 100 je konvence,
  ne pravda.

### B4 — Neúplný signál / seznamy

- `no-core-overwrite` (seznam core funkcí = jen `initColorBox`),
  `no-czech-comments` / `no-czech-strings` (jen **diakritika** — „pocet",
  „seznam" bez háčků projdou), `hardcoded-breakpoints` (jen literály, ne
  breakpoint v proměnné), `require-cache-path` (jen literální URL, ne skládané)
- **Proč:** chytá jen to, co je na seznamu / má jasný znak. → **false
  negatives** u variant mimo vzor.

### B5 — Per-file / strukturální slepá místa

- `cross-file` duplicita, `localstorage-try-catch`
- **Proč:** cross-file porovnává **jména** (`moveElement`), ne logiku → dvě
  různé funkce stejného jména = plané; vidí jen top-level funkce a `window.*`
  (ne metody tříd, duplicitní bloky). `localstorage-try-catch` kontroluje
  **lexikální** `try` — když je `localStorage` schované v helperu volaném uvnitř
  `try`, false-positive.

---

## 🔴 C) Zcela mimo dosah statického lintu

Vyžaduje kontext, který v kódu není:

- **Build/tooling (G1–G3):** minifikace, vendor bundle, závislost na pořadí
  `00-…04-`, komunikace přes `window` — věc build configu a runtime, ne AST.
- **Sémantika/architektura:** skutečná DRY duplicita logiky (ne jmen), správné
  rozdělení do modulů, „render, který nic nerenderuje" (E11).
- **Doména:** úplnost překladů (I2), korektnost formátu ceny napříč trhy (I4) —
  linter pozná *že* je něco hardcoded, ne *jestli* je výsledek správně.
- **Přístupnost v JS-DOM (J):** HTML linter dostane 0 souborů, protože markup
  vzniká za běhu v JS; `a11y-html-strings` je jen náhrada přes regex.
- **Plná bezpečnostní analýza:** taint od zdroje k sinku, Trusted Types
  sémantika.

---

## Praktický závěr

- **Blokující `❌` = převážně kategorie A** (deterministické) → dají se bezpečně
  vynucovat v CI, minimum sporů.
- **Doporučující `⚠️` = kategorie B** → skvělá „upozorňovací" vrstva, ale
  finální posouzení patří člověku (proto nejsou blokující).
- **Kategorie C** je důvod, proč tool **nenahrazuje** lidský review, ale odbaví
  za něj rutinu (~59 % blokujících bodů z příručky má aspoň nějakou detekci).

---

## Profily běhu: `strict` vs `full`

Rozdělení A/B se promítá do dvou profilů (jediný zdroj pravdy = `profiles.js`):

| Profil | Co běží | Kde |
|--------|---------|-----|
| **`strict`** | jen **kategorie A** (spolehlivé — pozitivní nález je téměř vždy reálný) | CI/CD na PR (blokující gate) |
| **`full`** (default) | **A + B** (vše včetně heuristik) | lokálně / osobní kontrola |

**Spuštění:**

```bash
yarn review          # full — vše (default)
yarn review:strict   # strict — jen spolehlivá pravidla
# přímo: node review.js <cesta> [--strict]
```

CI (`checks.workflow.yml`) volá `review.js src --strict --rdjson` → PR blokují jen
spolehlivá pravidla, minimum falešných poplachů. Heuristiky (kategorie B) partner
uvidí lokálně přes `yarn review`, ale **neblokují** merge.

**Filozofie strict profilu:** nulová tolerance k false-positivům, false-negativy
jsou OK. Pravidlo je ve strict jen tehdy, když je jeho **pozitivní nález
důvěryhodný** (i když občas něco mine — to dožene `full` běh / člověk).

> ⚠️ **Bezpečnostní pozn.:** `shoptet/no-xss` (a další A1 heuristiky) jsou kvůli
> chybějící taint-analýze **false-positive-prone**, proto jsou jen ve `full`,
> **ne** ve strict/CI gate. Důsledek: XSS PR **neblokuje** automaticky — spoléhá
> se na `full` běh a lidský review. Pokud chceš XSS v gate i za cenu občasných
> planých poplachů, přidej `'shoptet/no-xss'` do `RELIABLE_RULES` v `profiles.js`.
