# CONTEXT — AI reviewer Shoptet doplňků (handoff)

> Kontext pro Claude Code. Shrnuje, co stavíme, proč, jaká rozhodnutí padla a v jakém režimu
> teď běžíme. Není to skill — samotný review řídí `st-addon-review/SKILL.md`. Tohle je mapa okolo.

## Co stavíme a proč

Partneři píšou vizuální (front-end) doplňky pro Shoptet e-shopy. Dnes je manuálně reviewuje
člověk s doménovou znalostí, což tým brzdí. Cíl: **AI reviewer, který běží před člověkem a
odbaví rutinní nálezy**, aby člověku zůstaly jen doménové otázky a edge-casy.

Hlavní cíl vždy: **nedopustit, aby doplněk rozbil nebo zpomalil e-shop.** Partneři většinou
nejsou silní programátoři — velké monolitické skripty, často jQuery, testy skoro nikdy.

## Trojvrstvý model (klíčové rozhodnutí)

Nálezy se dělí podle toho, který nástroj je nejlevnější, co je chytí:

- **Linter** — mechanické, deterministické (`var`, `===`, `console.log`, mrtvý kód). Řeší
  ESLint (a spol.: stylelint, jscpd, depcheck, secret-scan). **AI je nepřezkoumává očima** —
  spustí linter jako nástroj a jeho výstup jen převezme. Tuhle vrstvu staví kolega zvlášť;
  **zatím není hotová a v addon repech chybí → čekej degradovaný režim** (`linter_available:false`).
- **AI** — sémantika, kterou linter neumí (XSS, reimplementace Shoptet core, DOM parsing
  místo dataLayer, duplicita). Tady je hodnota AI revieweru.
- **Runtime** — co jde chytit jen za běhu (interference, výkon, většina accessibility).
  **Mimo scope** (žádný vlastník `runtime`); počítá se s Playwright/axe/Lighthouse později.

## Rozhodnutí, která platí

- **Katalog pohání gate.** Blokovat (`blocking`) smí **jen** nález mapovaný na pravidlo
  z katalogu — gate musí být férový a obhajitelný.
- **Vlastní úsudek (`judgment`) je ZAPNUTÝ** (od tohoto běhu). Je **advisory, nikdy blokující**
  (strop `recommended`), vždy `source: judgment`, do odděleného bloku „AI navíc upozorňuje
  (mimo katalog)". Smí pokrýt jen **konkrétní bug / bezpečnostní / funkční riziko s vysokou
  jistotou** — žádný vkus ani spekulace. Opakovaný úsudkový nález → `rule_candidate: true`
  (kandidát na nové pravidlo; katalog edituje jen člověk, ne agent).
- **Přesnost před úplností.** Falešný nález stojí důvěru partnera víc než minutí. Když si AI
  není jistá záměrem → dotaz (`❓`), ne tvrzení.
- **Cílové prostředí = review v Claude Code** nad naklonovaným repem (ne CI). Agent si diff
  vytáhne přes `git`/`gh` a kontext čte z celého checkoutu, ne z izolovaného diffu.
- **Gate ≠ REQUEST_CHANGES.** AI posílá `COMMENT` (neblokující); povinná fáze se řeší
  samostatným required checkem, který se přepočítá na push a jde přebít štítkem `human-review`.
- **AI needituje katalog ani kód.** Opravy jen navrhuje (`suggestion`), nefixuje.
- **Multi-agent odložen** — start je jeden agent. Změny se týkají **jen nových doplňků**.

## Aktuální režim běhu

**Reálné review, ne eval.** Pouštíš to na PR **bez lidského review** — AI je první (a zatím
jediný) reviewer, tak jak to má fungovat v produkci. Není gold standard, proti kterému
porovnávat; výstup je genuine review.

- **Judgment: ZAPNUTÝ** (mantinely výše).
- **Zápis do GitHubu: řízen přepínačem `github_review` v SKILL.md** (sekce „Vracení do GitHubu"),
  teď **`pending`**. Tři stavy: `off` = jen vypiš; `pending` = vlož jako **draft** review pod
  loginem člověka (nic se neodešle, dokud člověk nesubmitne) + vypiš do chatu; `submit` =
  **cílový stav** — review rovnou odešle (`event: COMMENT`, nikdy `REQUEST_CHANGES`) **bez lidské
  kontroly**. `submit` = ta „poslední brána"; zapnout **až po opakovaně čistém pending výstupu**
  (výstup, který bys N běhů po sobě, napříč typy PR, submitnul beze změny). Do té doby default
  `pending`. **Štítky ani gate skill nedělá v žádném stavu** — gate je zvlášť řešená CI vrstva.
  Přepíná se editací té jedné hodnoty v SKILL.md.
- **Bez člověka za tím je laťka na false-positives ještě vyšší** — nikdo to po AI nečistí, než
  se (jednou) pošle. Radši `❓` a zdrženlivost než jisté tvrzení u sporné věci.

## Odkud se vzala důvěra tento krok udělat

Předchozí eval běh na 6 reálných PR (jQuery monolity, všechny bez ESLintu): vysoký recall na
katalogové nálezy, nízké false-positives, funkční zdrženlivost (B1 potlačené tam, kde partner
čte dataLayer správně; žádný B6 false-positive). Katalog se z toho běhu i doladil:
- **C1** rozdělené — blokuje **nereviewovatelný monolit** (promíchané odpovědnosti), ne pouhá
  délka (ta je ⚠️; řádkový práh stejně patří linteru).
- **A1↔E1** křížový odkaz — `+`-skládání HTML s daty z API je **A1 (XSS, blokující)**, ne jen
  stylové E1.

## Soubory (skill balík)

```
shoptet-addon-review/
├── .claude-plugin/plugin.json
├── CONTEXT.md                             # tento soubor
├── INSTALL.md                             # instalace + kickoff prompt
└── skills/st-addon-review/
    ├── SKILL.md                           # proces review (řídí agenta)
    └── references/
        ├── rules-catalog.md               # rubrika A–J (čte agent)
        ├── shoptet-reference.md           # companion pro B1/B4/B6
        └── guide.md                       # lidská příručka (agent nepotřebuje)
```

## Na co u tohoto běhu koukat

- **Judgment: přínos vs. šum.** Kolik `judgment` nálezů je reálný přínos (bug/riziko, co by
  katalog minul) a kolik je šum? Ten poměr rozhodne, jestli kanál pustit i do ostrého provozu.
  Pozor na past: než nález oslavíš jako „mimo katalog", ověř, jestli to není existující pravidlo,
  které se jen neaktivovalo (jako XSS-přes-konkatenaci = A1).
- **False-positives** — pořád nejdůležitější číslo, teď o to víc (bez člověka za tím).
- **Gate/závažnost** u podmíněných pravidel (nová C1: dá dlouhému, ale soudržnému souboru ⚠️?).
- **Degradovaný režim** — ESLint v repu nejspíš není; ať to agent přizná a mechanické věci
  drží na `confidence: medium`.
- **Jen pending review, nikdy submit.** Skill vloží nálezy jako draft; projít a odeslat je
  na člověku. Skill nesmí sám submitnout, měnit štítky ani zapínat gate.
