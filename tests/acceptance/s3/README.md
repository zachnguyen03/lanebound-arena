# S3 acceptance suite v3 — Appendix R #5, fixture triage

Verifier-owned. Official package: `s3-acceptance-v3.tar.gz`. Unpack at the repo root so files land under `tests/acceptance/s3/`.

Built against the S1 PM-passed tip `2cdcf26` public API (`simulate`, `defaultEvenConfig`, `MatchConfig` lab hooks, the §4.4 event log, `digestEvents`) plus the minimal S3 additions in `_contract.md`. Tests that need zone / claims / orbs / buffs / catch-up / the real §5.8 win conditions / `player_stats` fields are **expected to fail** until S3 exists. Do not tune a test to an implementation, and do not loosen an assert to go green.

v3 keeps the v2 assertions and only fixes fixtures that could not show the ruled effect (see `CHANGELOG.md` and `lab/s3-acceptance/TRIAGE-358e83c.md`). v2 adds a test for every Appendix R #5 ruling (S3-R5-1..10, L1936–L1970; edited spec lines L146, L303, L311, L313; edit note L1972). Open questions from v1 are resolved in `OPEN-QUESTIONS.md` (also at `lab/s3-acceptance/OPEN-QUESTIONS.md`, the path L1934 cites). `XP_TO_LEVEL` is confirmed by Anh (the written table, L5=820).

## What this suite covers (M3 / plan §8.4 S3 / sandbox §11 S3 / Appendix R #5)

| File | Area | Notes |
|---|---|---|
| `01-match-end.test.ts` | First-to-10 (strictly ahead), clock, sudden death, zone-time, takedowns, Bo1 coin flip, G4 point-on-`MATCH_T` | `forced_clock_end: false`. Short clocks are lab fixtures. Sandbox is Bo1 — no series-map-draw reason (see `DEFERRED.md`). |
| `02-scoring.test.ts` | Takedown +1, assist is not a team point, zone_tick +1, claim_award +1, score = kills+ticks+claims | Event-derived `score_parts`. |
| `03-zone.test.ts` | Occupy rules, 3 s capture, contest pause, empty decay, G8 flip, tick pause/no-reset, 12 s = +1, aura | Progress via `barTicks`. Other-team drain is asserted (S3-R5-1). |
| `04-claims.test.ts` | Open / refresh / replace, G11, any-class deny, empty pays, banished does not deny, denier_id, `deniers`, `claim_denies` | Lab hook `scripted_claim_open` plus one production net-+1 fight path. No exact-key assert on `claim_deny`. |
| `05-orbs-buffs.test.ts` | First wave at t=8.0 / 1:30, tile-centre pads, 120 / 138 XP, 18 s respawn, G4 / G7, buff +12% / +10% / 45 s, no stack | Catch-up is folded: `orb_pickup.xp` and one `xp_gain` source `orb` are 138; no `source:"catchup"`. |
| `06-xp-respawn.test.ts` | `XP_TO_LEVEL` as written (confirmed), no XP while dead, respawn tick is paid, folded catch-up 1.3225, respawn formula | L5=820. Do not substitute 966. |
| `07-determinism.test.ts` | Two-process digest equality for seeds 20261122 and 20261123, seed+1 differs, full match ends with a digest, orb wave present | `forced_clock_end: false`. Not pinned to S1 gold. |
| `08-s1-regression.test.ts` | AI-off: S1 event subsequence of `defaultEvenConfig` still matches the official `2cdcf26` gold | S3 event types are stripped before hashing. Keep `forced_clock_end: true` on the default config. |
| `09-sanctuary.test.ts` | Constructed enemy-pad shove; 20-seed AI-off preview, 0 `sanctuary_violation` | 400-game AI preview and 2,000-game lab are in `DEFERRED.md`. |
| `10-gd-rulings-r5.test.ts` | Every S3-R5-1..10 ruling, cited by line | Independent bars and drain; phase-14 decision and log order; catch-up snapshot; occupy / G7 / Bo1 extra window; aura; dwell + `deniers`; `zone_seconds`; strictly-ahead win. |

`_harness.ts` and `_digest-child.ts` are shared. `_contract.md` is the S3 API the build agent must implement, including the additive v2 fields (`claim_deny.deniers`, required `zone_seconds`, `rng_counters.tiebreak`, lab `unit_overrides.ms`). Resolved leftovers: `OPEN-QUESTIONS.md`. Still later: `DEFERRED.md` (including a series-map-draw `match_end` reason — sandbox S3 is Bo1 only).

