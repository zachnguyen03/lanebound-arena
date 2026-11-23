# S2 acceptance suite v1 — fight-layer AI, auto-peel, six attribute hooks

Verifier-owned. Official package: `s2-acceptance-v1.tar.gz`. Unpack at the repo root so files land under `tests/acceptance/s2/`.

Built against the S1 tip `2cdcf26` public API (`simulate`, `defaultEvenConfig`, `MatchConfig` lab hooks, the §4.4 event log). The suite **must compile** on that tip. Tests that need the Unit Brain, Fight Call, auto-peel or attribute wiring are **expected to fail** until S2 exists. Do not tune a test to an implementation, and do not loosen an assert to go green.

## What this suite covers (M2 / plan §8.4 / sandbox §11 S2)

| File | Area | Notes |
|---|---|---|
| `01-fight-call.test.ts` | Fight declaration, 2v2 escalate, 3+ always-call, 1v1 / 2v1 no call, G3 tick 0, banished units drop out of the fight | Geometry is Appendix R G9 (L1890), which tightens §5.6 L281 |
| `02-chase-stops.test.ts` | Chase starts, then stops at sanctuary and at the 10-tile leash | `est_ttk > 2` is an open question, not tested |
| `03-auto-peel.test.ts` | Constructed dive → `peel_start`; no dive → no peel; tanks/enchanters peel at low Teamwork; locked peeler does not; 400-seed preview ≥ 70% with a recorded denominator | 2,000-game even lab is deferred to M6 |
| `04-digest-ai.test.ts` | Two-process / two-call digest identity with `defaultEvenConfig`; seed+1 differs | Not pinned to the S1 no-AI gold |
| `05-attribute-hooks.test.ts` | Mastery scales `eff_Aim`; Execution setup-vs-finisher; Positioning hold distance; Teamwork ≥ 50 follows the L1 focus | Aim vs Reflexes itself stays an S1 test |
| `06-unit-brain.test.ts` | G3 no AI on tick 0; Lock skips the brain; WalkFromPad within 1.5 s of respawn | |
| `07-targeting-ward.test.ts` | `fight_call.focus_id` is never a sanctuary or banished enemy when a legal body exists | Exact priority math is an open question |
| `08-deferred-s3.test.ts` | `describe.skip` — Hold/Hunt/Starve zone-time and orbs (200 even games); planner zone/buff jobs; 2,000-game peel lab | Un-skip when S3 / M6 is live. Does not fake zone or orbs. |

Counts are listed in the package CHANGES.md (and will be printed by `npx vitest run tests/acceptance/s2`).

## Public surface this suite uses

- `simulate`, `defaultEvenConfig` from `sim/index.ts`
- `MatchConfig`: `unit_overrides` (pose, champ, hp, attrs, range, autos), `scripted_motor`, `scripted_cc`, `scripted_casts`, `scripted_damage`, `scripted_skillshots`, `debug_pos`, `constants.MATCH_T`, `blue`/`red`.tactics, `players[].attrs` / `mastery`, `picks`
- Events: `fight_call`, `peel_start`, `intent`, `cast_start`, `skill_fizzle`, `hit`, `status_apply`, `death`, `respawn`, `pos` (lab-verbose, not in the digest), and later `zone_tick` / `orb_pickup` in the skipped file

Coordinates are **real map tiles**. The S1 `ZONE_SHIFT` is not applied — fight radius, sanctuary and peel geometry are about the authored map. The lab pit is `(12, 4)`, off the zone and the four pillars. Unnamed `defaultEvenConfig` slots stay at spawn with autos off so a mid-map cluster is not accidentally a 5v5.

## Companion docs

- `OPEN-QUESTIONS.md` — silences and contradictions for Game Designer; no test was written for those.
- `DEFERRED.md` — S3 / M6 items, not silently dropped.
