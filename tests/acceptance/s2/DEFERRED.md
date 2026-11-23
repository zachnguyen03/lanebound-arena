# S2 items deferred — not dropped

These need S3 systems (zone, orbs, buffs, claims) or an M6 sample size. They are **not** faked in this suite. `08-deferred-s3.test.ts` holds skipped stubs with the real asserts, to be un-skipped when the systems exist.


## Deferred to post-game polish (Anh 19:30)

These four labs stay in the suite as `it.skip` with the reason string `deferred to post-game polish (Anh 19:30)`. Bodies are unchanged. They are not dropped.

| Test | File | What it checks |
|---|---|---|
| M2 400-seed peel preview lab | `03-auto-peel.test.ts` | `peel_start` fires in ≥ 70% of `dive` events with `peeler_perceived === true`, over 400 seeds; the denominator is recorded and must be > 0 (L1160, L1735, R #3 S2-4). Unperceived dives are still logged and counted separately. On tip `7685c53`, the even-OVR 400-seed lab measured **0 of 1200** dives with `peeler_perceived === true` (constructed preview rates are not a measurement). |
| Focus-slot `focus_id` (unconditional) | `09-gd-rulings-r3.test.ts` | When the coach flags a Focus slot, `fight_call.focus_id` is that slot (§12 L1352). Pending rewrite to S2-R4-4 L1930 (option a): `focus_id` is the targeting-score winner after the ×1.25 bump, not a hard assignment. |
| hold_R vs auto contrast | `11-probe-gaps.test.ts` | Same fixture: auto casts R at the first legal moment; `hold_R` holds it while `A_true < 0.55` and the Focus stays above 40% HP (§12 L1359, §8.4 L1007). |
| Focus scored from the actual shotcaller | `13-anti-tuning.test.ts` | Two identical-kit bodies: the one closer to the shotcaller is `focus_id`, including when the shotcaller is at the pad (§9.1 L1101). |

The disengage-follow check in `10-gd-rulings-r4.test.ts` (R #4 S2-R4-2 L1926) is **not** deferred.

## Needs S3 (zone / orbs / buffs)

| Item | Spec | Why deferred |
|---|---|---|
| Hold the Pit > Hunt > Starve on **mean zone-time**, 200 even-OVR games | M2-23 L1736, plan §8.4, sandbox §11 S2, §9.2 L1107–1111 | Requires a working zone, exclusive occupation, and `zone_tick` (or an official zone-time counter). The skipped test uses `zone_tick` count as the observable. |
| Starve > Hunt > Hold on **mean orb pickups**, same 200 games | same | Requires orb spawn / pickup (S3). The skipped test counts `orb_pickup`. |
| Hold the Pit: at least two units occupy or walk to the zone when it is capturable or owned | §9.2 L1107 | Zone occupation. |
| Marksmen hold the **zone rim** at `hold_dist` | §9.2 L1107, L1025 | Zone rim. (The generic backliner-vs-threat hold_dist test is live in `05-attribute-hooks.test.ts`.) |
| Starve: a body walks in to pause the enemy tick timer, then out | §9.2 L1111 | Zone tick pause. |
| Orbs only on the way / router `eta_max` Decision hook / Starve orb assignment | §8.4 L958–966, §9.2 L1117 | Orbs. |
| Buff assignment: two up buffs → two different units | §9.2 L1115 | Buff spawns (first spawn 1:30, S3). |
| Incoming-wave −0.08 on `A_commit` when enemy respawns arrive in the fight in < 3 s | §9.1 L1101, R #3 S2-4 | `a_commit` is now a required `fight_call` field (tested in `09`). The −0.08 incoming-wave case itself still needs a live fight in which an enemy respawn will arrive in the fight in < 3 s, which this suite does not construct. |
| Claims, any-unit deny, empty-zone award, banished-does-not-deny | §5.6 L289–292, M3-26 | S3. |
| 0 illegal enemy-sanctuary entries in a 2,000-game lab | M3-25, §9.6 L1164 | S3 lab size. Single-chase “chaser never enters the pad” is already an S2 test. |

## Needs M6 (larger lab, not S3 systems)

| Item | Spec | Why deferred |
|---|---|---|
| Auto-peel ≥ 70% over **2,000 even-OVR** games | M2-22 L1735 | M2 ships the **400-game constructed-dive preview** in `03-auto-peel.test.ts` (denominator recorded). The 2,000-game even lab is the M6 follow-up. |
| Isolation: +30 in one attribute moves team win% +3 to +6 pp, no hook >2× another, 400 games/arm | §8.5 L1052–1058 | Explicitly M6. Needs full-match winners (S3 scoring). |

## Intentionally not deferred (tested in S2)

Chase-stops at sanctuary, at 10 tiles, and at `est_ttk > 2`; `fight_call` 2v2 / 3+ (next-tick, with `a_commit` / `shotcaller_id`); peel ≥ 70% preview over `dive` events with `peeler_perceived`; digest with AI on, `intent` only on change; WalkFromPad; the hooks in `05-attribute-hooks.test.ts`; R #3 hysteresis, perception/reaction delays, `hold_R` / Focus, and hexed-to-pad-centre; R #4 reach / follow-call / G9-near-pad; v4 probe gaps (Focus ×1.25, Lock ×1.25, peeler_perceived false, hold_R vs auto, AI intent-on-change).
