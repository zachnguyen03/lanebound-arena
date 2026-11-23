# s2-acceptance changelog

## v6 — S2 harness defaults AI on; four labs deferred (23 Nov 2026, Anh 19:30)

### Tests / harness changed

- `_harness.ts` `configOf` now sets `ai_enabled = sc.ai_enabled ?? true`. Justification: M2-20..24 (L1734–1737) and R #3 S2-4 (L1916) observe `fight_call`, `dive`, `peel_start`, and `intent` — those events exist only when fight AI is on. The official S2 suite is that fight-layer lab, so the harness turns AI on by default. A test may still set `ai_enabled: false` for an explicit off case. (S1 gold digests use `defaultEvenConfig` / `npm run digest` directly, not `configOf`.)
- The disengage-follow behaviour check in `10-gd-rulings-r4.test.ts` (R #4 S2-R4-2 L1926: "Disengage calls are always followed") is **kept live** and is not deferred.

### Tests skipped (bodies unchanged; not rewritten)

Deferred to post-game polish (Anh 19:30). Each skip uses that exact reason string. What they check is listed in `DEFERRED.md`.

- `03-auto-peel.test.ts` — M2 400-seed peel preview lab (L1160, L1735, R #3 S2-4).
- `09-gd-rulings-r3.test.ts` — unconditional Focus-slot `focus_id` assert (to be aligned with S2-R4-4 L1930).
- `11-probe-gaps.test.ts` — hold_R vs auto contrast fixture (L1359 / L1007).
- `13-anti-tuning.test.ts` — Focus scored from the shotcaller at the pad vs in the pit (L1101).

### Docs

- `DEFERRED.md`: the four skipped labs, with what each one checks.
- Counts in `CHANGES.md` / `README.md`.

## v5 — S2-R4-4, survivor gaps, anti-tuning (23 Nov 2026)

GD ruled S2-R4-4 (Appendix R #4 L1930, option a): `fight_call.focus_id` is the targeting-score winner after the ×1.25 Focus bump, and is null only when no legal target exists. Tests assert observables; no test is tuned to a tip.

### Tests added

- `10-gd-rulings-r4.test.ts`: S2-R4-4 (L1930) — (1) when the Focus slot's pre-bump score ≥ best other / 1.25, `focus_id` is the slot; (2) when another target's score > 1.25 × the slot's score, `focus_id` is that target.
- `12-survivor-gaps.test.ts`: pointed tests for the v4 held-out survivors (tick-2 first call, sanctuary chase-stop, score-winning sanctuary ward, mastery Aim, WalkFromPad intent + leave, Lock skip, `dps_est` omits R below level 5, 0.4 s ttk stop with no Approach after the stop, hex to pad centre). Hysteresis clamp-binding cases live in `09`.
- `13-anti-tuning.test.ts`: hold_R vs auto contrast that stays naturally above 40% HP, plus a chip that must remain below 40% (no simulator HP floor); AI-on fight_call/intent identity with or without a not-yet-due `scripted_cast`; Focus scored from the actual shotcaller when Top is at the pad; `dive` at the first tick condition (2) holds under default Decision 70, with `peeler_perceived: false` if perception has not elapsed.

### v4 tests changed (one-line reasons)

- `10-gd-rulings-r4.test.ts`: dropped the two unconditional `focus_id ===` coach-slot asserts (L102 / L127 in v4). The Teamwork-90 freelance and disengage behaviour checks are kept, on a case-(1) geometry so L1 focus is the slot. `aimedAt` ignores Idle intents that still carry a stale `target_id`.
- `02-chase-stops.test.ts`: added a ttk stop that must land within 0.4 s of the first Chase/Approach so a 5-tick (0.5 s) grace fails.
- `06-unit-brain.test.ts`: Lock is tested from an Idle start with the foe walking in during the stun (and the window ends before the stun expires, so the first post-Lock Engage is not a fail). WalkFromPad requires the named intent *and* leaving sanctuary.
- `07-targeting-ward.test.ts`: the sanctuary / banish bodies would win the targeting score without the ward (low-HP marksman vs a pit tank).
- `09-gd-rulings-r3.test.ts`: added Decision 1 (0.4 s floor binds) and Decision 150 (1.3 s cap binds). Hex-to-pad asserts y is closer to 7.5 than to the ADC slot at 8.5.
- `_harness.ts`: `AiScenario.ai_enabled` can be set explicitly.

### Docs

- `OPEN-QUESTIONS.md`: S2-R4-4 is closed. The leftover §9.3 factor list and the L1044 typo note are unchanged.

## v4 — probe-gap tests (23 Nov 2026)

Adds the pre-R #4 probe-gap tests on top of v3. Each cites the spec / R #3 line. Tests assert observable events and positions; no test is tuned to a tip.

### Tests added

- `09-gd-rulings-r3.test.ts`: two-sided hysteresis at Decision 50 — a flip at 0.75 s is blocked and a flip by 0.85 s is allowed, so a stale 1.0 s window fails (R #3 S2-2 L1912). The existing death-exception flip (L1097) stays.
- `11-probe-gaps.test.ts`: Focus is ×1.25, not a hard override (R #3 S2-6 / §12 L1357); killability Lock ×1.25 (§9.3 L1128); hold_R vs auto contrast on the same fixture, with the `A_true ≥ 0.55` / Focus-below-40% gate cited at §12 L1359 and §8.4 L1007.
- `03-auto-peel.test.ts`: a dive that begins before the peeler has perceived the diver emits `peeler_perceived: false` (R #3 S2-4 L1916); a dive is still emitted when carry, peeler, and diver are moving.
- `04-digest-ai.test.ts`: intent-on-change on the AI emitter in a real fight, no scripted motor (R #3 S2-7 L1917).

### v3 tests changed (one-line reasons)

- `02-chase-stops.test.ts`: sanctuary and `est_ttk > 2` stops reject Chase, Approach, and Kite toward the target, and assert a distance trend. The ttk stop must happen within one planner tick (1.0 s, §9.2 L1105), not after a 0.5 s or 2.5 s acceptance grace.
- `03-auto-peel.test.ts`: the 400-seed lab still uses `peeler_perceived === true` as the M2 denominator, and also records the total dive count including `false`.

### Docs

- `OPEN-QUESTIONS.md`: Lock ×1.25 is no longer listed as untested. The L1044 typo note for the spec editor is spelled out as a replacement sentence.

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
