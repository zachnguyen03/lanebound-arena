# mutate-s3 survivors S3A10 / S3A12 / S3A19 / S3A20 / S3A22 / S3A23

Killers (or justification) in `tests/s3-mutation-survivors.test.ts`.

## Summary

| Id | Result | Notes |
|---|---|---|
| **S3A10** | KILLED | Pin seed `20261122` coin_flip winner = `red` |
| **S3A12** | EQUIVALENT | Capture already zeroes bars; owner guard blocks increments |
| **S3A19** | KILLED | Direct `tickArenaPhase11` with vx/vy back-projection geometry |
| **S3A20** | KILLED | Ahead at `SUDDEN_DEATH_T+BO1_EXTRA_S` → `sudden_death` not `clock` |
| **S3A22** | KILLED | Absolute HP on capture tick = start + base regen only |
| **S3A23** | KILLED | Leave+return must re-earn continuous dwell |

## Needles applied

| Id | File | Mutation |
|---|---|---|
| S3A10 | `sim/simulate.ts` | `flip < 0.5 ? "blue" : "red"` → inverted colours |
| S3A12 | `sim/arena.ts` | Drop `if (z.owner === …) z.progress_*_ticks = 0` |
| S3A19 | `sim/arena.ts` | Orb pickup also accepts `dist(x-vx*DT, y-vy*DT)` |
| S3A20 | `sim/simulate.ts` | Boundary ahead `sudden_death` → `clock` |
| S3A22 | `sim/simulate.ts` | Run aura heal **after** `tickArenaPhase11` (same-tick regen) |
| S3A23 | `sim/arena.ts` | Drop `z.dwell[u.id] = 0` on leave |

## GREEN (unmutated)

```
npx vitest run tests/s3-mutation-survivors.test.ts
✓ (6 tests)
Tests  6 passed (6)
```

## RED / equivalent under each needle

**S3A10** KILLED — `expected 'blue' to be 'red'` (winner flipped).

**S3A12** SURVIVED / EQUIVALENT — owner's published bar stays 0 because capture zeroes
both bars (`sim/arena.ts` capture block) and `if (z.owner !== "blue/red")` already
stops owner accumulation. Dropping the explicit held-at-0 lines is a no-op on tip.

**S3A19** KILLED — `expected orb_pickup length 0 but got 1` under vx/vy back-projection.

**S3A20** KILLED — `expected 'clock' to be 'sudden_death'`.

**S3A22** KILLED — capture-tick HP gains +1.5 aura; absolute pin fails.

**S3A23** KILLED — `expected deniers not to contain 'red:mid'` (cumulative dwell).
