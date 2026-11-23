# Career engine report (C0–C2)

Headless Bound Circuit engine on `career-engine`. The branch is rebased onto `2cdcf26fedea20fc9cb4bcd848900496e588d9de` (`cursor/s1-sim-acceptance-fixes-1498`, the PM-passed S1). The `s1` branch was not moved. `sim/`, `tests/acceptance/`, and the existing tests were not edited.

Sources, both hashes verified:

- GDD v1.1.3 `4575e2540e16f75bf4e6233fb8f76cd738243a25571d9e21e3181084044059fa`
- Plan `b175c2340b7cc5534cfdab987772c7a962ab8d7d123fae45ec3066003da22140`

## Commits

| Milestone | Commit | What landed |
|---|---|---|
| C0 | `9051fcab768c8a60382e5cff6455ac9fcb4dc1a2` | `packages/match-contract` (`career-match/1`, validators, `fake:` digests, `claim_denies` missing = 0) and the fake runner plus the non-shippable stand-in world |
| C1 | `38231d54730644d9303afa1d043cf32d1bc2b1aa` | Circle calendar, C-R-1 table, player-series-first matchdays, MD8/MD9 Bo5 bracket, fake season runner |
| C2 | `26a9a8d046b97f200943aa7e5fb54541c21a2d2d` | Glicko-2, placement points, awards, contract tick, canonical save |
| Report | `1b589b00803eaf39ff94d13ead1b1adbd8384cde` | First proof write-up, replayed onto the new base |
| Verify | `1c6ab2144a865ef8e87bb1a13f9c98300080980d` | Pin the season sha, map-diff fixture, Glickman digits, shared `meanMapRating`, career purity allow-list |

## Commands

Recorded on this branch after the rebase onto `2cdcf26`.

| Command | Exit | Notes |
|---|---:|---|
| `npm run purity` | 0 | `sim/` stays fully banned. `packages/career` and `packages/match-contract` are scanned too. Allow-list: `strength.ts` `Math.exp`; `glicko.ts` `Math.exp` / `Math.log` / `Math.sqrt` / `Math.PI`; `fake.ts` `Math.log` / `Math.cos` / `Math.sqrt` / `Math.PI` (Box–Muller); `c0.test.ts` `Math.exp` (the logistic check). An allow-list entry with no call fails the scan |
| `npx vitest run packages` | 0 | 20 tests, 4 files. Includes the pinned season sha and the two-process save |
| `npx tsc --noEmit` | 0 | Clean on the PM-passed S1 base |
| `npx vitest run` | 0 | 1126 tests, 38 files |

## Season sha256

Career seed `20261123`, club `juniper-rush`, stand-in world seed `20261123` (the world does not use the career seed).

Two processes, `npx tsx apps/lab/career-season.ts --sha`:

```
d52abbc3d6fd7894f8a440abad03eefb0d36742fc6d73a210a83ce51d15d68a9
```

Before the rebase onto `2cdcf26` the same command printed `d52abbc3d6fd7894f8a440abad03eefb0d36742fc6d73a210a83ce51d15d68a9`. After the rebase it is the same. Career code does not import `sim/`, and the four career commits replayed with no conflict, so the canonical save did not move. `packages/career/src/c2.test.ts` pins this digest.

The two stdout bytes matched. The in-process canonical save hashes to the same value. The JSON is `canonicalString` of the save (sorted keys, no trailing newline).

On that season, Neon Tide finishes 5th at 2 wins, map diff −3, 7 maps won, and Sable Comets finishes 6th at 2 / −4 / 8. A separate standings fixture builds those two rows without the season RNG and checks that the better map differential ranks above the extra map won.

Invariants covered by tests: 28 unique regular pairs; published MD1–MD7 blue/red table; even clubs 4 blue sides and odd clubs 3; tie-break by series wins, map diff, maps won, head-to-head, then lower opening index, including the case where map diff and maps won disagree; playoff 1v4 and 2v3 then those winners, higher seed blue; point sum 73; Glickman 2013 example with the default `GLICKO_TAU` (asserted `=== 0.5`): 1500/200/0.06 vs 1400, 1550, 1700, scores 1, 0, 0 → r′ 1464.0507, RD′ 151.5165, σ′ 0.059996; idle clubs keep mu/phi/sigma; award minimum of 4 regular series; `meanMapRating` is the mean used by series MVP, the Finals MVP statistic, and the award sorts; Zonekeeper `zone_seconds + 20 * claim_denies`; lower `player_id` on a remaining tie; contract tick and renew-at-wage; no `crown-of-the-split` in the save.

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
- Glicko stores `mu`, `phi`, `sigma`. Display is `r = 173.7178 * mu + 1500`, `RD = 173.7178 * phi`. Init is `mu = 0`, `phi = 350 / 173.7178`, `sigma = 0.06`, tau `0.5` (`GLICKO_TAU`). The example test calls `glickoUpdate` with that default and checks r′ 1464.0507, RD′ 151.5165, σ′ 0.059996 (the engine's values round to those printed figures: 1464.0506705…, 151.5165241…, 0.059995984…). Idle clubs are not given Glickman's sit-out RD bump.
- The labelled stand-in world stays. The paper model is now on disk at `/cursor/stores/bot/career-inputs/lanebound-career-model-v1.py` (sha256 `1491cd21a5a7dce0ad565484d0e51d7f5d3f429c25d571bc0638b34281ac8445`) and was not used to replace `opening_world`.
- Award signatures, in order: Split MVP → `pillar-of-the-split`, then `convergence-crown` for the five game-1 starters on the winning side of the final, then Finals MVP → `finals-poise`. The 1-cap keeps the newer one. Deadeye, Shepherd, and Zonekeeper get no signature. *Crown of the Split* is not granted.
- If the human club is in neither semi, MD8 plays 1v4 then 2v3.
- `loadSave` accepts unknown keys and does not strip them on the object it returns. `saveJson` writes only the known save.

Proof club for the hash above is Juniper Rush, the recommended first save. Any other club changes matchday play order and therefore the ranking-log order. Series seeds do not depend on that order.
