# s2-acceptance changelog

## v3 — Appendix R #4 (23 Nov 2026)

Rulings are binding. Tests assert observable events and positions; the reach formula is not re-implemented in the suite.

### Tests added

- `10-gd-rulings-r4.test.ts`: reach is monotone (closer identical body is `fight_call.focus_id`); a far legal body is still acquired (reach never 0); Teamwork 90 can freelance onto a much greener local (no 1.3 base threshold / no always-follow at 50+); a disengage call is always followed; Teamwork does not change Positioning hold distance.
- `01-fight-call.test.ts`: a G9-qualifying lopsided 2v2 just outside blue sanctuary (inside the removed 4-tile `nearOwnPad` radius) still escalates (R #4 S2-R4-3).

### v2 tests changed (one-line reasons)

- `05-attribute-hooks.test.ts`: the Teamwork 90 follow-call fixture no longer makes the "greener local" the likely `focus_id`; equal kits and HP so call 1.30 vs local 1.00 is the contrast (R #4 S2-R4-2). The greener-local freelance and disengage cases live in `10-gd-rulings-r4.test.ts`.

### Docs

- R #4 items removed from the leftover-silence list in `OPEN-QUESTIONS.md` (reach formula, Teamwork follow inequality, `nearOwnPad`). The stale body line at L1044 ("At Teamwork 50+ this is always-follow") is flagged as a typo follow-up: R #4 is canonical.

## v2 — Appendix R #3 (23 Nov 2026)

Rulings are binding. Tests were added or tightened to the ruling text; v1 tests that conflicted were changed, not loosened.

### Tests added

- `09-gd-rulings-r3.test.ts`: `a_commit` / `shotcaller_id` (including the Decision tie-break), next-tick `fight_call` on a death, hysteresis at Decision 50 and at the two clamp ends, death-exception flip, `max(perception, reaction)` vs reaction-only for a known enemy, `hold_R` + Focus slot + `secondary` field, hexed-with-no-allies walks to pad centre.
- `02-chase-stops.test.ts`: third chase stop, `est_ttk > 2.0`, using the dummy 5 s `dps_est` (no exact `A_true`).
- `03-auto-peel.test.ts`: `dive` event shape and the once-per-diver-target-pair-per-fight rule.
- `04-digest-ai.test.ts`: `intent` only on change, and `intent` present in the digest stream (`move` / `pos` still omitted).

### v1 tests changed (one-line reasons)

- `01-fight-call.test.ts`: first 3v3 `fight_call` must be tick 2 / t=0.2 (R #3 S2-3: next tick, not "by t=0.6").
- `01-fight-call.test.ts`: `payloadOk` now requires `a_commit` and `shotcaller_id` (R #3 S2-4).
- `01-fight-call.test.ts`: the banish case now asserts a tick-2 call, not a loose `t < 0.6`.
- `01-fight-call.test.ts`: even-2v2 comment drops the "either dps_est formula" wording (R #3 S2-5 deleted the fallback).
- `03-auto-peel.test.ts`: 400-seed denominator is `dive` events with `peeler_perceived === true`, not a reconstructed `pos` count (R #3 S2-4).
- `02-chase-stops.test.ts`: header no longer treats `est_ttk > 2` as an open question.
- `_harness.ts`: `pathOf` accepts both `pos` and `move` frames from `debug_pos` (`2cdcf26` emits `move`; the spec also names `pos`). v1 only looked for `pos`, so any path-based assert would have been vacuous on this tip.
- `_harness.ts`: tactics type is the R #3 S2-6 shape (`auto` | `hold_R`, Focus, optional `secondary`). This is a frozen-S1 API deviation; `2cdcf26` is expected to type-error on the assignment until S2 lands.

### Docs

- Removed OQ-S2-1…8, the §5.6 vs G9 question, and the hex-no-allies question from `OPEN-QUESTIONS.md` (all ruled).
- `DEFERRED.md`: incoming-wave −0.08 is still deferred, but no longer because `a_commit` is unlogged (`a_commit` is now a required field; the "arrive in the fight" path is what is still untested here).
