# CONTEXT — AI reviewer Shoptet doplňků

> Kontext pro Claude Code a **jediný zdroj pravdy pro „co platí teď"**: co stavíme, proč, jaká
> rozhodnutí padla, co je vědomě odloženo, jaké mantinely neodlaďovat zpátky a v jakém režimu
> běžíme. Není to skill — samotný review řídí `st-addon-review/SKILL.md`. Tohle je mapa okolo.
>
> **Dělba s `HANDOFF.md`:** CONTEXT = **stav** (trvalá pravda, edituje se, když se rozhodnutí
> změní). HANDOFF = **cesta** (datovaný append-only žurnál běhů; co se kdy stalo, nepřepisuje se).
> Trvalé rozhodnutí patří sem, ne do datovaného zápisu — tím se soubory nerozjíždějí.

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
  (strop `recommended`), vždy `source: judgment`. Smí pokrýt jen **konkrétní bug / bezpečnostní /
  funkční riziko s vysokou jistotou** — žádný vkus ani spekulace. Opakovaný úsudkový nález →
  `rule_candidate: true` (kandidát na nové pravidlo; katalog edituje jen člověk, ne agent).
  Jak se judgment prezentuje partnerovi → *Záměrná rozhodnutí › Partnerský výstup* níže.
- **Přesnost před úplností.** Falešný nález stojí důvěru partnera víc než minutí. Když si AI
  není jistá záměrem → dotaz (`❓`), ne tvrzení.
- **Cílové prostředí = review v Claude Code** nad naklonovaným repem (ne CI). Agent si diff
  vytáhne přes `git`/`gh` a kontext čte z celého checkoutu, ne z izolovaného diffu.
- **Gate ≠ REQUEST_CHANGES.** V autonomním `submit` posílá AI vždy `COMMENT` (neblokující);
  překlopit PR na Approve/Request changes smí jen člověk v `pending`. Vynucení povinné fáze je
  věc samostatného required checku (CI vrstva mimo skill) — mechanika je připravená, ale **zatím
  plošně vypnutá a nepoužívá se** (včetně štítku `human-review`).
- **AI needituje katalog ani kód.** Opravy jen navrhuje (`suggestion`), nefixuje.
- **Multi-agent odložen** — start je jeden agent. Změny se týkají **jen nových doplňků**.

## Aktuální režim běhu

**Reálné review.** Pouštíš to na PR **bez lidského review** — AI je první (a zatím
jediný) reviewer, tak jak to má fungovat v produkci. Výstup je genuine review.