Sources: build spec §4.3–4.4, §5.3–5.8, §14.7, §15, M3 tests 25–31 (L1741–1753), Appendix R G2–G4 / G7–G8 / G11 / #5; sandbox §2.1, §8.2, §11 S3; plan §8.4 S3; career GDD v1.1.2 C-R-5.

## XP_TO_LEVEL — confirmed by Anh

`06-xp-respawn.test.ts` pins the cumulative table in build spec L242–253:

`{1:0, 2:140, 3:320, 4:540, 5:820, 6:1160, 7:1560, 8:2040, 9:2600, 10:3240}`

with `TIME_XP_PER_S = 11.5`. Time-only predictions: L2 at tick 122, L5 at tick 714, L7 at tick 1357. Anh confirmed the written table (L5=820). Do not substitute 966 or any other curve.

## Test count by area (v3, same 152 cases as v2)

Counted as vitest `it(...)` / `it.each` cases. `it.each` over 6 classes counts as 6; over 7 CC kinds counts as 7; over 9 pickup statuses counts as 9; over 2 seeds counts as 2.

| Area | File | Runnable | Skipped |
|---|---|---:|---:|
| Match-end reasons | `01-match-end.test.ts` | 13 | 0 |
| Scoring formula | `02-scoring.test.ts` | 6 | 0 |
| Zone capture / ticks / aura | `03-zone.test.ts` | 17 | 0 |
| Claims, any-unit deny, `claim_denies`, `deniers` | `04-claims.test.ts` | 20 | 0 |
| Orbs and flank buffs | `05-orbs-buffs.test.ts` | 21 | 0 |
| XP table, catch-up, respawn, no XP while dead | `06-xp-respawn.test.ts` | 11 | 0 |
| Two-process determinism + full match | `07-determinism.test.ts` | 9 | 0 |
| AI-off S1 digest regression | `08-s1-regression.test.ts` | 3 | 0 |
| Sanctuary preview | `09-sanctuary.test.ts` | 2 | 0 |
| Appendix R #5 rulings | `10-gd-rulings-r5.test.ts` | 50 | 0 |
| **Total** | | **152** | **0** |

### Expected colour on the S1 tip `2cdcf26`

Verified with `npx vitest run tests/acceptance/s3` on the extracted `2cdcf26` tip at `/tmp/t2c`: **25 passed, 127 failed** (152 total). On the S3 tip `358e83c`, after these fixture fixes: **152 passed, 0 failed**.

**Green** — already true of S1, or they only read published constants / gold:

- Constant pins: SCORE_TO_WIN / clocks (`01`), zone defaults (`03`), claim knobs (`04`), orb / buff defaults (`05`), `XP_TO_LEVEL` table (`06`).
- Time-only L2 / L5 / L7 ticks, tick-0 / death-tick / in-between / respawn-tick time XP, catch-up does not bump kill/assist XP, respawn formula (`06`). S0/S1 already implement these.
- `07` two-call and two-process identity for 20261122 and 20261123, seed+1 differs, and `digestEvents === digest` (S1 is already deterministic; these runs do not yet require S3 events).
- All three tests in `08-s1-regression.test.ts`.
- Both tests in `09-sanctuary.test.ts`.

**Red** — need S3 systems (this is the acceptance gate):

- Every real `match_end.reason` in `01` (first-to-10, clock-with-a-lead, sudden death, zone_time, takedowns, coin_flip, G4, stop-after-end). S1 with `forced_clock_end: false` never emits `match_end` and never awards score.
- All six tests in `02` (no `takedown_score` / `zone_tick` / `claim_award`, scores stay 0).
- All 16 behavioural tests in `03` (`MatchState.zone` is missing).
- All 19 behavioural tests in `04` (no claim events, `player_stats` / `deniers` missing). The constant pin is the one green test in that file.
- All 20 behavioural tests in `05` (no `orb_spawn` / `buff_spawn`). Negative G7 cases also require the wave to have spawned, so they are not vacuously green.
- Catch-up on time XP in `06` (S1 `grantXp` has no catch-up; the folded 1.3225 pin fails). The kill/assist "no catch-up" pin is already green, as noted above.
- `07` "reaches `match_end`", "emits eight `orb_spawn` at t=8.0", and the extra seed 4242 end.
- All 50 tests in `10-gd-rulings-r5.test.ts` (bars, phase-14, catch-up fold, occupy, G7, extra window, aura, dwell, `zone_seconds`, strictly-ahead win).

A held-out mutation list lives box-only at `lab/s3-acceptance/held-out/` and is **not** in this tarball.
