# exp/objectives — three points vs pulse pit

Branch `exp/objectives` (from `exp/teamfight-r3`). Both modes are behind
`MatchConfig.objectives` (absent by default; default digests unchanged). Every arm runs
on the round-3 AI without `disengage` (`tf3_keep`). n = 40 seeds × side swap = 80 games
per arm per tactic. Run with:
`npx tsx apps/lab/cadence-lab.ts --n 40 --arms tf3_keep,points,pulse --out lab/objectives`.
Full table: `REPORT-table.txt`.

## Modes

- **points**: capture points at north (12, 2.2), centre (12, 8) and south (12, 13.8).
  No pit scoring. Owning 2 of 3 scores 1 every 18 s. Ownership persists until recaptured.
- **pulse**: the pit is open 30 s of every 50 s. While it is closed, north and south
  shrines are live and each pays 1 point once per window to its capturer.

Shared AI changes (only with `objectives` set):
- Fight detection runs on the largest cluster within 5 tiles, not one global fight.
- Units assigned to a side point skip the main fight and fight only what they meet.
- Units outside the main fight ignore its disengage call unless locally outnumbered.
- Slot → point assignment per tactic (`planner.ts` `POINT_HOME` / `SHRINE_HOME`). With
  its home point held, a unit rotates to the nearest point its team does not own.
- Pulse regroups on the pit 6 s before it reopens.

## Results (tf3_keep → points / pulse)

| | Hold | Hunt | Starve |
|---|---|---|---|
| Side and middle fighting at once (% of fight time) | 19 → 47 / 22 | 13 → 58 / 36 | 18 → 55 / 35 |
| Gang deaths | 60 → 54 / 64 | 63 → 38 / 53 | 65 → 53 / 42 |
| Quiet time | 8.5 → 0 / 0 | 10 → 0 / 0 | 88 → 0 / 40 |
| Comeback wins | 79 → 79 / 88 | 41 → 38 / 74 | 39 → 48 / 71 |
| Lead changes | 1.7 → 1.4 / 1.6 | 0.7 → 0.7 / 1.4 | 0.3 → 0.8 / 1.3 |
| Match length (median s) | 110 → 80 / 84 | 122 → 84 / 85 | 240 → 70 / 134 |
| Solo kills | 0.3 → 0.4 / 0.2 | 0.3 → 0.5 / 0.5 | 0.3 → 0.4 / 0.7 |

- **points** splits the map: side and middle fight at once about half the time, and
  gang deaths fall most in Hunt. Starve finally plays (0% quiet).
  Comebacks do not improve, and margins grow slightly.
- **pulse** gives the best comebacks and lead changes (Hunt comeback 41% → 74%) through
  its open/close rhythm. It barely changes Hold (split 22%, gang deaths up) and leaves
  Starve 40% quiet.
- `concurrent_fights` stays about 1.1 for both. Its 5-tile grouping merges fights on this
  16-tile-tall map, where side points sit 5.8 tiles from the centre. Use
  `side_and_mid_fight_pct` instead.
- Solo kills stay below 1 in every arm. Side fights still draw a second unit before
  anyone dies.
- Matches are about 30% shorter in both modes. Post-fight claims (§5.6) now pay out
  most of the score. Cutting or slowing claims is the next tuning step.

## Known prototype limits

- Watch does not draw the points or shrines yet; positions are only checked in the lab.
- Claims are denied by standing in the old pit circle, including in `points` mode.
