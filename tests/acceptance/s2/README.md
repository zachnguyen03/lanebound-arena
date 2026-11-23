# S2 acceptance suite v6 — fight-layer AI, auto-peel, six attribute hooks, S2-R4-4

Verifier-owned. Official package: `s2-acceptance-v6.tar.gz`. Unpack at the repo root so files land under `tests/acceptance/s2/`.

Built against the S1 tip `2cdcf26` public API (`simulate`, `defaultEvenConfig`, `MatchConfig` lab hooks, the §4.4 event log) plus the Appendix R #3 / R #4 names (including S2-R4-4 at L1930). Tests that need the Unit Brain, Fight Call, auto-peel, attribute wiring, or the new S2 event / tactics fields are **expected to fail** until S2 exists. The new names (`a_commit`, `shotcaller_id`, `dive`, `combo_style: "hold_R"`, `focus`, `secondary`) are written against the ruling; they are a frozen-S1 API deviation and are expected to type-error on `2cdcf26` until S2 lands. Do not tune a test to an implementation, and do not loosen an assert to go green.

## What this suite covers (M2 / plan §8.4 / sandbox §11 S2 / Appendix R #3 / R #4)

| File | Area | Notes |
|---|---|---|
| `01-fight-call.test.ts` | Fight declaration, 2v2 escalate, 3+ always-call, 1v1 / 2v1 no call, G3 tick 0, banished units drop out of the fight, G9 2v2 near a pad still escalates | Geometry is Appendix R G9 (L1890 / R #3 L1919). First `fight_call` is tick 2 (R #3 S2-3). R #4 S2-R4-3: `nearOwnPad` is removed. |
| `02-chase-stops.test.ts` | Chase starts, then stops at sanctuary, at the 10-tile leash, and when `est_ttk > 2.0` | Stops reject Chase, Approach, and Kite toward the target. ttk stop is within 0.4 s of the first Chase when ttk is already > 2, and also within one planner tick (1.0 s). |
| `03-auto-peel.test.ts` | Constructed dive → `peel_start` and `dive`; no dive → no peel; tanks/enchanters peel at low Teamwork; locked peeler does not; 400-seed preview ≥ 70%; `peeler_perceived: false` when the dive starts before perception; moving-unit dive | Denominator is `dive` events with `peeler_perceived === true` (R #3 S2-4). Total dive count includes `false`. |
| `04-digest-ai.test.ts` | Two-process / two-call digest identity with `defaultEvenConfig`; seed+1 differs; `intent` only on change and in the digest, including a real AI fight | `move` and `pos` stay out (R #3 S2-7). Not pinned to the S1 no-AI gold. |
| `05-attribute-hooks.test.ts` | Mastery scales `eff_Aim`; Execution setup-vs-finisher; Positioning hold distance; Teamwork follows the L1 focus when the rest of priority is equal (call 1.30 vs local 1.00) | Aim vs Reflexes itself stays an S1 test. Teamwork skip is cited as §8.4 (R #3 S2-8). Greener-local / disengage cases are in `10`. |
| `06-unit-brain.test.ts` | G3 no AI on tick 0; Lock skips the brain; WalkFromPad intent and leave-sanctuary within 1.5 s of respawn | |
| `07-targeting-ward.test.ts` | `fight_call.focus_id` is never a sanctuary or banished enemy when a legal body exists, even if that body would otherwise win the score | Hard legality ward only. Remaining §9.3 factors are in OPEN-QUESTIONS.md. |
| `08-deferred-s3.test.ts` | `describe.skip` — Hold/Hunt/Starve zone-time and orbs (200 even games); planner zone/buff jobs; 2,000-game peel lab | Un-skip when S3 / M6 is live. Does not fake zone or orbs. |
| `09-gd-rulings-r3.test.ts` | R #3: next-tick death call, `a_commit` / `shotcaller_id`, hysteresis at Decision 50 (including two-sided 0.75 / 0.85) and at the 0.4 / 1.3 clamps (Decision 1 and 150), perception `max()` vs reaction-only, `hold_R` + Focus, hexed-to-pad-centre | New S2 API names as above. |
| `10-gd-rulings-r4.test.ts` | R #4: reach monotone and never 0; S2-R4-4 focus_id is the post-bump score winner (slot wins when pre-bump ≥ best-other/1.25; other wins when its score > 1.25× slot); no 1.3 base follow threshold (greener local at Teamwork 90); disengage always followed; Teamwork does not change hold_dist | |
| `11-probe-gaps.test.ts` | Probe gaps: Focus is ×1.25 not a hard override; killability Lock ×1.25; hold_R vs auto contrast on the same fixture | |
| `12-survivor-gaps.test.ts` | Held-out survivors from v4: tick-2 first call, sanctuary chase-stop, ward, mastery Aim, WalkFromPad, Lock, L<5 R in dps_est, 0.4 s ttk stop / no Approach after stop, hex to pad centre | Tightens v4 cases that did not kill the needles. |
| `13-anti-tuning.test.ts` | Anti-tuning: hold_R chip is not HP-snapped; scripted_casts do not suppress AI; Focus is scored from the actual shotcaller (including a pad Top); dive at first (2) with default Decision and peeler_perceived false if unperceived | Written to fail the 979306d fixture-keyed hacks. |

Counts are listed in the package CHANGES.md (and will be printed by `npx vitest run tests/acceptance/s2`). v1→v6 edits are in CHANGELOG.md. Four labs are deferred to post-game polish (Anh 19:30); see DEFERRED.md. The disengage-follow check in `10` stays live.

## Public surface this suite uses

- `simulate`, `defaultEvenConfig`, `digestEvents` from `sim/index.ts`
- `MatchConfig`: `unit_overrides` (pose, champ, hp, attrs, range, autos), `scripted_motor`, `scripted_cc`, `scripted_casts`, `scripted_damage`, `scripted_skillshots`, `debug_pos`, `constants.MATCH_T`, `blue`/`red`.tactics, `players[].attrs` / `mastery`, `picks`
- S2 tactics shape (R #3 S2-6 / §12): `{ preset, secondary?, aggression, protect_the_carry, combo_style: "auto" \| "hold_R", focus?: "auto" \| slot }`
- Events: `fight_call` (including `a_commit` and `shotcaller_id`), `dive` (`diver_id`, `target_id`, `fight_id`, `peeler_id?`, `peeler_perceived`), `peel_start`, `intent` (on change only; first-class digest event), `cast_start`, `skill_fizzle`, `hit`, `status_apply`, `death`, `respawn`, `pos` (lab-verbose, not in the digest), and later `zone_tick` / `orb_pickup` in the skipped file

Coordinates are **real map tiles**. The S1 `ZONE_SHIFT` is not applied — fight radius, sanctuary and peel geometry are about the authored map. The lab pit is `(12, 4)`, off the zone and the four pillars. Unnamed `defaultEvenConfig` slots stay at spawn with autos off so a mid-map cluster is not accidentally a 5v5.

## Companion docs

- `CHANGELOG.md` — v1→v4 changes, including each earlier test that was edited and why.
- `OPEN-QUESTIONS.md` — leftovers still silent after R #4, S2-R4-4, and the v5/v6 probe / anti-tuning tests; the eight v1 questions and the R #4 items are resolved.
- `DEFERRED.md` — S3 / M6 items, not silently dropped.
