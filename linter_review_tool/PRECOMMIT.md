# Pre-commit hook (husky) — návod pro boilerplate

Lokální pre-commit hook, který spustí review nástroj ve **strict** profilu a
**zablokuje commit** při spolehlivém blockeru. Cílem je dát vývojáři rychlou
zpětnou vazbu dřív, než pushne PR.

> ⚠️ **Není to gate.** Hook jde obejít (`git commit --no-verify`) a je plně
> v rukou partnera. Autoritativní kontrola zůstává **CI na PR**
> (`checks.workflow.yml`, `review.js … --strict`). Pre-commit je pohodlí, ne
> vynucení.

## Předpoklady
- Projekt je **git repozitář** (husky bez `.git` hook neaktivuje).
- Nástroj je v projektu jako `review-tool/` a má nainstalované závislosti
  (`cd review-tool && yarn`). Hook volá `node review-tool/review.js`.

## Zavedení do boilerplate

1. Přidej husky:
   ```sh
   yarn add -D husky
   ```
2. Do `package.json` přidej `prepare` script (zajistí aktivaci u každého, kdo
   si projekt naklonuje a spustí `yarn`):
   ```json
   {
     "scripts": {
       "prepare": "husky",
       "review": "node review-tool/review.js src",
       "review:strict": "node review-tool/review.js src --strict"
     }
   }
   ```
3. Inicializuj husky a vytvoř hook:
   ```sh
   npx husky init
   ```
4. Přepiš `.husky/pre-commit` na:
   ```sh
   # Shoptet addon review — strict profile commit gate.
   # Runs only the 100%-reliable rules (see review-tool/COVERAGE.md → Profily běhu).
   # Bypass with `git commit --no-verify`. The authoritative gate is CI, not this hook.
   if git diff --cached --name-only --diff-filter=ACM | grep -qE '\.(js|css|scss|less|html?)$'; then
     node review-tool/review.js src --strict
   fi
   ```

Hotovo. `.husky/` i změny v `package.json` commitni — u ostatních se hook
aktivuje sám při `yarn` (přes `prepare`).

## Jak se chová
- **Code změna (js/css/scss/less/html) ve staged:** spustí `review.js src --strict`;
  při blockeru vrátí kód 1 → **commit se zruší**.
- **Commit bez code souborů** (např. jen `.md`): guard lint přeskočí → commit projde.
- **`git commit --no-verify`:** hook se přeskočí úplně.

## Poznámky / omezení
- **Boilerplate „nesmíš měnit strukturu složek":** `.husky/` je mimo `src/`,
  takže je to v pořádku; měníš jen `package.json` a přidáváš `.husky/`.
- **Rychlost:** lintuje celé `src` (ne jen staged) — zachová cross-file pravidlo;
  u běžného addonu jde o jednotky sekund.
- **Profil:** strict schválně (jen spolehlivá pravidla), ať commit neblokují
  heuristiky. Heuristiky vývojář uvidí kdykoli přes `yarn review` (full).
- **Změna profilu:** kdo chce blokovat i heuristiky, přepíše v hooku
  `--strict` → (nic) pro full; pro „jen varovat" spusť bez blokace
  (`node review-tool/review.js src || true`).
