# GitHub API — notes for writing the review

> Reference mechanics for **step 6** (writing to GitHub) and for **re-runs**. Read this only
> when actually writing the review; it's not needed during the code pass itself (steps 0–5).
> The decision rules ("one review", "COMMENT-only", anchoring 0-line findings, markers) live in
> `SKILL.md` — this is only *how* to do it via the API and what verifiably does not work.

## Creating the review

One review with all inline comments at once:

```sh
gh api POST /repos/{owner}/{repo}/pulls/{n}/reviews \
  -f body='<summary>' \
  -F 'comments[][path]=src/...' -F 'comments[][line]=42' -F 'comments[][body]=<text>'
```

- **`pending` (draft):** create the review **without the `event` field** → it stays in the
  `PENDING` state. The verdict (Comment / Approve / Request changes) is chosen by the human at
  submit; the skill only recommends it (`recommended_verdict` in the output).
- **`submit`** (autonomous): add **`event=COMMENT`** → publishes immediately. **Never
  `REQUEST_CHANGES` or `APPROVE`** (see invariant 1 in `SKILL.md`).
- A `suggestion` in a comment body = a GitHub ` ```suggestion ` block (one-click fix).

## Pending draft — visibility (verified)

- **The `body` of a pending draft is invisible on GitHub until submit** — it shows neither in
  the timeline nor in the submit box; only the inline comments in "Files changed" are visible.
  → read the summary for checking **from the run output (chat)**, not from GitHub.
- **A pending draft is visible only to the account that created it** → it must be created under
  your own `gh` login (so you can review and submit it), not under the service identity.
- **One pending review per user per PR** (GitHub limit). If one is already hanging, don't create
  a new one — see the guard in `SKILL.md` › *Re-run*.

## A finding on a file with no line in the diff (0-line / deleted / outside the diff)

- **A "whole file" comment cannot go into a pending draft.** `DraftPullRequestReviewComment`
  requires a diff `position` and **has no `subject_type: "file"`** — the API returns **422**
  (verified).
- A file-level comment is only possible via a separate endpoint, which however **publishes
  immediately** (notifies the partner) → against pending mode.
- Solution: anchor a line comment on the **nearest related diffed file** (e.g. an empty
  `yarn.lock` → `package.json`) and reference the real file in the text. Store the real file in
  the marker (`file`), not the one you anchor to.

## Re-run — git comparison via the API

- Comments carry the SHA of the commit they belong to: **`commit_id` / `original_commit_id`**.
  That's where you take the previous run's `old_sha` from.
- **An outdated comment** (the code under it changed) automatically gets **`position: null`**
  from GitHub — a cheap signal that the diff touched the finding's location.
- After a **force-push** the `old_sha` may not exist locally → run `git fetch origin <old_sha>`.
- Old↔new line mapping: `git diff <old_sha>..<new_sha>` and shift via the hunks.
