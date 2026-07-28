# CONTEXT — AI reviewer for Shoptet addons

> Context for Claude Code and **the single source of truth for "what holds right now"**: what
> we're building, why, which decisions were made, what is deliberately deferred, which guardrails
> must not be tuned back out, and what mode we're running in. This is not a skill — the review
> itself is driven by `st-addon-review/SKILL.md`. This is the map around it.

## What we're building and why

Partners write visual (front-end) addons for Shoptet e-shops. Today a human with domain
knowledge reviews them manually, which slows the team down. Goal: **an AI reviewer that runs
before the human and clears the routine findings**, leaving the human only the domain questions
and borderline cases.

The primary goal, always: **never let an addon break or slow down an e-shop.** Partners are
mostly not strong programmers — large monolithic scripts, often jQuery, never any tests.

## The three-layer model (key decision)

Findings are split by which tool is the cheapest one that catches them:

- **Linter** — mechanical, deterministic (`var`, `===`, `console.log`, dead code). Handled by
  ESLint (and friends: stylelint, jscpd, depcheck, secret-scan). **The AI does not re-examine
  these by eye** — it runs the linter as a tool and just adopts its output. This layer is being
  built separately by a colleague; **it is not finished yet and is missing from the addon repos
  → expect degraded mode** (`linter_available:false`).
- **AI** — semantics the linter can't do (XSS, reimplementing Shoptet core, parsing the DOM
  instead of the dataLayer, duplication). This is where the AI reviewer's value lies.
- **Runtime** — what can only be caught at runtime (interference, performance, most
  accessibility). **Out of scope** (no `runtime` owner); Playwright/axe/Lighthouse planned later.

## Decisions that hold

- **The catalog drives the gate.** Only a finding mapped to a catalog rule may block
  (`blocking`) — the gate must be fair and defensible.
- **Own judgment (`judgment`) is ON.** It is **non-binding, never blocking**
  (capped at `recommended`), always `source: judgment`. It may only cover a **concrete bug /
  security / functional risk with high confidence** — no taste, no speculation. A recurring
  judgment finding → `rule_candidate: true` (candidate for a new rule; only a human edits the
  catalog, never the agent). How judgment is presented to the partner → *Deliberate decisions ›
  Partner-facing output* below.
- **Precision over completeness.** A false finding costs more partner trust than a miss. When
  the AI isn't sure about intent → a question (`❓`), not a claim.
- **Target environment = review in Claude Code** over a cloned repo (not CI). The agent pulls
  the diff via `git`/`gh` and reads context from the full working copy, not from an isolated diff.
- **Gate ≠ REQUEST_CHANGES.** In autonomous `submit` the AI always sends `COMMENT`
  (non-blocking); only a human may flip the PR to Approve/Request changes in `pending`.
  Enforcing the mandatory phase is the job of a separate required check (a CI layer outside the
  skill) — the mechanics are ready but **currently disabled across the board and unused**
  (including the `human-review` label).
- **The AI edits neither the catalog nor the code.** It only proposes fixes (`suggestion`),
  never applies them.
- **Multi-agent deferred** — start with a single agent. Changes concern **new addons only**.

## Current operating mode

**Real reviews.** You run it on PRs **with no human review** — the AI is the first (and so far
only) reviewer, exactly as it's meant to work in production. The output is a real review.

