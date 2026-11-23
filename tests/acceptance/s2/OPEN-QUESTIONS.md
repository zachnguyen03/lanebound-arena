# S2 open questions

All eight v1 questions (OQ-S2-1 through OQ-S2-8), the §5.6 vs G9 wording, and "hexed with no allies" were ruled in build-spec Appendix R #3 (L1909–1920, 23 Nov 2026). Those entries have been removed. The suite was updated to the rulings; see CHANGELOG.md.

Nothing in R #3 is still open. Two silences that were never in the v1 list, and were not ruled this round, stay untested rather than invented:

## Still silent (no test written)

### Focus / targeting ward — exact score weights

§9.1 L1085–1095 lists the contributions (current-target bonus, missing HP, distance, CC, Focus ×1.25, …) but not a complete numeric recipe. `07-targeting-ward.test.ts` only asserts the hard legality ward (no sanctuary / banished focus when a legal body exists). `09-gd-rulings-r3.test.ts` asserts that flagging a Focus slot makes that slot the `focus_id` in an otherwise even 3v3 (the ×1.25 is enough to break a tie). The exact weighted sum is not pinned.

### Secondary tactic — when the 1 s planner would "otherwise idle"

§12 L1358: the optional secondary is used when the planner's 1 s tick would otherwise idle. The suite accepts `secondary` on the S2 tactics type and sets it in the `hold_R` / Focus case, but does not invent an idle-planner fixture or assert a preset swap.

## Spec typo follow-ups (ruled, body text may still be stale)

- L947 still shows the unclamped `hyst_s` formula; L1097 and R #3 S2-2 are canonical (clamped).
- L956 still says a unit waits only `perception_delay`; R #3 S2-1 is canonical (`max` for a new enemy, `reaction_delay` only for a known one).
- The old "same 1.0 s" hysteresis wording is retired.

These are for the spec editor, not for Game Designer.
