# Teamfight dynamics round 3 (branch `exp/teamfight-r3`)

Experimental, not build-spec. Every lever is a `MatchConfig.teamfight` flag, off by default
(default digests unchanged, `npm test` 1524 passed + 9 new in `tests/exp-teamfight3.test.ts`).
Each arm = tf2 (round 2) + one lever; 80 games per arm per tactic.

```bash
npx tsx apps/lab/cadence-lab.ts --n 40 --arms baseline,tf2,spread,lanes,ranged_hold,spacing,cap,disengage,ult_timing,dodge,peel,tf3,tf3_roam --out lab/teamfight3
npx tsx apps/lab/cadence-lab.ts --n 40 --arms tf3_keep --out lab/teamfight3
```

| Flag | Change |
|---|---|
| `spread` | Ally separation 1.2 tiles (spec 0.6) in fight intents, 1.5× push for backliners (`sim/motor.ts`) |
| `lanes` | Backliners take their own row, 1.5 tiles apart by slot, on fight waypoints (`sim/ai/formation.ts`) |
| `ranged_hold` | Ranged units stop at 0.9× range instead of walking onto the target; step 3 tiles away from melee within 2 |
| `target_cap: 3` | At most 3 allies on one enemy; overflow picks the next best (`sim/ai/target.ts`) |
| `disengage` | Disengage call 0.07 A_true earlier + units under 30% HP near an enemy walk home |
| `ult_timing` | Veto R unless an area ult catches ≥2 enemies, or a single-target ult hits a locked / <50% HP target |
| `dodge` | Step out of a winding-up enemy ground circle |
| `peel` | Peel at 4.5 tiles (spec 3) without the perception delay |
| `spacing` | spread + lanes + ranged_hold |
| `tf3` | all of the above; `tf3_keep` = tf3 without `disengage`; `tf3_roam` = tf3 + cadence rovers (split objectives) |

New metrics (from debug `pos`, every 0.5 s): **ally spread** = mean pairwise distance between allies with an
enemy within 5 tiles; **fight len** = mean length of a stretch with ≥1 fight (a connected group of engaged units
holding both teams, links ≤5 tiles); **concurrent** = fights at once while any exist; **disengages** = Retreat
right after a fight intent.

## Hold the pit (n=80/arm)

| Arm | Kills | Quiet % | Margin | Len s | Gang % | Solo | Killers | Multi | R | Spread | Fight s | Concurrent | Disengages |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| baseline | 11.3 | 26.1 | 4.3 | 111 | 68.3 | 0.3 | 6.5 | 1.1 | 8.5 | 2.47 | 13.6 | 1.00 | 8.7 |
| tf2 | 14.3 | 11.5 | 2.9 | 105 | 72.3 | 0.2 | 7.4 | 1.6 | 16.0 | 2.90 | 15.0 | 1.01 | 17.7 |
| spacing | 13.8 | 8.7 | 3.2 | 113 | 65.8 | 0.3 | 6.9 | 1.5 | 17.1 | 3.52 | 16.7 | 1.06 | 18.8 |
| cap | 14.9 | 10.2 | 2.8 | 101 | 64.9 | 0.2 | 7.4 | 1.9 | 16.0 | 3.07 | 15.3 | 1.02 | 19.1 |
| disengage | 11.2 | 22.7 | 4.0 | 136 | 58.3 | 0.5 | 6.3 | 1.2 | 20.3 | 2.47 | 9.2 | 1.01 | 107 |
| ult_timing | 14.4 | 12.7 | 2.9 | 106 | 71.4 | 0.3 | 7.3 | 1.7 | 14.6 | 2.90 | 13.0 | 1.01 | 19.6 |
| dodge | 14.2 | 10.2 | 3.1 | 105 | 72.8 | 0.2 | 7.5 | 1.5 | 16.5 | 3.08 | 14.5 | 1.01 | 17.9 |
| peel | 15.0 | 10.7 | 2.6 | 99 | 68.6 | 0.2 | 7.6 | 1.8 | 15.8 | 2.93 | 15.7 | 1.01 | 20.5 |
| tf3 | 11.3 | 23.6 | 4.1 | 150 | 60.8 | 0.6 | 6.2 | 0.9 | 20.3 | 3.13 | 8.9 | 1.03 | 114.5 |
| **tf3_keep** | **14.2** | **8.5** | 3.0 | 110 | **59.5** | 0.3 | 7.5 | 1.7 | 15.4 | **3.67** | 17.8 | 1.06 | 20.7 |
| tf3_roam | 10.4 | 16.7 | 4.7 | 128 | 49.5 | 0.4 | 6.2 | 0.9 | 15.8 | 3.11 | 10.9 | 1.02 | 111.9 |

Hunt: tf2 → tf3_keep kills 11.0 → 11.5, quiet 11.4 → 9.9, gang 73.1 → 63.1, spread 2.75 → 3.98.
Starve stays ~90% quiet on every arm except tf3_roam (quiet 91 → 28%, kills 2.7 → 6.8, solo 1.1).
Single-lever spread/lanes/ranged_hold rows: `REPORT-table.txt`.

## Read

- **Spacing works, modestly.** Ally spread 2.9 → 3.5 tiles (3.7 in tf3_keep), Hold quiet time 11.5% → 8.7%,
  gang deaths 72% → 66%. Kills unchanged.
- **Target cap is the best single lever for gang deaths:** 72% → 65% with *more* kills (14.9) and multikills (1.9).
- **tf3_keep is the recommended set**: gang deaths 72% → 60% (Hold) / 73% → 63% (Hunt), lowest quiet time,
  kills held at tf2 level.
- **`disengage` failed.** The low-HP retreat flip-flops (Retreat ↔ fight, ~110 retreats/game vs 18), fights
  stall: Hold kills 14.3 → 11.2, quiet 11.5% → 22.7%, matches +30 s; Starve 0.6 kills and runs to overtime.
  It also drags the combined `tf3` arm down. Needs hysteresis (retreat until healed / sanctuary) before it is retried.
- **No measurable effect:** `ult_timing` (R casts 16 → 14.6, nothing else moves), `dodge`, `peel` (peel gives
  the closest margins, 2.6, but within noise).
- **Still unsolved:** concurrent fights ≈ 1.0 on every arm — the whole map still plays one fight; solo kills
  stay 0.2–0.6/game. Only split objectives (`tf3_roam`, the cadence rovers) move solo kills, and only in Starve.
  Whether roaming should be pushed harder is a **game-design call** (map/objective layout, not AI tuning).
