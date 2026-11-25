# Teamfight dynamics round 2 (branch `exp/teamfight-dynamics`)

Experimental, not build-spec. Behind `MatchConfig.teamfight`; the combined set is
`TEAMFIGHT_EXPERIMENT` in `sim/cadence.ts` (Watch: "Cadence + teamfight (exp)").
Default digests unchanged (`npm test` 1524 passed).

```bash
npx tsx apps/lab/cadence-lab.ts --n 40 --arms baseline,ults,combo_target,formation,tf2,tf2_cadence --out lab/teamfight2
```

| Flag | Change |
|---|---|
| `r_min_level: 3`, `r_cd_mult: 0.7` | Ults unlock at level 3 (spec 5), 30% shorter R cooldown |
| `combo_target` | Per-kit cast rules aim at the nearest ally-locked enemy (within 8 tiles) |
| `formation` | Backline stays 1.5 tiles behind its nearest front-liner (never walks backward for it); divers flank 3 rows wide when >4 tiles out; front-liners have no TTK chase stop |
| `tf2` | All of the above + round-1 `chase` |

Headline (80 games per arm per tactic; full table `REPORT-table.txt`):

| Metric | Hold base → tf2 → tf2+cadence | Hunt base → tf2 |
|---|---|---|
| Kills / game | 11.3 → 14.3 → 13.3 | 6.3 → 11.0 |
| Quiet time (median) | 26% → 11.5% → 10% | 59% → 11% |
| Final margin | 4.3 → 2.9 → 3.6 | 7.0 → 4.0 |
| Ult casts / game | 8.5 → 16.0 → 15.1 | 4.9 → 16.1 |
| Ults into ally CC | 2.0 → 4.6 → 4.3 | 0.7 → 4.9 |
| Distinct killers / game | 6.5 → 7.4 → 7.2 | 4.4 → 6.6 |
| Multikills / game | 1.1 → 1.6 → 1.6 | 0.8 → 0.8 |

Notes:
- `formation` is the main lever (Hold quiet 26% → 12%, kills 11.3 → 14.2 alone). Its first version
  deadlocked Hunt (0 kills): carries waited behind tanks that TTK-idled. Fixed by anchoring only
  on nearby front-liners and dropping the front line's TTK chase stop; that chase change is part
  of the formation effect.
- `ults` alone doubles ult casts but raises Hold quiet time (26% → 33%): ults fire, fights do not grow.
- `combo_target` alone does nothing measurable; with more ults (tf2) ults into CC rise 2.0 → 4.6.
- Still unsolved: deaths stay 5-man (gang deaths ~70%), solo kills ~0.2/game, matches ~100–110 s.
