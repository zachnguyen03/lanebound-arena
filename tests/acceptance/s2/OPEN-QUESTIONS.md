# S2 open questions

Four labs are deferred to post-game polish (Anh 19:30) and listed in `DEFERRED.md`. They are skipped, not open questions.

All eight v1 questions (OQ-S2-1 through OQ-S2-8), the §5.6 vs G9 wording, and "hexed with no allies" were ruled in build-spec Appendix R #3 (L1909–1920, 23 Nov 2026). Those entries have been removed. The suite was updated to the rulings; see CHANGELOG.md.

R #3 is closed. Appendix R #4 (L1924–1930) ruled the reach form, the fight-call follow inequality (no 1.3 base threshold), the removal of `nearOwnPad`, and S2-R4-4 (L1930): `fight_call.focus_id` is the targeting-score winner after the ×1.25 Focus bump, null only when no legal target exists. Those tests are in `10-gd-rulings-r4.test.ts`, `11-probe-gaps.test.ts`, and `01-fight-call.test.ts`.

Silences that were never in the v1 list, and were not fully pinned this round, stay untested rather than invented:

## Still silent (no test written)

### Remaining §9.3 factors not pinned by a comparison test

Value, sticky 1.25 / 1.4× switch, tactic ×1.2, and ward 0.2 on a clip-to-zero projectile are in the spec (L1127–1133) but are not each pinned by a comparison test. Killability Lock ×1.25 is tested in `11-probe-gaps.test.ts` (§9.3 L1128). The product is not re-implemented to pin every remaining factor.

### Secondary tactic — when the 1 s planner would "otherwise idle"

§12 L1358: the optional secondary is used when the planner's 1 s tick would otherwise idle. The suite accepts `secondary` on the S2 tactics type and sets it in the `hold_R` / Focus case, but does not invent an idle-planner fixture or assert a preset swap.

## Spec typo follow-ups (ruled, body text may still be stale)

- L947 still shows the unclamped `hyst_s` formula; L1097 and R #3 S2-2 are canonical (clamped).
- L956 still says a unit waits only `perception_delay`; R #3 S2-1 is canonical (`max` for a new enemy, `reaction_delay` only for a known one).
- The old "same 1.0 s" hysteresis wording is retired.

- L1044–1045 still say "At Teamwork 50+ this is always-follow (multiplier 1.00). Below, a locally greener target can win." For the spec editor, replace that with: "At Teamwork 50+ the multiplier is 1.00, so equal-rest always follows (call 1.30 vs local 1.00). A greener local can still beat `call_score`. There is no always-follow gate and no separate 1.3 base threshold (R #4 S2-R4-2)."

These are for the spec editor, not for Game Designer.
