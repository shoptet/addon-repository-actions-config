# HANDOFF — co jsme se o skillu naučili (pro pokračování v ladění)

> Doplněk k `CONTEXT.md`. CONTEXT popisuje **stav** (co skill je, rozhodnutí, režim).
> Tenhle soubor popisuje **cestu**: co z reálných běhů vyplynulo, proč jsou v SKILL.md
> některé „divné" instrukce, co je vědomě odložené a jak se skill vůbec ladí. Přečti,
> než začneš skill měnit — ať neodladíš zpátky něco záměrného.

## Jak se tenhle skill ladí (nejcennější poznatek)

Nejsilnější nástroj na ladění je **dvojí běh: `st-addon-review` vs. „obyčejné" Claude Code
review** na **už zreviewovaném** PR (kde znáš i lidské komentáře jako gold standard). Důvod:
nejnebezpečnější chyby skillu jsou **tiché miss** — věc, kterou skill viděl a spolkl, nebo
vůbec nezkusil. False-positive je vidět; tichý miss nezanechá stopu a odhalí ho jen porovnání
s druhým reviewem. Bez toho srovnání „vypadá to dobře" nic neznamená.

## Tři opravené kalibrační chyby (NEODLAĎOVAT zpátky)

Instrukce v SKILL.md níže **nejsou samoúčelné** — každá je záplata na reálně pozorovanou chybu:

