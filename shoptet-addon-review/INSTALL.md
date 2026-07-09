# shoptet-addon-review — instalace a první test

Kolekce (plugin) pro FE code review vizuálních Shoptet doplňků v Claude Code.
Skill `st-addon-review` reviewuje addon PR nad **naklonovaným repem** proti katalogu pravidel.

## Struktura

```
shoptet-addon-review/
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── st-addon-review/
        ├── SKILL.md
        └── references/
            ├── rules-catalog.md      # rubrika (čte agent)
            ├── shoptet-reference.md  # companion pro B1/B4/B6 (čte agent)
            └── guide.md              # lidská příručka (agent nepotřebuje)
```

## Zařazení do marketplace `shoptet/skills`

1. Zkopíruj celou složku `shoptet-addon-review/` do `plugins/` v repu `shoptet/skills`.
2. Zaregistruj plugin v kořenovém `.claude-plugin/marketplace.json` — přidej záznam ve
   **stejném formátu, jaký mají existující položky** (např. `shoptet-api`). Nekopíruj schéma
   odsud naslepo; drž se toho, co je v souboru už zavedené.
3. `plugin.json` je držený minimální — pokud ostatní pluginy mají navíc pole (`author`,
   `license`, …), doplň je podle nich.
4. Lokální vývoj: `claude plugin marketplace add /absolutni/cesta/k/shoptet-skills`,
   pak `/plugin install shoptet-addon-review@shoptet-skills`, a `/reload-plugins`.
5. Ověř, že se skill auto-loaduje — pusť prompt, který odpovídá `description` (viz níže).
   Když se nenačte, je to skoro vždy problém formulace `description`, ne kódu.

## První test (kickoff prompt)

Přepni se do **konkrétního addon repa** (mít ho naklonované, ideálně na commitu/PR, který
chceš reviewovat) a napiš Claude Code něco jako:

> Jsi addon reviewer, řiď se skillem `st-addon-review`. Zreviewuj PR #<číslo>
> (nebo větev `<branch>` / merge commit `<sha>`). Vytáhni si diff přes `gh`/`git`, přečti
> **dotčené soubory i jejich okolí** v repu, projeď kód proti katalogu a vrať nálezy podle
> výstupního kontraktu + českou souhrnnou zprávu. **Zápis do GitHubu řídí přepínač
> `github_review` v `SKILL.md` (default `pending` = draft pod mým `gh` loginem, nesubmituje se —
> projdu a odešlu ručně). Ať je nastavený jakkoli, výstup vždy vypiš i sem.**

### Na co u prvního běhu koukat

- **False positives** — kolik si agent přidal navíc (proti druhému review / realitě kódu).
  U nás nejdůležitější číslo, a bez člověka za tím o to víc.
- **B1/B4/B6** — jestli s `shoptet-reference.md` reálně fungují, nebo pořád tápou.
- **Gate** — jestli správně rozlišuje blokující vs. doporučené u podmíněných pravidel.
- **ESLint** — na partnerském repu nejspíš zatím **není** shoptet lint config → čekej
  degradovaný režim (`linter_available: false`). To je v pořádku, jen ať to agent přizná.
- Vyber PR, který **není čistý** — má aspoň jeden reálný bloker a nějaký hraniční případ.
  Na čistém PR se false positives neukážou.
