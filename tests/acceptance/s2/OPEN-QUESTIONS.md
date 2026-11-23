# S2 open questions for Game Designer

The verifier skipped any test that would require inventing a rule. Line numbers are `gdd/lanebound-arena-build-spec-v1.md` unless noted.

## OQ-S2-1 — Perception delay vs Reflexes reaction delay (L936–956)

A unit “does not react to an enemy (for targeting, peel, or dodge) until the enemy has been inside `perception_radius` for `perception_delay`” (L956). Separately, Reflexes sets `reaction_delay_s` (L939) and “this replaces the old Decision reaction formula.”

Do the two delays **stack** (react at perception_delivery + reaction_delay), **max**, or is reaction_delay measured from the moment the enemy appears, with perception as a separate visibility gate?

No timing-of-first-reaction test is in the suite until this is answered. Auto-peel’s 400-game lab only requires that perception has had time to elapse (t ≥ 0.5 s at Decision 70).

Perception coefficients themselves are still marked **DESIGN PROPOSAL** (L949). Plan §1 says implement proposals as written; please confirm 7.0 + 0.04×(Decision−50) and 0.40 − 0.004×(Decision−50) are the v1 numbers.

## OQ-S2-2 — Hysteresis 1.0 s vs Decision formula (L1084 vs L947 / L1084)

§9.1: “do not flip `engage ↔ disengage` in the same **1.0 s** unless a death just occurred.” Immediately: “The shotcaller’s Decision raises hysteresis: `hyst_s = 0.8 + 0.01*(Decision−50)`.”

At Decision 50 that formula is **0.8 s**, not 1.0 s. Which is binding? Is 1.0 s leftover prose, or does Decision *add* to 1.0 s?

No flip-timing test is in the suite.

## OQ-S2-3 — When does `fight_call` fire on fight-start? (L138 vs G3 L1884)

Cadence is “every 0.5 s, and on fight-start / fight-end / death,” with the parenthetical “`t` is a multiple of 0.5, **or an event fired last tick**.” Combined with G3 (tick 0 is setup, no AI), it is unclear whether a fight that first exists on tick 1 emits `fight_call` on **tick 1** (same tick as start) or **tick 2** (event fired last tick).

The suite only asserts: no call on tick 0, and a 3v3 call by **t = 0.6**. Please lock same-tick vs next-tick.

## OQ-S2-4 — Log payloads the tests cannot see (L167, L1160)

- `fight_call` has `a_true`, `commit`, `focus_id?`, `reason`. §9.1 L1101 says incoming respawns subtract 0.08 from `A_true` for the commit test, but “the raw logged `A_true` stays unadjusted; the adjustment is `A_commit`.” **`a_commit` is not on the event.** The incoming-wave hook is untestable until it is logged (or `commit` is defined to already include it, in which case please say so).
- `reason` has no enum. The suite does not assert it.
- There is no `shotcaller_id`. The “highest Decision, tie slot order” rule (L947) cannot be observed directly.
- M2 L1160: “Log `peel_start` over **`dive` counts**.” There is **no `dive` event** in §4.4 L155–193. The 400-game lab reconstructs dives from the §9.5 definition and the `pos` stream. Prefer an official `dive` event (`diver_id`, `carry_id`, `tick`).

## OQ-S2-5 — `est_ttk` and `dps_est` (L1120–1126, L1143, M2-21)

`dps_est` “may be the precomputed dummy 5 s damage / 5 … A cheaper fallback is `(ATK * AS * (1+crit*0.75) + POW * 0.4)`.” `est_ttk` is “from the unit’s share of focus DPS vs the target’s eHP.”

Two official formulas plus an underspecified “share” mean `A_true` exact values and the `est_ttk > 2.0` chase-stop cannot be asserted without inventing a recipe. The suite uses only **symmetric kits** (even 2v2, no call) or a **large HP swing** (lopsided 2v2, must call), which hold under both formulas. The third chase-stop (`est_ttk > 2`) is **not tested**. Please pick one `dps_est` and define `est_ttk`.

## OQ-S2-6 — Tactics fields on the 2cdcf26 API vs §12 (L1344–1357)

The public `Tactics` type at S1 tip `2cdcf26` is:

```
{ preset: "hold_the_pit"|"hunt"|"starve"; aggression: -1|0|1; protect_the_carry: boolean; combo_style: "auto"|"aggressive"|"conservative" }
```

The build spec’s combo style is `auto` | **`hold_R`**, and §12 also has a **Focus** slot (`auto` or an enemy slot, ×1.25) and an optional **secondary** tactic. The suite does not test `hold_R`, Focus, or secondary, because those fields are not on the frozen S1 API and we will not invent them. Should S2 extend the type to match §12 (recommended), and if so are `aggressive` / `conservative` retired?

## OQ-S2-7 — Are per-tick `intent` events in the digest? (L165–166, L195)

`intent` is “lab-verbose; required for AI tests.” The current hasher omits only `move` and `pos`. If the brain emits an `intent` every tick, the default-match digest will change at S2 (which is fine) and will also grow substantially. Should `intent` be omitted from the digest the way `move` is, and enabled with a lab flag, or is it a first-class digest event?

## OQ-S2-8 — Cross-references that point at the wrong subsection

Not blocking a test, but they should be fixed in v1.2:

- §9.5 L1155 “Teamwork skip in **§8.3**” — the skip is **§8.4 L1046**. §8.3 is mastery.
- §9.2 L1113 `regroup_s` “§8.3” — the formula is **§8.4 L982**.

## Confirmations that are *not* questions (ruled, and used)

- G9 (L1890) is the fight-centroid / 2v2 escalate rule, even where §5.6 L281 says “within 6 tiles of each other (max pairwise to centroid).” The suite uses **max distance of the four to the centroid ≤ 6**.
- Tick 0 is setup only (G3 L1884).
- Banished units contribute 0 and are not in the radius (L1077, L444).