- **Judgment: ON** (guardrails above).
- **Writing to GitHub: controlled by the `github_review` switch in SKILL.md** ("Writing back to
  GitHub" section), currently **`pending`**. Three states: `off` = just print; `pending` = insert
  as a **draft** review under the human's login (nothing is sent until the human submits) + print
  to chat; `submit` = **target state** — sends the review immediately (`event: COMMENT`, never
  `REQUEST_CHANGES` or `APPROVE`) **without a human check**. `submit` = the "last gate"; turn it
  on **only after repeatedly clean pending output** (output you would have submitted unchanged
  N runs in a row, across PR types). Until then the default is `pending`. **The skill does no
  labels and no gate in any state** — the gate is a separately handled CI layer. You switch by
  editing that single value in SKILL.md.
- **With no human behind it, the bar for false findings is even higher** — nobody cleans up
  after the AI before it (one day) gets sent. Prefer `❓` and restraint over a confident claim
  on a disputable point.

## Where the confidence for this step came from

The previous validation run on 6 real PRs (jQuery monoliths, all without ESLint): a high catch
rate of catalog findings, few false findings, working restraint (B1 suppressed where the partner
reads the dataLayer correctly; no B6 false positive). The catalog was also fine-tuned from that
run:
- **C1 split** — it blocks on an **unreviewable monolith** (mixed responsibilities), not on mere
  length (that's ⚠️; the line-count threshold belongs to the linter anyway).
- **A1↔E1 cross-reference** — `+`-concatenated HTML with API data is **A1 (XSS, blocking)**, not
  just stylistic E1.

## How the skill gets tuned

The strongest tool is the **double run**: run `st-addon-review` and, alongside it, a "plain"
Claude Code review on an **already-reviewed** PR where the human comments serve as a
**reference baseline**. Why exactly this: the most dangerous skill failures are **silent
misses** — something the skill saw and swallowed, or never even attempted. A false finding is
visible at a glance; a miss leaves no trace and only a comparison with a second review exposes
it. Without that comparison, "looks good" means nothing. Verify every tweak on another PR —
ideally by re-running on the one that previously failed.

## Deliberate decisions (do NOT tune back out)

Instructions in SKILL.md that look "odd" are **not arbitrary** — each one is a patch for a real
error observed in runs. Before you tune any of them back out, read why it's there.

**Three fixed calibration errors (from the first runs):**
1. **Wrong tool** (empty files) → for F5 and the like, use the right tool/verification.
2. **A silently dropped verifiable lead** (dead code in `ShkProject` — "maybe F2… better not",
   dropped it) → *"Precision ≠ silence"* + *verify with `grep` across the whole repo*
   (F2/C3/B6/D1/D4). `grep` on the symbol = 0 reads → confirmed F2. Cheap verification instead
   of dropping.
3. **A prematurely closed line** (a language fallback missed because the line was checked only
   through the A1/XSS lens and ticked off) → *"one line triggers multiple rules"* (after A1,
   run A2/I2/J2) + *"trace the negative branch"* for `map[key]` / indexing / a parameter without
   a default / `JSON.parse`.

Meta-pattern of those errors: the skill stayed **local** when it should have gone **across the
repo / across rules**, and it **closed a finding one question too early**.

**Calibration confirmed across runs:**
- **Completeness check = two axes:** breadth (file × A–J + P matrix) + depth (behavior model;
  "am I reporting from verified understanding, or from 'I think I traced it'?"). **The matrix
  measures breadth, not depth** — a large file ticked off via a few sections = a false stamp →
  `❓ shallowly reviewed`.
- **A2 Gate:** an exception that interrupts addon init = **❌** (belongs at the top of the
  blockers), not ⚠️. And **conditionality of the crash does not reduce severity** — "*only if*
  the shop doesn't insert the config" is low probability → belongs in `confidence`, **not** in
  severity. (The model twice translated conditionality into a ❌→⚠️ discount; prose is a weak
  lever, so this targets that exact substitution mechanism directly.)
- **The narrow control-flow axis:** for a function that mutates the DOM / binds handlers,
  `grep` the call sites + verify idempotence. **A non-idempotent function called from multiple
  lifecycle hooks** is a bug born from the *call count* — invisible in the body or in any single
  call site (E6/B5). The only one of the considered mechanical patches that got written down —
  because it recurred across runs (2/3 monoliths).
- **Domain "what is NOT a finding":** B5 (global/core undefined due to script ordering) and B1
  (class selectors for targeting elements). For both, hold the line on real findings — they
  have counterparts in `shoptet-reference.md`.
- **Partner-facing output:** `rule_id`, rule numbers **and the words "catalog" / "outside the
  catalog"** = internal, never in a comment/summary. Judgment findings go in the summary into
  a separate block **"AI navíc upozorňuje (nezávazné)"** (the partner-facing name, in Czech —
  roughly "Additional non-binding AI notes"; "outside the catalog" is internal). Every inline
  comment starts with a mark (`❌/⚠️/💡/❓`). The summary = a signpost: name only the blockers;
  recommendations/tips generally, **WITHOUT counts** + max 3 topics.

## What is deliberately DEFERRED (not forgotten)

- **Judgment is still rather cautious.** It catches cross-file logic bugs only when they're
  certain enough; it may miss subtler risks. Deliberate — don't loosen the threshold based on
  a single PR, that risks noise.
- **Mechanical heuristics (sink heuristic, DOM-lookup list, "degenerate-construct" judgment)**
  deliberately NOT written down — the generic depth axis carries them. Don't add them back from
  a single miss; that endangers the ~0-false-findings precision, the strongest asset. Consider
  only for a pattern that keeps coming back.
- **Robustness across the population still isn't "done."** Tested on two monoliths + two
  modular PRs — a few runs aren't statistics. Keep doing double runs.
- **Deep SCSS** the skill only skims; **stylelint** will cover most of it → belongs to the
  linter layer. The real AI gap is only the narrower remainder.
- **The linter layer (ESLint/stylelint/depcheck) is not finished** → all runs so far were in
  degraded mode. A colleague is building it; it belongs to the boilerplate. Repo-wide checks
  across files also point there (commented-out dead code, lockfiles, empty files).
- **A persisted findings JSON for re-runs is not needed** — finding identity is carried by the
  hidden markers + the git commit comparison (see `SKILL.md` › *Re-run*).
- **TODO (future): eval set + run storage.** It **DOES NOT EXIST** yet — no runs are stored,
  nothing is compared against anything; a human walks through the individual outputs and it will
  stay that way for a while. Once measuring regressions on catalog/skill changes becomes
  necessary, it will be built like this: pick ~5–10 representative cases from real (even closed)
  PRs; for each, keep the **input** (repo + SHA / diff) and a **hand-cleaned reference output**
  (a "blessed" baseline) — i.e. *what the review should have looked like*, not the raw output
  with today's errors (otherwise today's errors get cemented in as the target). Because this is
  an LLM over free text, **JSON is not compared 1:1** — from each case distill a short list of
  **must-find** (findings that MUST appear, incl. severity), **must-not-flag** (false-positive
  traps), and for conditional rules the expected ❌/⚠️ branch. Regression = replay the same PRs
  with the modified skill and check the list still holds.
- **Fully automatic `submit` (no human) is WRITTEN but NOT CHOSEN.** The default is `pending`.
  Turn it on once pending output is repeatedly good enough that you'd submit it unchanged. The
  service identity (`shoptet-ai-reviewer`) belongs to that stage, not to pending.
- **Rule backlog** (A6–A11, section J accessibility = runtime) — parked. **P1 (cookie consent
  for tracking) was codified from the backlog on 2026-07-22** — the judgment channel found it in
  the wild (datixo PR #3, persistent tracking without `shoptet.consent`) and, being judgment, it
  couldn't block (invariant 3); exactly the codification path the design counts on.

## Traps not to fall into

- **"The regular review found more → let's add it to the catalog."** No. Distinguish *the skill
  missed it* (it was in scope, fix it) from *the skill correctly didn't handle it* (TypeScript
  precision, domain race conditions, build tooling, cosmetics — out of scope, belongs to a human
  or another tool). The narrow focus is intentional.
- **"Judgment found something outside the catalog!"** First verify it isn't an existing rule
  that simply didn't fire (XSS-via-concatenation = A1; a broken import from an empty file =
  F5/F2).
