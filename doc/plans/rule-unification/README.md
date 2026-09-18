# Rule unification — one rule set, two runners

> Part of [`doc/plans/`](../README.md), this repository's plans index.

This repository's `linter_review_tool/` rule set becomes the single authority for Shoptet g3 addon
linting, published as three npm packages that both this repo's gate **and** the `shoptet` CLI's
`validate` command consume.

The other half of the track lives in
[`shoptet/partner-cli`](https://github.com/shoptet/partner-cli), under
`doc/plans/rule-unification.md`. **That document is the track index — read it first.** It carries the
full scope, the decisions, the measured facts behind them, and the cross-repo ordering.

**All decision records for the track live in that repo**, under `doc/decisions/`, including decisions
that act on this repository. Two ADR sequences describing one decision is the duplication problem the
track exists to remove, one layer up.

| slice | what | status |
| --- | --- | --- |
| [`A0`](./a0.md) | land the in-flight branches, freeze the rule set | done, retroactively — see [`a0-baseline.md`](./a0-baseline.md) |
| [`A1`](./a1.md) | ESLint 8 → 9, flat config, and the `cwd`/basePath fix | implemented on `zibby` (not `main`, not published) |
| [`A2`](./a2.md) | extract and publish the three packages | implemented on `zibby` (not `main`, not published); npm publish itself still blocked |
| [`A3`](./a3.md) | the equality test and the discovery conformance corpus | not started |

Cross-repo order: **A0 → A1 → A2 → B1 → B2 → B3 → A3/B4**, where the `B` slices are in the CLI repo.

**Every slice leaves this repository green and shippable — the gate never stops gating.** That is a
hard constraint. This system's worst failure mode is *fail-green*: a gate that reports zero blockers
while looking healthy. In that environment "temporarily degraded" is indistinguishable from "broken".
