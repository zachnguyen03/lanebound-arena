# S2 open questions

All eight v1 questions (OQ-S2-1 through OQ-S2-8), the §5.6 vs G9 wording, and "hexed with no allies" were ruled in build-spec Appendix R #3 (L1909–1920, 23 Nov 2026). Those entries have been removed. The suite was updated to the rulings; see CHANGELOG.md.

R #3 is closed. Appendix R #4 (L1924–1927) ruled the reach form, the fight-call follow inequality (no 1.3 base threshold), and the removal of `nearOwnPad`. Those tests are in `10-gd-rulings-r4.test.ts` and `01-fight-call.test.ts`.

Silences that were never in the v1 list, and were not fully pinned this round, stay untested rather than invented:

## Still silent (no test written)

### Remaining §9.3 factors not pinned by a comparison test

Value, killability (including the Lock ×1.25), sticky 1.25 / 1.4× switch, tactic ×1.2, and ward 0.2 on a clip-to-zero projectile are in the spec (L1127–1133) but the suite only asserts the hard legality ward, the Focus slot, the ruled reach form (monotone, never 0), and the follow-call inequality. The product is not re-implemented to pin every factor.

### Secondary tactic — when the 1 s planner would "otherwise idle"

§12 L1358: the optional secondary is used when the planner's 1 s tick would otherwise idle. The suite accepts `secondary` on the S2 tactics type and sets it in the `hold_R` / Focus case, but does not invent an idle-planner fixture or assert a preset swap.

## Spec typo follow-ups (ruled, body text may still be stale)

- L947 still shows the unclamped `hyst_s` formula; L1097 and R #3 S2-2 are canonical (clamped).
- L956 still says a unit waits only `perception_delay`; R #3 S2-1 is canonical (`max` for a new enemy, `reaction_delay` only for a known one).
- The old "same 1.0 s" hysteresis wording is retired.

- L1044 still says "At Teamwork 50+ this is always-follow (multiplier 1.00)". The multiplier is 1.00 at 50+, so equal-rest always follows, but a greener local can still beat `call_score`. R #4 S2-R4-2 is canonical (no always-follow / no 1.3 base threshold).

These are for the spec editor, not for Game Designer.
