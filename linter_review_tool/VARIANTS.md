# Tři varianty spouštění review nástroje

Nástroj lze zapojit třemi nezávislými způsoby. **Var. 1** je lokální a je
ortogonální k CI; **Var. 2 a 3** jsou dvě vzájemně se vylučující CI strategie
(vybírá se vstupem `review_mode`).

| # | Varianta | Kdy běží | Profil | Výstup | Blokuje? |
|---|----------|----------|--------|--------|----------|
| 1 | **pre-commit** | lokálně před commitem | strict | exit kód (fail commitu) | ano (lokálně, obejitelné) |
| 2 | **blockery na PR** | CI na PR | strict | inline komentáře + REQUEST_CHANGES | ano (gate) |
| 3 | **pending po PR** | CI na PR | full | PENDING draft review pro reviewera | ne (reviewer kurátoruje) |

---

## Varianta 1 — pre-commit (lokální)

Viz `PRECOMMIT.md`. Husky hook spustí `review.js src --strict`; při spolehlivém
blockeru zruší commit. Obejitelné (`--no-verify`), v rukou vývojáře — pohodlí,
ne gate.

## Varianta 2 — blockery na PR (default)

Výchozí chování reusable workflow `checks.workflow.yml`. Volající nemusí nic
předávat:

```yaml
jobs:
  checks:
    uses: shoptet/addon-repository-actions-config/.github/workflows/checks.workflow.yml@main
    # review_mode: blockers  (default)
```

- Běží `review.js src --strict --rdjson`.
- **reviewdog** (`github-pr-review`) přidá inline komentáře jen na řádky diffu.
- Krok **Set review verdict** založí `REQUEST_CHANGES` při blockeru a automaticky
  ho **dismissne**, jakmile jsou blockery pryč.
- Autor komentářů = `github-actions[bot]`, token = `GITHUB_TOKEN` (nic navíc).

## Varianta 3 — pending komentáře po PR

Zapíná se `review_mode: pending` a **vyžaduje secret `reviewer_pat`** (PAT
reviewera). Pending review je viditelná **jen svému autorovi**, proto ji musí
založit reálný uživatel, ne bot.

```yaml
jobs:
  checks:
    uses: shoptet/addon-repository-actions-config/.github/workflows/checks.workflow.yml@main
    with:
      review_mode: pending
    secrets:
      reviewer_pat: ${{ secrets.REVIEWER_PAT }}
```

- Běží `review.js src --rdjson` (**full** profil — vše včetně heuristik).
- Krok **Post pending review** (github-script, autentizace přes `reviewer_pat`):
  - vytáhne z PR diffu komentovatelné řádky (parsuje hunky),
  - z nálezů poskládá komentáře jen na těchto řádcích,
  - smaže případnou starou pending review téhož autora (jedna pending / uživatel / PR),
  - založí review **bez `event`** → zůstane **PENDING** (draft).
- Reviewer (majitel PAT) draft uvidí na PR, projde ho a odešle přes „Submit review“.

### Nutná příprava pro Var. 3
1. Vytvoř **fine-grained PAT** reviewera (`shoptet-addon-reviewer`), scope:
   jen tento repo + *Pull requests: read & write*.
2. Ulož jako secret `REVIEWER_PAT` v repu / org.
3. Předej ho workflow (viz snippet výše).

### Omezení Var. 3
- Pending draft vidí **jen majitel PAT** — dává smysl u **jednoho fixního**
  reviewera; ostatní ho neuvidí.
- Komentáře budou **autorsky pod tím účtem** (míchá automat s jeho review).
- **Bezpečnost:** osobní/účtový token v CI; použij fine-grained PAT s minimálním scope.
- **Fork PR:** secret se do workflow z forku nedostane → Var. 3 tam neběží.
- Nelze lokálně otestovat (potřebuje živý PR + PAT) — připraveno, ověř na reálném PR.

---

## Kombinace
- **1 + 2** je typické: rychlá lokální zpětná vazba + tvrdý PR gate (stejný strict profil).
- **1 + 3**: lokálně strict blok, na PR nenásilné pending návrhy pro reviewera.
- **2 a 3 najednou** nedávají smysl (dvě různé review strategie na stejném PR) —
  vyber jednu přes `review_mode`.
