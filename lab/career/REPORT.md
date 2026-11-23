# Career engine report (C0–C2)

Headless Bound Circuit engine on `career-engine`, based on `s1`. `sim/`, `tests/acceptance/`, and the existing tests were not edited.

Sources, both hashes verified:

- GDD v1.1.3 `4575e2540e16f75bf4e6233fb8f76cd738243a25571d9e21e3181084044059fa`
- Plan `b175c2340b7cc5534cfdab987772c7a962ab8d7d123fae45ec3066003da22140`

## Commits

| Milestone | Commit | What landed |
|---|---|---|
| C0 | `2dcae31bdf66d89dcca2226245b70afe320b9d4b` | `packages/match-contract` (`career-match/1`, validators, `fake:` digests, `claim_denies` missing = 0) and the fake runner plus the non-shippable stand-in world |
| C1 | `4dac49c35a1e93aaf770240c5e676a749cf9350d` | Circle calendar, C-R-1 table, player-series-first matchdays, MD8/MD9 Bo5 bracket, fake season runner |
| C2 | `e313899a3d1d0672594d9ec94a169c7cbb1fd265` | Glicko-2, placement points, awards, contract tick, canonical save |

## Commands

Recorded on this branch after C2.

| Command | Exit | Notes |
|---|---:|---|
| `npm run purity` | 0 | `PURITY OK` for `sim/` |
| `npx vitest run packages` | 0 | 19 tests, 4 files. Includes the two-process save |
| `npx tsc --noEmit` | 2 | 29 errors, all in `sim/`, `apps/lab/lab-s1.ts`, and existing `tests/`. None under `packages/` or `apps/lab/career-season.ts`. The same `tsc` errors are already on `s1` with these files stashed |
| `npx vitest run` | 1 | 369 passed, 724 failed, 18 files failed. Career tests pass. The failures are the existing S1 kit/sim mismatch (`l7_formula` and `cc.effect` are read by `sim/` and the old tests, and are absent on the `s1` kits). Not introduced here |

`s1` was fetched. It matches this branch's parent. Making that suite green means editing `sim/` or `data/champions/kits.ts`, which this task left alone.

## Season sha256

Career seed `20261123`, club `juniper-rush`, stand-in world seed `20261123` (the world does not use the career seed).

Two processes, `npx tsx apps/lab/career-season.ts --sha`:

```
d52abbc3d6fd7894f8a440abad03eefb0d36742fc6d73a210a83ce51d15d68a9
```

The two stdout bytes matched. The in-process canonical save hashes to the same value. The JSON is `canonicalString` of the save (sorted keys, no trailing newline).

Invariants covered by tests: 28 unique regular pairs; published MD1–MD7 blue/red table; even clubs 4 blue sides and odd clubs 3; tie-break by series wins, map diff, maps won, head-to-head, then lower opening index; playoff 1v4 and 2v3 then those winners, higher seed blue; point sum 73; Glickman 2013 example (1500/200/0.06 vs 1400, 1550, 1700, scores 1, 0, 0 → about 1464.06 / 151.52 / 0.05999); idle clubs keep mu/phi/sigma; award minimum of 4 regular series; Zonekeeper `zone_seconds + 20 * claim_denies`; lower `player_id` on a remaining tie; contract tick and renew-at-wage; no `crown-of-the-split` in the save.

## Assumptions

These are frozen so the runner is deterministic. They are not rulings. Detail is in `lab/career/OPEN-QUESTIONS.md`.

- Stand-in rosters hit the paper-model starter OVR targets (76, 72, 70, 68, 66, 64, 62, 58) exactly. Names are `P0001`–`P0080`, ids start with `standin-`, `shippable: false`, label `NON-SHIPPABLE STAND-IN seed 20261123`. Seed 20261123 draws only length (1–4), wage (`40000 + u32 % 20001`), and age (18–27). Attributes copy OVR. Potential is OVR + 5. Following is a display ladder (800 down to 320) and is not used in any result.
- Champion slots are a copy of the sandbox's 14 champions so each role has two fearless options. Picks are highest in-slot mastery, then lower champ id. Missing mastery is 70 in-slot and 40 off-slot.
- Every club's tactic is Hold. The ±2.0 edge is implemented and tested; it is 0 in the season because both presets match. No +1.2 human term. Secondary, aggression, focus, protect, and combo style do not move strength. `k = 0.10`.
- RNG is splitmix32. A unit draw is `(u32 + 0.5) / 2^32`, in (0, 1). `seriesSeed = mix(careerSeed, ordinal + 1)`. `gameSeed = mix(seriesSeed, gameIndex)`. Ordinals are 0–27 in circle order, then 28, 29, 30 for 1v4, 2v3, and the final. Play order does not change seeds.
- `Math.exp`, `Math.log`, `Math.cos`, `Math.sqrt`, and `Math.PI` are used in `packages/career` only. `sim/` does not call them. No `Math.random`, `Date`, or wall clock in the career packages.
- First-to-10 duration is piecewise linear on knots (0, 90), (0.10, 132), (0.25, 165.5), (0.50, 200), (0.75, 220), (0.90, 235), (1, 239.5). The 90 and 239.5 ends are invented. The even-length mix in §14.5 was not re-fit.
- Inside sudden death, "reached 10" is a fair coin. Other sudden-death and zone/takedown scores are an even draw of 8–7, 9–8, and 10–9. `coin_flip` is stored 10–9. Score parts are 40/35/25 times `(0.85 + 0.30 u)`, then largest remainder.
- Role weights, damage/heal/zone ranges, and `z = 0.35 * Box-Muller` are in `packages/career/src/fake.ts`. Team `claim_denied` / `claim_paid` are `u32 % 5` per side. Denies are dealt out with a top/support bias and sum to the team total. `peel_eligible` equals the sum of peels. `sanctuary_violations` is 0. `t_first_R = 0.3 * duration`, `t_L7 = 0.7 * duration`. Archetype strings are the tactic presets. Assists total `round(1.4 * kills)`.
- Cards fire when `u < 0.5`. There is no priced catalogue, so the 6-point cap is not applied.
- Placement points use the §7.2 row plus champion +12, runner-up +7, each semi-loser +4. The regular place is provisional until MD7 and then frozen. Sum at the end of the year is 73. Glicko and points live on `ranking_log` and `club_state`, not as new required §14 fields.
- Glicko stores `mu`, `phi`, `sigma`. Display is `r = 173.7178 * mu + 1500`, `RD = 173.7178 * phi`. Init is `mu = 0`, `phi = 350 / 173.7178`, `sigma = 0.06`, tau `0.5`. The example test allows the paper's printed rounding (1464.06, 151.52, 0.05999). Idle clubs are not given Glickman's sit-out RD bump.
- Award signatures, in order: Split MVP → `pillar-of-the-split`, then `convergence-crown` for the five game-1 starters on the winning side of the final, then Finals MVP → `finals-poise`. The 1-cap keeps the newer one. Deadeye, Shepherd, and Zonekeeper get no signature. *Crown of the Split* is not granted.
- If the human club is in neither semi, MD8 plays 1v4 then 2v3.
- `loadSave` accepts unknown keys and does not strip them on the object it returns. `saveJson` writes only the known save.

Proof club for the hash above is Juniper Rush, the recommended first save. Any other club changes matchday play order and therefore the ranking-log order. Series seeds do not depend on that order.