1. **Špatný nástroj** (prázdné soubory) → skill má u F5 apod. používat správný nástroj/ověření.
2. **Tiše zahozený ověřitelný lead** (mrtvý kód v `ShkProject` — „možná F2… radši ne", zahodil).
   → v SKILL.md: *„Přesnost ≠ mlčení"* + *ověř `grep`em přes celé repo* (F2/C3/B6/D1/D4).
   `grep` na symbol = 0 čtení → potvrzený F2. Levné ověření místo zahození.
3. **Předčasně uzavřený řádek** (jazykový fallback minut, protože řádek prověřen jen optikou
   A1/XSS a odškrtnut). → v SKILL.md: *„jeden řádek spouští víc pravidel"* (po A1 projdi A2/I2/J2)
   + *„traceuj negativní větev"* u `map[key]` / indexace / parametru bez defaultu / `JSON.parse`.

Meta-vzorec těch chyb: skill zůstával **lokální**, když měl jít **napříč repem / napříč pravidly**,
a **uzavíral nález o jednu otázku dřív**. Opravy míří sem. Poslední běh potvrdil, že zabraly
(F2 i fallback nově chyceny, ověřeně) — a **bez ztráty zdrženlivosti** (judgment mlčel správně,
sekce „co NENÍ nález" zůstala ostrá).

## 2026-07-03 — druhá vlna (monolity, hloubková osa, zápis do GitHubu)

**jQuery monolit otestován — dva dual-runy.** Orion (jQuery monolit) + Elevate (druhý monolit).
Klíč: **kontrola úplnosti + hloubková osa přidané v téhle session GENERALIZOVALY.** Orion odhalil 4
tiché misy (`.replace()` nad `undefined` z `data-src` = řádek×pravidlo; dvojí init bez idempotence =
funkce×graf volání; `X && X`; mrtvý ternár). Na Elevate (nové repo, které opravy neviděly) generická
osa **obě „join" třídy chytila sama** (pády `.match()[1]`/`.getAttribute()`/`.replace()`; dvojí init
s hodnocením idempotence) — a to při **~0 false-positives**. Meta-oprava „rozuměj toku, neuzavírej
řádek po první optice" tedy funguje napříč repy.

**#1–4 mechanické záplaty NEZAPSÁNY — záměr.** Po Orionu jsme navrhli sink heuristiku, seznam DOM
lookupů, control-flow osu a „degenerate-construct" judgment kategorii. Elevate ukázal, že je generická
osa nese, tak **nezapsány** — mechanické heuristiky ohrožují tu ~0 FP přesnost, což je nejsilnější
aktivum. **Nepřidávej je zpětně z jednoho miss.** Teprve když se třída misů vrací a generická osa ji
opakovaně nechytá, zvaž.

**NEODLAĎOVAT zpátky (nové záměrné volby):**
- **Kontrola úplnosti = dvouosá** (krok 4): šířka (matice soubor × A–J) + hloubka (model chování;
  „reportuju z ověřeného, nebo z ‚myslím, že jsem to protraceoval'?"). Principy „Hotovo ≠ vypadá
  hotově" a „Řádek čti v kontextu chování" — ověřené porozumění zlepšuje úsudek **oběma směry**
  (comprehension tah, ne snížení prahu). **Matice měří šířku, ne hloubku** — velký soubor odškrtnutý
  přes pár sekcí = falešné razítko → `❓ mělce prošlé`.
- **A2 Gate (potvrzeno 2×):** výjimka, co přeruší init doplňku = **❌** („shodit doplněk stačí, nemusí
  spadnout celý e-shop"); pády patří na čelo blokujících. URL/DOM/fetch větev už ❌ byla.
- **Doménové „co NENÍ nález":** B5 (globál/core undefined z řazení skriptů) a B1 (class selektor
  k cílení prvků — žádný stabilní hook, `data-testid` zakázán B7). U obou drž hranici reálných nálezů
  (B5 = setTimeout/lifecycle/AJAX obsah; B1 = data-z-DOMu v dataLayer, B7, B8) — mají mirror v reference.
- **Partnerský výstup:** `rule_id`, čísla pravidel **i slovo „katalog"/„mimo katalog"** = interní,
  nikdy do komentáře/souhrnu. Každý inline komentář začíná značkou (`❌/⚠️/💡/❓`). Souhrn = rozcestník:
  jen blokující jmenovat, doporučení/tipy **obecně BEZ ČÍSEL** + max 3 témata + odkaz na řádky.
- `needs-human` → **`human-review`** (přejmenováno všude). F6 lockfily zobecněny na npm/yarn/pnpm/bun
  vč. prázdného pozůstatku (CI/corepack vybírá podle přítomnosti).

**Zápis do GitHubu — poslední brána pootevřena na PENDING.** `github_review` = `off`/`pending`/`submit`
(jeden zdroj pravdy v SKILL). Default `pending` (draft pod loginem člověka, submit dělá člověk).
`submit` (cíl, bez lidské kontroly) je **NAPSANÝ ale NEZVOLENÝ** — `COMMENT`-only natvrdo, nikdy
`REQUEST_CHANGES`; zapnout **až po opakovaně čistém pending výstupu**. Ověřené GitHub fakty (ať se
znovu nehádá): pending souhrn (`body`) je v GitHubu **neviditelný do submitu** → čti z výstupu běhu;
do pending draftu **nejde whole-file komentář** (`DraftPullRequestReviewComment` chce `position`, nemá
`subject_type:"file"`, 422) → nález na 0-řádkovém souboru zakotvi na **sousední diffovaný soubor**;
**nemaž živý draft** kvůli experimentu.

**Balení:** dřívější ZIPy tenhle týden neobsahovaly `.claude-plugin/plugin.json` — vylučovací vzor
`*/.*` ho vyhazoval. Zipuj s `-x '*/.DS_Store' '*/__MACOSX/*' '*/.git/*'`, ne `*/.*`.

## 2026-07-08 — třetí běh (Fable 5 jako gold standard)

Znovu Orion PR #2, ale regular = **Fable 5 na max effort** (~265 agentů, ~4,5 mil. tokenů, 350
nálezů, adversariální ověřování). **Není to apples-to-apples** — skill je jeden agent, jeden
průchod. Nesrovnávej počty (350 vs ~20); posuzuj skill vůči jeho účelu (levný přesný předfiltr),
ne vůči max-effort auditu. **Co drží:** ~0 false-positives i proti téhle lati; a **honesty edit
z 07-03 zafungovala** — skill 31 tis. ř. LESS označil `❓ mělce prošlé` a přiznal „lokální CSS/J
bugy mimo jistotu"; přesně tam žil regularův jediný **kritický** nález (`.sr-only{display:none}`).
Miss, ale **přiznaný**, ne orazítkovaný — tak to má být.

Dvě poučení → dvě záplaty (obě to slabší/rizikovější patro, ověřit na dalším běhu):

1. **Severita prózou nedrží spolehlivě.** Běh jel s **novou A2 Gate** (init-halting pád = ❌),
   a skill přesto dal `shoptakOrionTemplate` i `data-src` **⚠️**. Důvod: obě vysvětlení jsou
   podmíněná („*jen když* shop nevloží config") a model si tu podmíněnost přeložil na slevu
   ❌→⚠️. → záplata do A2 Gate: **„podmíněnost pádu závažnost nesnižuje; pravděpodobnost patří
   do `confidence`, ne do severity."** Poučení do budoucna: přeformulovat severitu obecnou
   prózou je slabá páka — musí mířit přímo na ten mechanismus záměny.
2. **Idempotence / graf volání se vrací.** Skill chytá listener *vázaný uvnitř* jiného handleru
   (E6 vidět v těle), ale míjí **neidempotentní funkci volanou z víc lifecycle hooků**
   (`setupFilterCloseButton` — minut podruhé, 2/3 monolity). Ten bug není v těle ani v jednom
   místě volání — vzniká z **počtu volání**. → záplata: **úzká control-flow osa** (v principu
   „řádek čti v kontextu chování" + krok 4): u funkce, co mění DOM / váže handlery, `grep` místa
   volání + ověř idempotenci. **Tohle je poprvé, co se z #1–4 něco (úzké #3) zapsalo** — protože
   se to vrátilo napříč běhy, ne z jednoho miss.

**Hraniční, vědomě neřešeno (ne miss):** `dataLayer[0].shoptet.currency` — Fable flagne kvůli
cizímu `dataLayer.push` před Shoptet záznamem, skill potlačil dle **naší reference** (currency =
platný přístup). Load-order edge; potlačení obhajitelné. A kategorie-název do HTML (Fable = XSS
hardening, skill neeskaloval jako „vlastní obsah") — mírně shovívavé, hardening-tier, ne blackout.

## Co je vědomě ODLOŽENÉ (ne opomenuté)

- **Judgment je zatím spíš opatrný.** Cross-file logické bugy chytne, jen když jsou dost jisté;
  jemnější rizika může minout. Vědomé — neřešit rozvolnění prahu z jednoho PR, hrozí šum.
- **Robustnost napříč populací pořád není „hotová."** Otestováno na dvou monolitech + dvou
  modulárních PR (viz session 2026-07-03) — dva běhy nejsou statistika. Pokračovat v dual-runech.
- **#1, #2, #4 mechanické záplaty (sink heuristika, seznam DOM lookupů, degenerate-construct
  judgment)** — vědomě NEZAPSÁNY; generická hloubková osa je nese. **#3 (control-flow / idempotence)
  zapsáno úzce na 07-08** — jako jediné z #1–4, protože se vrátilo napříč běhy (2/3 monolity).
  Nová záplata z jednoho miss dál nepatří (ohrozí ~0 FP).
- **SCSS do hloubky** skill jen skimuje (matice ho razítkuje jako pokrytý). Z velké části
  **stylelint-owned** → spadne pod linter vrstvu; reálná AI-mezera je jen užší zbytek.
- **Plně automatický `submit` (bez člověka) je NAPSANÝ, ale NEZVOLENÝ.** Default `pending`. Zapnout
  = přepnout `github_review` na `submit` v SKILL.md, **až** bude pending výstup opakovaně takový, že
  bys ho submitnul beze změny. Servisní identita (`shoptet-ai-reviewer`) patří až sem, ne k pending.
- **Linter vrstva (ESLint/stylelint/depcheck) není hotová** → všechny běhy jely v degradovaném režimu.
  Staví ji kolega; patří do boilerplate. Sem míří i sweep-typové věci (zakomentovaný mrtvý kód napříč
  soubory, lockfily, prázdné soubory) — na pozornost AI se u nich spolehnout nedá.
- **Backlog pravidel** (A6–A11, P1 GDPR, sekce J accessibility = runtime) — parkováno.

## Pasti, do kterých nespadnout

- **„Regular review našel víc → přidejme to do katalogu."** Ne. Rozliš *skill to minul* (patřilo
  do scope, oprav) od *skill to správně neřešil* (TS přesnost, doménové race conditiony, build
  tooling, kosmetika — mimo scope, patří člověku/jinému nástroji). Zaostřenost je záměr.
- **„Judgment našel něco mimo katalog!"** Nejdřív ověř, že to není existující pravidlo, které se
  jen neaktivovalo (XSS-přes-konkatenaci = A1, ne judgment; rozbitý import z prázdného souboru =
  F5/F2, ne judgment). Teprve pak je to skutečně mimo katalog.
- **Věřit jednomu běhu.** Každá úprava se ověřuje na dalším PR, ideálně re-runem na tom samém,
  co dřív selhal.
- **„Generická osa to na jednom PR nechytila → přidejme mechanickou heuristiku."** Ne — ohrozí
  ~0 FP přesnost. Heuristiku zvaž až u opakovaně se vracejícího vzoru, ne z jednoho miss.
- **Zapnout `submit` předčasně.** Je připravený schválně; brzdí ho jen **důvěra ve výstup**
  (opakovaně čistý pending), ne technika. Přepnutí je jeden znak — ta laťka je celý smysl.
- **Řešit neviditelný pending souhrn tím, že ho zveřejníš.** Souhrn se během pending čte z výstupu
  běhu; publikace navíc = ztráta lidské kontroly, přesně to, čemu pending brání.

## Poslední validovaný stav

Tři běhy (2026-07-03 až -08), všechny bez linteru:
- **Orion** (jQuery monolit, PR #2): 4 tiché misy (data-src, dvojí init, `X && X`, mrtvý ternár) —
  „join přes dva kontexty / uzavřeno po první optice". Z toho návrh #1–4.
- **Elevate** (druhý monolit, PR #1): generalizační test. Generická hloubková osa **obě „join"
  třídy chytila bez #1–4**, při ~0 FP na novém repu. Potvrzeno: A2 gradováno ⚠️ místo ❌, SCSS jen
  skimován. #1–4 proto nezapsány (kromě později úzkého #3).
- **Orion PR #2 znovu vs. Fable 5 max effort** (07-08): precision drží (~0 FP i proti max-effort
  auditu), honesty edit funguje (kritický `.sr-only` v přiznaném LESS blind spotu). Dvě poučení →
  A2 „podmíněnost nesnižuje závažnost" + úzká control-flow osa.
- **Pending zápis** proběhl end-to-end (12 komentářů + tělo, nesubmitnuto); odhalil neviditelný
  pending souhrn a strandování 0-řádkových nálezů (obojí ošetřeno).

**Otevřené k ověření na dalším běhu:** (a) drží teď A2 pády jako ❌ na čele blokujících? (b)
nezačne úzká control-flow osa u E6/B5 přestřelovat (hlásit idempotenci, kde guard výš existuje)?
Pořád platí: tři běhy nejsou důkaz robustnosti napříč populací. Než přepneš `submit`, chtěj
opakovaně čistý pending výstup napříč typy PR.