- **Judgment: ZAPNUTÝ** (mantinely výše).
- **Zápis do GitHubu: řízen přepínačem `github_review` v SKILL.md** (sekce „Vracení do GitHubu"),
  teď **`pending`**. Tři stavy: `off` = jen vypiš; `pending` = vlož jako **draft** review pod
  loginem člověka (nic se neodešle, dokud člověk nesubmitne) + vypiš do chatu; `submit` =
  **cílový stav** — review rovnou odešle (`event: COMMENT`, nikdy `REQUEST_CHANGES` ani `APPROVE`)
  **bez lidské kontroly**. `submit` = ta „poslední brána"; zapnout **až po opakovaně čistém pending výstupu**
  (výstup, který bys N běhů po sobě, napříč typy PR, submitnul beze změny). Do té doby default
  `pending`. **Štítky ani gate skill nedělá v žádném stavu** — gate je zvlášť řešená CI vrstva.
  Přepíná se editací té jedné hodnoty v SKILL.md.
- **Bez člověka za tím je laťka na false-positives ještě vyšší** — nikdo to po AI nečistí, než
  se (jednou) pošle. Radši `❓` a zdrženlivost než jisté tvrzení u sporné věci.

## Odkud se vzala důvěra tento krok udělat

Předchozí ověřovací běh na 6 reálných PR (jQuery monolity, všechny bez ESLintu): vysoký recall na
katalogové nálezy, nízké false-positives, funkční zdrženlivost (B1 potlačené tam, kde partner
čte dataLayer správně; žádný B6 false-positive). Katalog se z toho běhu i doladil:
- **C1** rozdělené — blokuje **nereviewovatelný monolit** (promíchané odpovědnosti), ne pouhá
  délka (ta je ⚠️; řádkový práh stejně patří linteru).
- **A1↔E1** křížový odkaz — `+`-skládání HTML s daty z API je **A1 (XSS, blokující)**, ne jen
  stylové E1.

## Jak se skill ladí

Nejsilnější nástroj je **dvojí běh: `st-addon-review` vs. „obyčejné" Claude Code review** na
**už zreviewovaném** PR (kde znáš i lidské komentáře jako gold standard). Důvod: nejnebezpečnější
chyby skillu jsou **tiché miss** — věc, kterou skill viděl a spolkl, nebo vůbec nezkusil.
False-positive je vidět; tichý miss nezanechá stopu a odhalí ho jen porovnání s druhým reviewem.
Bez toho srovnání „vypadá to dobře" nic neznamená. Každá úprava se ověřuje na dalším PR, ideálně
re-runem na tom samém, co dřív selhal. Chronologie jednotlivých běhů je v `HANDOFF.md`.

## Záměrná rozhodnutí (NEODLAĎOVAT zpátky)

Instrukce v SKILL.md, které vypadají „divně", **nejsou samoúčelné** — každá je záplata na reálně
pozorovanou chybu z běhů. Než něco z toho odladíš zpátky, přečti proč to tam je.

**Tři opravené kalibrační chyby (z prvních běhů):**
1. **Špatný nástroj** (prázdné soubory) → u F5 apod. používej správný nástroj/ověření.
2. **Tiše zahozený ověřitelný lead** (mrtvý kód v `ShkProject` — „možná F2… radši ne", zahodil)
   → *„Přesnost ≠ mlčení"* + *ověř `grep`em přes celé repo* (F2/C3/B6/D1/D4). `grep` na symbol =
   0 čtení → potvrzený F2. Levné ověření místo zahození.
3. **Předčasně uzavřený řádek** (jazykový fallback minut, protože řádek prověřen jen optikou
   A1/XSS a odškrtnut) → *„jeden řádek spouští víc pravidel"* (po A1 projdi A2/I2/J2) + *„traceuj
   negativní větev"* u `map[key]` / indexace / parametru bez defaultu / `JSON.parse`.

Meta-vzorec těch chyb: skill zůstával **lokální**, když měl jít **napříč repem / napříč pravidly**,
a **uzavíral nález o jednu otázku dřív**.

**Kalibrace potvrzená napříč běhy:**
- **Kontrola úplnosti = dvouosá:** šířka (matice soubor × A–J + P) + hloubka (model chování;
  „reportuju z ověřeného, nebo z ‚myslím, že jsem to protraceoval'?"). **Matice měří šířku, ne
  hloubku** — velký soubor odškrtnutý přes pár sekcí = falešné razítko → `❓ mělce prošlé`.
- **A2 Gate:** výjimka, co přeruší init doplňku = **❌** (patří na čelo blokujících), ne ⚠️.
  A **podmíněnost pádu závažnost nesnižuje** — „*jen když* shop nevloží config" je nízká
  pravděpodobnost → patří do `confidence`, **ne** do severity. (Model si podmíněnost 2× přeložil
  na slevu ❌→⚠️; próza je slabá páka, míří proto přímo na ten mechanismus záměny.)
- **Úzká control-flow osa:** u funkce, co mění DOM / váže handlery, `grep` místa volání + ověř
  idempotenci. **Neidempotentní funkce volaná z víc lifecycle hooků** je bug z *počtu volání*,
  není vidět v těle ani v jednom místě volání (E6/B5). Jediná ze zvažovaných mechanických záplat,
  co se zapsala — protože se vrátila napříč běhy (2/3 monolity).
- **Doménové „co NENÍ nález":** B5 (globál/core undefined z řazení skriptů) a B1 (class selektor
  k cílení prvků). U obou drž hranici reálných nálezů — mají mirror v `shoptet-reference.md`.
- **Partnerský výstup:** `rule_id`, čísla pravidel **i slovo „katalog"/„mimo katalog"** = interní,
  nikdy do komentáře/souhrnu. Judgment nálezy jdou v souhrnu do odděleného bloku
  **„AI navíc upozorňuje (nezávazné)"** (partnerský název; „mimo katalog" je interní). Každý inline
  komentář začíná značkou (`❌/⚠️/💡/❓`). Souhrn = rozcestník: jen blokující jmenovat,
  doporučení/tipy **obecně BEZ ČÍSEL** + max 3 témata.

## Co je vědomě ODLOŽENÉ (ne opomenuté)

- **Judgment je zatím spíš opatrný.** Cross-file logické bugy chytne, jen když jsou dost jisté;
  jemnější rizika může minout. Vědomé — neřešit rozvolnění prahu z jednoho PR, hrozí šum.
- **Mechanické heuristiky (sink heuristika, seznam DOM lookupů, „degenerate-construct" judgment)**
  vědomě NEZAPSÁNY — generická hloubková osa je nese. Nepřidávej zpětně z jednoho miss; ohrozí to
  ~0 FP přesnost, což je nejsilnější aktivum. Zvaž teprve u opakovaně se vracejícího vzoru.
- **Robustnost napříč populací pořád není „hotová."** Otestováno na dvou monolitech + dvou
  modulárních PR — pár běhů nejsou statistika. Pokračovat v dual-runech.
- **SCSS do hloubky** skill jen skimuje; z velké části **stylelint-owned** → spadne pod linter
  vrstvu. Reálná AI-mezera je jen užší zbytek.
- **Linter vrstva (ESLint/stylelint/depcheck) není hotová** → všechny běhy jely v degradovaném
  režimu. Staví ji kolega; patří do boilerplate. Sem míří i sweep-typové věci (zakomentovaný
  mrtvý kód napříč soubory, lockfily, prázdné soubory).
- **Perzistovaný findings JSON pro re-run není potřeba** — identitu nálezů nesou skryté markery +
  git srovnání commitů (viz `SKILL.md` › *Re-run*).
- **TODO (budoucí): eval sada + ukládání běhů.** Zatím **NEEXISTUJE** — žádné běhy se neukládají,
  nic se proti ničemu neporovnává; jednotlivé výstupy prochází člověk a tak to nějakou dobu
  zůstane. Až bude potřeba měřit regrese při změnách katalogu/skillu, vznikne takto: z reálných
  (klidně zavřených) PR se vybere ~5–10 reprezentativních případů; u každého se uchová **vstup**
  (repo + SHA / diff) a **pročištěný „blessed" baseline** — ručně opravený výstup, tj. *jak mělo
  review vypadat*, ne syrový výstup s dnešními chybami (jinak by se zabetonovaly současné chyby
  jako cíl). Protože jde o LLM nad volným textem, **neporovnává se JSON 1:1** — z každého případu
  se vydestiluje krátký seznam **must-find** (nálezy, co MUSÍ padnout, včetně severity),
  **must-not-flag** (pasti na false-positive) a u podmíněných pravidel očekávaná ❌/⚠️ větev.
  Regrese = přehrát ty stejné PR upraveným skillem a zkontrolovat, že seznam pořád sedí.
- **Plně automatický `submit` (bez člověka) je NAPSANÝ, ale NEZVOLENÝ.** Default `pending`.
  Zapnout až bude pending výstup opakovaně takový, že bys ho submitnul beze změny. Servisní
  identita (`shoptet-ai-reviewer`) patří až sem, ne k pending.
- **Backlog pravidel** (A6–A11, sekce J accessibility = runtime) — parkováno. **P1 (cookie
  consent pro tracking) z backlogu kodifikováno 2026-07-22** — judgment kanál ho našel naostro
  (datixo PR #3, perzistentní tracking bez `shoptet.consent`) a jako judgment nemohl blokovat
  (invariant 3); přesně kodifikační cesta, se kterou design počítá.

## Pasti, do kterých nespadnout

- **„Regular review našel víc → přidejme to do katalogu."** Ne. Rozliš *skill to minul* (patřilo
  do scope, oprav) od *skill to správně neřešil* (TS přesnost, doménové race conditiony, build
  tooling, kosmetika — mimo scope, patří člověku/jinému nástroji). Zaostřenost je záměr.
- **„Judgment našel něco mimo katalog!"** Nejdřív ověř, že to není existující pravidlo, které se
  jen neaktivovalo (XSS-přes-konkatenaci = A1; rozbitý import z prázdného souboru = F5/F2).
- **Věřit jednomu běhu.** Každá úprava se ověřuje na dalším PR, ideálně re-runem na tom, co selhal.
- **„Generická osa to na jednom PR nechytila → přidejme mechanickou heuristiku."** Ne — ohrozí
  ~0 FP přesnost. Heuristiku zvaž až u opakovaně se vracejícího vzoru.
- **Zapnout `submit` předčasně.** Je připravený schválně; brzdí ho jen **důvěra ve výstup**
  (opakovaně čistý pending), ne technika. Přepnutí je jeden znak — ta laťka je celý smysl.
- **Řešit neviditelný pending souhrn tím, že ho zveřejníš.** Souhrn se během pending čte z výstupu
  běhu; publikace navíc = ztráta lidské kontroly, přesně to, čemu pending brání.

## Soubory (skill balík)

```
shoptet-addon-review/
├── .claude-plugin/plugin.json
├── CONTEXT.md                             # tento soubor — stav, rozhodnutí, režim
├── HANDOFF.md                             # cesta — poznatky z běhů, proč jsou instrukce takové, co je odloženo
├── INSTALL.md                             # instalace + kickoff prompt
└── skills/st-addon-review/
    ├── SKILL.md                           # proces review (řídí agenta)
    └── references/
        ├── rules-catalog.md               # rubrika A–J, P (čte agent)
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
