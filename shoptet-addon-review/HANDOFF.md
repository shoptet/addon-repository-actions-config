# HANDOFF — datovaný žurnál běhů

> **Append-only kronika ladících běhů.** Co se který den testovalo, co z toho vyplynulo, jaký
> byl závěr. Nová session = nový datovaný zápis dole; **staré zápisy se retroaktivně nepřepisují**
> (jsou to záznamy stavu v čase, ne aktuální pravda).
>
> **Trvalá rozhodnutí sem nepatří.** „Co platí teď" (rozhodnutí, NEODLAĎOVAT-zpátky mantinely,
> co je odloženo, pasti, jak se skill ladí) žije v `CONTEXT.md` — jediný zdroj pravdy. Když z běhu
> vzejde trvalé rozhodnutí, zapiš ho do CONTEXT a odsud na něj jen odkaž. Tím se meta soubory
> nerozjíždějí.

## 2026-07-03 — druhá vlna (monolity, hloubková osa, zápis do GitHubu)

**jQuery monolit otestován — dva dual-runy.** Orion (jQuery monolit) + Elevate (druhý monolit).
Klíč: **kontrola úplnosti + hloubková osa přidané v téhle session GENERALIZOVALY.** Orion odhalil 4
tiché misy (`.replace()` nad `undefined` z `data-src` = řádek×pravidlo; dvojí init bez idempotence =
funkce×graf volání; `X && X`; mrtvý ternár). Na Elevate (nové repo, které opravy neviděly) generická
osa **obě „join" třídy chytila sama** (pády `.match()[1]`/`.getAttribute()`/`.replace()`; dvojí init
s hodnocením idempotence) — a to při **~0 false-positives**. Meta-oprava „rozuměj toku, neuzavírej
řádek po první optice" tedy funguje napříč repy.

Z běhu vzešlé záměrné volby (dvouosá kontrola úplnosti, A2 gate, partnerský výstup, `human-review`
přejmenování, generalizace F6 lockfilů, a rozhodnutí #1–4 mechanické záplaty NEZAPSAT) →
**zapsáno do `CONTEXT.md`** (sekce *Záměrná rozhodnutí* a *Co je vědomě ODLOŽENÉ*).

**Zápis do GitHubu — poslední brána pootevřena na PENDING.** `github_review` = `off`/`pending`/`submit`
(jeden zdroj pravdy v SKILL). Default `pending` (draft pod loginem člověka, submit dělá člověk).
Ověřené GitHub fakty (ať se znovu nehádá): pending souhrn (`body`) je v GitHubu **neviditelný do
submitu** → čti z výstupu běhu; do pending draftu **nejde whole-file komentář**
(`DraftPullRequestReviewComment` chce `position`, nemá `subject_type:"file"`, 422) → nález na
0-řádkovém souboru zakotvi na **sousední diffovaný soubor**; **nemaž živý draft** kvůli experimentu.

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

Dvě poučení → dvě záplaty:

1. **Severita prózou nedrží spolehlivě.** Běh jel s novou A2 Gate (init-halting pád = ❌), a skill
   přesto dal `shoptakOrionTemplate` i `data-src` **⚠️** (podmíněnost si přeložil na slevu ❌→⚠️).
   → záplata **„podmíněnost pádu závažnost nesnižuje; pravděpodobnost patří do `confidence`"**.
2. **Idempotence / graf volání se vrací.** Skill chytá listener *vázaný uvnitř* jiného handleru
   (E6 v těle), ale míjí **neidempotentní funkci volanou z víc lifecycle hooků**
   (`setupFilterCloseButton` — minut podruhé, 2/3 monolity). → záplata **úzká control-flow osa**.

Obě záplaty jsou trvalé → **zapsáno do `CONTEXT.md`** (*Záměrná rozhodnutí*). Jsou to slabší/rizikovější
patra, ověřit na dalším běhu.

**Hraniční, vědomě neřešeno (ne miss):** `dataLayer[0].shoptet.currency` — Fable flagne kvůli
cizímu `dataLayer.push` před Shoptet záznamem, skill potlačil dle naší reference (currency =
platný přístup). Load-order edge; potlačení obhajitelné. A kategorie-název do HTML (Fable = XSS
hardening, skill neeskaloval jako „vlastní obsah") — mírně shovívavé, hardening-tier, ne blackout.

## 2026-07-10 — re-run mechanismus zapsán do SKILL.md

**Re-run mechanismus zapsán do SKILL.md** (skryté markery `st-review:…`, git srovnání
`old_sha..new_sha`, tri-state klasifikace nový/trvající/vyřešený, guard na pending kolizi) —
trvalá rozhodnutí viz `CONTEXT.md`. Řeší dřívější podspecifikovaný re-run dedup (jediná věta
„porovnávej podle `rule_id + file + line`", která předpokládala schopnosti, jež skill neměl).

Dvě drobnosti z ověření (nic neblokuje):
1. **Kolize 6-znakových `fp`** u dvou identických řádků (týž soubor, totéž pravidlo) → do SKILL.md
   doplněno rozlišení pořadovým číslem výskytu (`fp#2`).
2. **Legacy pending draft z 07-03 vznikl před markery.** Po jeho submitu ho příští re-run
   vyhodnotí jako **první běh** → na tom jednom PR vzniknou jednorázové duplicity. **Ošetřit
   ručně**, skill je v pořádku (marker je od teď prerekvizita, kterou první běh zakládá).

## Poslední validovaný stav

Tři běhy (2026-07-03 až -08), všechny bez linteru:
- **Orion** (jQuery monolit, PR #2): 4 tiché misy (data-src, dvojí init, `X && X`, mrtvý ternár) —
  „join přes dva kontexty / uzavřeno po první optice". Z toho návrh #1–4.
- **Elevate** (druhý monolit, PR #1): generalizační test. Generická hloubková osa **obě „join"
  třídy chytila bez #1–4**, při ~0 FP na novém repu. Potvrzeno: A2 gradováno ⚠️ místo ❌, SCSS jen
  skimován. #1–4 proto nezapsány (kromě později úzkého #3, control-flow osa).
- **Orion PR #2 znovu vs. Fable 5 max effort** (07-08): precision drží (~0 FP i proti max-effort
  auditu), honesty edit funguje (kritický `.sr-only` v přiznaném LESS blind spotu). Dvě poučení →
  A2 „podmíněnost nesnižuje závažnost" + úzká control-flow osa.
- **Pending zápis** proběhl end-to-end (12 komentářů + tělo, nesubmitnuto); odhalil neviditelný
  pending souhrn a strandování 0-řádkových nálezů (obojí ošetřeno).

**Otevřené k ověření na dalším běhu:** (a) drží teď A2 pády jako ❌ na čele blokujících? (b)
nezačne úzká control-flow osa u E6/B5 přestřelovat (hlásit idempotenci, kde guard výš existuje)?
Pořád platí: pár běhů nejsou důkaz robustnosti napříč populací. Než přepneš `submit`, chtěj
opakovaně čistý pending výstup napříč typy PR.