- **Trusting a single run.** Every tweak is verified on another PR, ideally by re-running the
  one that failed.
- **"The generic axis didn't catch it on one PR → let's add a mechanical heuristic."** No — it
  endangers the ~0-false-findings precision. Consider a heuristic only for a pattern that keeps
  coming back.
- **Turning `submit` on prematurely.** It is ready on purpose; the only brake is **trust in the
  output** (repeatedly clean pending), not the tech. Flipping it is one character — that bar is
  the whole point.
- **"Fixing" the invisible pending summary by publishing it.** During pending, the summary is
  read from the run output; publishing it separately = losing the human check, exactly what
  pending protects against.

## Files (the skill package)

```
shoptet-addon-review/
├── .claude-plugin/plugin.json
├── CONTEXT.md                             # this file — state, decisions, mode
├── INSTALL.md                             # installation + kickoff prompt
└── skills/st-addon-review/
    ├── SKILL.md                           # the review process (drives the agent)
    └── references/
        ├── rules-catalog.md               # rubric A–J, P (read by the agent)
        ├── shoptet-reference.md           # companion for B1/B4/B6 (read by the agent)
        └── github-api-notes.md            # GitHub write mechanics (read by the agent in step 6)
```

**Packaging the plugin into a ZIP:** exclude `-x '*/.DS_Store' '*/__MACOSX/*' '*/.git/*'`,
**not** `*/.*` — the `*/.*` pattern also drops `.claude-plugin/plugin.json` and the package is
then broken.

## What to watch during runs

- **Judgment: value vs. noise.** How many `judgment` findings are real value (a bug/risk the
  catalog would have missed) and how many are noise? That ratio decides whether the channel goes
  to full production. Watch the trap: before celebrating a finding as "outside the catalog",
  verify it isn't an existing rule that simply didn't fire (like XSS-via-concatenation = A1).
- **False findings** — still the most important number, now more than ever (no human behind it).
- **Gate/severity** on conditional rules (C1: does it give a long-but-cohesive file a ⚠️?).
- **Degraded mode** — the repo most likely has no ESLint; make sure the agent admits it and
  keeps the mechanical findings at `confidence: medium`.
- **Pending review only, never submit.** The skill inserts the findings as a draft; walking
  through and sending them is on the human. The skill must not submit on its own, change labels,
  or enable the gate.

## Partner pre-submit checklist (not delivered yet)

**Not delivered to partners yet**, and once introduced, it will most likely take a different
form — parked here only as a seed. It is a human distillation of the catalog, **not a source of
truth**: the binding rules are in `rules-catalog.md`; this is just a partner-phrased digest (if
it ever diverges from the catalog, the catalog wins).

- [ ] No `console.log` / debug in production
- [ ] No commented-out or dead code, empty/dummy files, `dist`/dev builds
- [ ] Code minified; vendor libraries separated
- [ ] No global variables/`var`; namespace + unique prefix
- [ ] Data read via `getShoptetDataLayer()` / `shoptet.config.breakpoints`
- [ ] No `data-testid` selectors; bind to CSS classes
- [ ] HTML inserted safely (no XSS); input validation
- [ ] The addon affects nothing outside its own container
- [ ] Comments and identifiers in English; translations in a separate file
- [ ] Accessibility: semantic tags, `sr-only`, `aria-label`, pause for autoplay
- [ ] `===`, `const`/`let`, template literals, `fetch`+`try/catch`
- [ ] Init: `DOMContentLoaded` (first load) + `ShoptetDOMContentLoaded` (AJAX, idempotently); no `setTimeout` hacks
