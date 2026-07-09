# Příručka pro code review Shoptet doplňků

Lidská část — proces, kontext a self-check. **Pravidla samotná jsou v `rules-catalog.md`** (strojově čitelná, čte je review agent). Tady je vysvětlení značek, jak review probíhá, a checklist pro vývojáře.

Praktický průvodce vychází z reálných review připomínek. Cílem je, aby PR prošel review hladce, ideálně na první pokus, a aby se stejné připomínky neopakovaly.

## Jak číst značky závažnosti

| Značka | Význam | Co s tím |
|--------|--------|----------|
| ❌ | **blokující** | bez opravy se doplněk neschválí |
| ⚠️ | velmi doporučené | opravit, pokud není pádný důvod ne |
| 💡 | tip / nice-to-have | dle uvážení, zlepšení kvality nebo začištění kódu |
| ❓ | dotaz | reviewer si není jistý záměrem — vysvětlit nebo opravit |

> **Dvojí závažnost (❌/⚠️):** některá pravidla blokují jen za určitých okolností. U nich je v katalogu pole **Gate** s rozhodovacím kritériem — kdy nález **blokuje (❌)** a kdy je jen **doporučení (⚠️)**. Gate je závazný pro automatické i lidské review, aby se stejný nález nehodnotil pokaždé jinak.

## Kdo pravidlo kontroluje (vlastník)

| Vlastník | Význam |
|----------|--------|
| 🔧 Linter | mechanicky detekovatelné — dá se vynutit lint/CI pravidlem, není potřeba lidský/AI úsudek |
| 🤖 AI | vyžaduje kontextové posouzení (smysl, architektura, bezpečnost, záměr) |
| 🔧+🤖 Oba | linter chytí mechanickou část, AI dořeší kontext a hraniční případy |

> **🔧 není jen ESLint.** Zastřešuje víc nástrojů — ESLint (+ pluginy), **stylelint** (CSS), **jscpd / SonarJS** (duplicity), **depcheck** (závislosti), **secret-scan** (gitleaks/trufflehog), **a11y** (axe — runtime nad vyrenderovaným DOMem) a **CI kontroly** (actionlint, build). Konkrétní nástroj je u každého pravidla v poli `Nástroj`. Pravidla mimo ESLint se do ESLint configu **nedají** — řeší se samostatným nástrojem.

> **Accessibility (sekce J) je runtime.** Doplňky staví DOM jako HTML stringy v jQuery, takže `eslint-plugin-jsx-a11y` (lintuje jen JSX) na nich nic nenajde. Reálně je odhalí **axe nad vyrenderovaným DOMem** (zatím mimo scope); AI dělá jen statický best-effort.

---

# Forma komentáře a proces (jak probíhá review)

- **Code-suggestion bloky** — reviewer často navrhne přesnou opravu přes `` ```suggestion ``; jde přijmout jedním kliknutím.
- **Dotazy (❓)** — „je to záměrně?", „jaký je důvod?" → odpověz nebo uprav; reviewer si není jistý.
- **FYI / roadmapa** — nezávazné info („budeme měnit", „není bloker").
- **Git flow** — pro review musí být v PR vidět změny oproti `main`; neměň `main` a `prod` ve stejném PR, neslučuj revertované commity. Issues o deploji se vytváří automaticky (logování commitů do `main`).

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

---

# Rychlý checklist před odesláním PR

(Partner-facing — pro vývojáře doplňku před odesláním.)

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
- [ ] Init: `DOMContentLoaded` (první load) + `ShoptetDOMContentLoaded` (AJAX, idempotentně); žádné `setTimeout` hacky
