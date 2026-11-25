# Sandbox sweep — 2000 games, diverse settings

Setup: Watch sandbox rules (three capture points + round-3 teamfight AI), branch
`sandbox/latest`. 1000 seeds (20270000–20270999), each run twice: picks as drafted,
then picks swapped between sides. Per seed: role-filled quick draft, one of the 9
blue × red tactic pairings, random aggression / protect-the-carry / combo style per
side, every player attribute jittered ±12 around the even-OVR default.

Reproduce (about 35 s on 10 shards):
`for k in 0..9: npx tsx apps/lab/sandbox-sweep.ts --from k*100 --to k*100+100 --out lab/sandbox-sweep/rows-k.jsonl`,
concatenate to `rows.jsonl` (not committed), then
`python3 apps/lab/sandbox-sweep-report.py lab/sandbox-sweep/rows.jsonl`.

Caveat: the quick draft fills roles, and top (brannoch, rhedan) and support (ysol,
saelo) have only two champions each, so those pairs face each other in every game.
Their win rates mirror each other and measure one matchup.

## Overall (n=2000)
| metric | value |
|---|---|
| Match length median (p10–p90) | 81 s (66–97) |
| End reasons | {'first_to_10': 2000} |
| Blue side win | 50.0% (95% CI 47.8–52.1) |
| Winner's points: kills / majority ticks / claims | 71 / 19 / 10% |
| Winning margin (mean) | 3.8 |
| Kills per game | 12.1 |
| Quiet time (median) | 0.0% |
| Gang deaths (3+ assists) | 46.4% |
| Solo kills / multikills per game | 0.44 / 1.82 |
| Lead changes / comeback wins | 1.13 / 62.7% |
| Side and middle fighting at once | 52.5% of fight time |
| First ult (median) / games reaching L7 | 52 s / 6.3% |
| Swapped twin had the opposite winner | 52.9% |

## Tactics (preset vs preset, both sides pooled; win % of the row preset)
| row vs col | hold_the_pit | hunt | starve |
|---|---|---|---|
| hold_the_pit | — | 66% (n444) | 57% (n444) |
| hunt | 34% (n444) | — | 35% (n444) |
| starve | 43% (n444) | 65% (n444) | — |
Median length by pairing: hold/hold 81s, hold/hunt 80s, hold/star 79s, hunt/hunt 89s, hunt/star 82s, star/star 79s

## Coach settings (win % when the two sides differ on the setting)
- Aggression: -1: 52.8% (n920, CI 50–56), 0: 50.9% (n894, CI 48–54), 1: 46.3% (n926, CI 43–50)
- Protect the carry: False: 49.0% (n930, CI 46–52), True: 51.0% (n930, CI 48–54)
- Combo style: auto: 49.8% (n1010, CI 47–53), hold_R: 50.2% (n1010, CI 47–53)

## Player attributes (team mean difference vs win)
- aim: corr +0.068; team ahead by ≥4 wins 56.1% (n788)
- reflexes: corr +0.080; team ahead by ≥4 wins 55.4% (n798)
- execution: corr -0.001; team ahead by ≥4 wins 51.4% (n780)
- decision: corr +0.028; team ahead by ≥4 wins 52.1% (n748)
- positioning: corr +0.002; team ahead by ≥4 wins 50.5% (n746)
- teamwork: corr -0.025; team ahead by ≥4 wins 47.4% (n726)

## Champions (side-swap pooled; 95% Wilson CI)
| champion | role | win % | 95% CI | games | KDA | dmg/game | flag |
|---|---|---|---|---|---|---|---|
| brannoch | top | 64.3% | 62–66 | 2000 | 3.22 | 2173 | **strong** |
| calder | mid | 62.5% | 59–66 | 966 | 4.39 | 2451 | **strong** |
| mirren | mid | 54.7% | 52–58 | 1012 | 3.91 | 2181 | lean strong |
| isra | adc | 54.1% | 51–57 | 1406 | 13.49 | 3885 | lean strong |
| torun | jungle | 52.7% | 50–55 | 1318 | 3.46 | 1073 |  |
| ysol | support | 51.5% | 49–54 | 2000 | 3.09 | 1587 |  |
| tolle | jungle | 49.9% | 47–53 | 1344 | 3.38 | 1149 |  |
| huntress | adc | 49.8% | 47–53 | 1316 | 7.65 | 3553 |  |
| helvar | mid | 48.5% | 45–52 | 984 | 5.02 | 2357 |  |
| saelo | support | 48.5% | 46–51 | 2000 | 2.84 | 1564 |  |
| sedge | jungle | 47.5% | 45–50 | 1338 | 2.76 | 2401 |  |
| maelis | adc | 45.7% | 43–48 | 1278 | 10.33 | 3410 | lean weak |
| rhedan | top | 35.6% | 34–38 | 2000 | 1.30 | 1993 | **weak** |
| kerrig | mid | 35.2% | 32–38 | 1038 | 1.25 | 1664 | **weak** |

## Composition archetypes
vs field: Peel 63% (n872), Other 59% (n756), Poke 50% (n1262), Dive 36% (n936), Balanced 19% (n174)
head to head (n≥40): Other>Dive 66% (n318), Other>Poke 68% (n196), Peel>Balanced 79% (n102), Peel>Dive 68% (n218), Peel>Other 59% (n242), Peel>Poke 59% (n310), Poke>Balanced 83% (n72), Poke>Dive 59% (n400)
