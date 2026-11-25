# Sandbox balance pass 1

Patch: `SANDBOX_KIT_PATCH` in `sim/balance.ts`, applied only through
`MatchConfig.kit_patch` (Watch "Three points (exp)", `batch --sandbox`,
`sandbox-sweep`). The spec tables in `data/champions` are unchanged, so spec
digests, `data_hash` and the acceptance tests are unaffected.

Method: five tuning rounds of 900 games (sandbox sweep seeds 0–449, each played
with sides swapped), then validation on 2000 fresh games (seeds 2000–2999),
before and after on the same seeds. Baseline: `--no-kit-patch`.

| Champion | Win % before | Win % after | Deaths/game before → after |
|---|---|---|---|
| brannoch | 66.4 | 50.8 | 3.1 → 3.4 |
| calder | 63.4 | 49.9 | 2.8 → 3.0 |
| isra | 60.7 | 52.9 | 1.6 → 1.8 |
| torun | 55.9 | 52.3 | 2.7 → 2.7 |
| mirren | 54.8 | 50.5 | 3.1 → 3.2 |
| ysol | 51.3 | 49.5 | 3.2 → 3.3 |
| sedge | 49.9 | 48.0 | 3.9 → 4.0 |
| huntress | 49.8 | 49.8 | 2.4 → 2.4 |
| saelo | 48.7 | 50.5 | 3.4 → 3.5 |
| helvar | 48.6 | 51.7 | 2.7 → 2.7 |
| tolle | 44.4 | 49.8 | 2.6 → 2.4 |
| maelis | 39.7 | 47.3 | 1.9 → 1.6 |
| rhedan | 33.6 | 49.2 | 5.0 → 4.7 |
| kerrig | 32.4 | 47.9 | 5.7 → 5.2 |

Spread (best − worst) 34.0 → 5.6 points. Tactics vs field: Hold 54 / Hunt 51 /
Starve 45 (unchanged within noise). Median match 203 s → 211 s.

## Changes

| Champion | Change |
|---|---|
| Brannoch | Q Quarry Throw pierces first target only (was all), damage 125 → 105, slow 1.5 → 1.0 s. W knockup 0.6 → 0.5 s. R petrify stun 1.6 → 1.3 s |
| Rhedan | HP 1100 → 1200. Q damage 90 → 105. W root 0.7 → 0.9 s |
| Calder | Q Ashbreath range 6.4 → 5.8, damage 115 → 105, CD 6.5 → 8 s. R fear 1.6 → 1.2 s |
| Isra | Q range 8.5 → 7.5. R Starfall Mortar range 12 → 9, radius 3.4 → 2.8, damage 145 → 130, CD 60 → 70 s |
| Kerrig | HP 870 → 1020, physical resist 24 → 30. Q width 0.45 → 0.6. R CD 42 → 36 s |
| Maelis | HP 880 → 950. Q damage 160 → 155. W shield 80 → 120. R CD 55 → 42 s |
| Tolle | HP 1340 → 1450. Q stun 0.9 → 1.1 s, radius 1.6 → 1.9, CD 9 → 8 s |
| Mirren | W hex 1.6 → 1.3 s |

## Notes

- Top (Brannoch / Rhedan) and support (Ysol / Saelo) have two champions each,
  so each pair always meets; their win rates are one matchup measured twice.
- Kerrig's kit timing changes (mark 4 s, Self-Break 1.2 s) did not move her:
  Self-Break has nothing to disable on a champion without a passive, and the
  AI does not read the commitment window. Her problem was dying (5.7 deaths per
  game); base stats fixed it.
- Noise: about ±3 points per champion at 900 games, about ±2 at 2000.
