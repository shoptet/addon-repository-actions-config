# shoptet-addon-review — installation and first test

A collection (plugin) for FE code review of Shoptet visual addons in Claude Code.
The `st-addon-review` skill reviews addon PRs over a **cloned repo** against the rules catalog.

## Structure

```
shoptet-addon-review/
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── st-addon-review/
        ├── SKILL.md
        └── references/
            ├── rules-catalog.md      # rubric (read by the agent)
            ├── shoptet-reference.md  # companion for B1/B4/B6 (read by the agent)
            └── github-api-notes.md   # GitHub write mechanics (read by the agent)
```

## Adding to the `shoptet/skills` marketplace

1. Copy the whole `shoptet-addon-review/` folder into `plugins/` in the `shoptet/skills` repo.
2. Register the plugin in the root `.claude-plugin/marketplace.json` — add an entry in the
   **same format the existing items use** (e.g. `shoptet-api`). Don't copy a schema from here
   blindly; follow what's already established in that file.
3. `plugin.json` is kept minimal — if the other plugins carry extra fields (`author`,
   `license`, …), add them accordingly.
4. Local development: `claude plugin marketplace add /absolute/path/to/shoptet-skills`,
   then `/plugin install shoptet-addon-review@shoptet-skills`, and `/reload-plugins`.
5. Verify the skill auto-loads — run a prompt that matches the `description` (see below).
   When it doesn't load, it's almost always a wording problem in the `description`, not the code.

## First test (kickoff prompt)

Switch into a **specific addon repo** (have it cloned, ideally at the commit/PR you want
to review) and tell Claude Code something like:

> You are an addon reviewer; follow the `st-addon-review` skill. Review PR #<number>
> (or branch `<branch>` / merge commit `<sha>`). Pull the diff via `gh`/`git`, read the
> **affected files and their surroundings** in the repo, run the code against the catalog
> and return the findings per the output contract + the Czech summary message. **Writing to
> GitHub is controlled by the `github_review` switch in `SKILL.md` (default `pending` =
> a draft under my `gh` login, nothing gets submitted — I'll review and send it manually).
> Whatever it is set to, always print the output here as well.**

### What to watch on the first run

- **False positives** — how much the agent added on top (vs. a second review / the reality
  of the code). Our most important number, and even more so with no human behind it.
- **B1/B4/B6** — whether they actually work with `shoptet-reference.md`, or still flounder.
- **Gate** — whether it correctly distinguishes blocking vs. recommended on conditional rules.
- **ESLint** — the partner repo most likely has **no** shoptet lint config yet → expect
  degraded mode (`linter_available: false`). That's fine, just make sure the agent admits it.
- Pick a PR that is **not clean** — one with at least one real blocker and some borderline
  case. A clean PR won't surface false positives.
