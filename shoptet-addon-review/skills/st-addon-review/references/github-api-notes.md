# GitHub API — poznámky pro zápis review

> Referenční mechanika k **kroku 6** (zápis do GitHubu) a k **re-runu**. Čti až když review
> reálně zapisuješ; při vlastním průchodu kódem (kroky 0–5) není potřeba. Rozhodovací pravidla
> („jeden review", „COMMENT-only", zakotvení 0-řádkových nálezů, markery) jsou v `SKILL.md` —
> tady je jen *jak* to přes API udělat a co ověřeně nefunguje.

## Vytvoření review

Jeden review se všemi inline komentáři najednou:

```sh
gh api POST /repos/{owner}/{repo}/pulls/{n}/reviews \
  -f body='<souhrn>' \
  -F 'comments[][path]=src/...' -F 'comments[][line]=42' -F 'comments[][body]=<text>'
```

- **`pending` (draft):** review vytvoř **bez pole `event`** → zůstane ve stavu `PENDING`. Verdikt
  (Comment / Approve / Request changes) vybírá až člověk při submitu; skill ho jen doporučí
  (`recommended_verdict` ve výstupu).
- **`submit`** (autonomní): přidej **`event=COMMENT`** → publikuje se okamžitě. **Nikdy
  `REQUEST_CHANGES` ani `APPROVE`** (viz invariant 1 v `SKILL.md`).
- `suggestion` v těle komentáře = GitHub ` ```suggestion ` blok (oprava na jedno kliknutí).

## Pending draft — viditelnost (ověřeno)

- **Tělo (`body`) pending draftu je v GitHubu neviditelné do submitu** — nezobrazí se v timeline
  ani se nenačte do submit boxu; vidět jsou jen inline komentáře v „Files changed". → souhrn ke
  kontrole čti **z výstupu běhu (chat)**, ne z GitHubu.
- **Pending draft vidí jen účet, který ho založil** → musí vzniknout pod tvým vlastním `gh`
  loginem (aby sis ho mohl projít a submitnout), ne pod servisní identitou.
- **Jeden pending review na uživatele a PR** (GitHub limit). Pokud už jeden visí, nový nezakládej
  — viz guard v `SKILL.md` › *Re-run*.

## Nález na souboru bez řádku v diffu (0-řádkový / smazaný / mimo diff)

- **Do pending draftu nejde komentář „na celý soubor".** `DraftPullRequestReviewComment` vyžaduje
  `position` v diffu a **nemá `subject_type: "file"`** — API vrátí **422** (ověřeno).
- File-level komentář jde jen samostatným endpointem, který ale **rovnou publikuje** (notifikuje
  partnera) → proti pending režimu.
- Řešení: zakotvi řádkový komentář na **nejbližší související diffovaný soubor** (např. prázdný
  `yarn.lock` → `package.json`) a v textu odkaž na ten skutečný soubor. Skutečný soubor ulož do
  markeru (`file`), ne ten, na který kotvíš.

## Re-run — git srovnání přes API

- Komentáře nesou SHA commitu, ke kterému patří: **`commit_id` / `original_commit_id`**. Odtud
  vezmeš `old_sha` minulého běhu.
- **Outdated komentář** (kód pod ním se změnil) má GitHub automaticky **`position: null`** — levný
  signál, že se místa nálezu diff dotkl.
- Po **force-pushi** nemusí být `old_sha` lokálně → dojeď `git fetch origin <old_sha>`.
- Mapování řádků starý↔nový: `git diff <old_sha>..<new_sha>` a posun přes hunky.
