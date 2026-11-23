# Career engine report (C0–C2)

Headless Bound Circuit engine on `career-engine`. The branch is rebased onto `2cdcf26fedea20fc9cb4bcd848900496e588d9de` (`cursor/s1-sim-acceptance-fixes-1498`, the PM-passed S1). The `s1` branch was not moved. `sim/`, `tests/acceptance/`, and the existing tests were not edited.

Sources:

- GDD v1.1.4 Appendix C-R2 `3e937e9f0528848af3fa695fb188284a6e52d2021e7cb919c2cb7b15edc88491`
- Paper model `1491cd21a5a7dce0ad565484d0e51d7f5d3f429c25d571bc0638b34281ac8445`
- Plan `b175c2340b7cc5534cfdab987772c7a962ab8d7d123fae45ec3066003da22140`

## Commits

| Milestone | Commit | What landed |
|---|---|---|
| C0 | `9051fcab768c8a60382e5cff6455ac9fcb4dc1a2` | `packages/match-contract` (`career-match/1`, validators, `fake:` digests, `claim_denies` missing = 0) and the fake runner plus the non-shippable stand-in world |
| C1 | `38231d54730644d9303afa1d043cf32d1bc2b1aa` | Circle calendar, C-R-1 table, player-series-first matchdays, MD8/MD9 Bo5 bracket, fake season runner |
| C2 | `26a9a8d046b97f200943aa7e5fb54541c21a2d2d` | Glicko-2, placement points, awards, contract tick, canonical save |
| Report | `1b589b00803eaf39ff94d13ead1b1adbd8384cde` | First proof write-up, replayed onto the new base |
| Verify | `1c6ab2144a865ef8e87bb1a13f9c98300080980d` | Pin the season sha, map-diff fixture, Glickman digits, shared `meanMapRating`, career purity allow-list |
| C-R2-3 | `be25fe1f6e1e43d9b746bedd30644d5eda32d79d` | Paper `opening_world` dump, mastery projection, Marks wages |
| C-R2-4 | `f0dad6eb8f8723c69b66fb6ffb348f3e8f711aa7` | Sudden death is 8–7, 9–8, or 10–9, equal weights |
| C-R2-5 | `e03ee0353556ff90cb1ad7f3307354fc61d44142` | AI tactic is opening index `i % 3`; human default Hold |

## Commands

Recorded on this branch after the rebase onto `2cdcf26`.

| Command | Exit | Notes |
|---|---:|---|
| `npm run purity` | 0 | `sim/` stays fully banned. `packages/career` and `packages/match-contract` are scanned too. Allow-list: `strength.ts` `Math.exp`; `glicko.ts` `Math.exp` / `Math.log` / `Math.sqrt` / `Math.PI`; `fake.ts` `Math.log` / `Math.cos` / `Math.sqrt` / `Math.PI` (Box–Muller); `c0.test.ts` `Math.exp` (the logistic check). An allow-list entry with no call fails the scan |
| `npx vitest run packages` | 0 | Career package tests include the pinned world sha, tactic table, sudden-death counts, grant order, and the two-process save |
| `npx tsc --noEmit` | 0 | Clean on the PM-passed S1 base |
| `npx vitest run` | 0 | 1129 tests, 38 files |

## Season sha256

Career seed `20261123`, club `juniper-rush`, stand-in world seed `20261123` (the world does not use the career seed).

Two processes, `npx tsx apps/lab/career-season.ts --sha`:

```
b9493793a066bf72748f60e363b9e1318990ed4725401efd8611a468308a8b7c
```

Before Appendix C-R2 the same command printed `d52abbc3d6fd7894f8a440abad03eefb0d36742fc6d73a210a83ce51d15d68a9`. That digest moved because three rulings change the canonical save: the paper opening world (rosters, mastery, wages, club following), sudden-death scores (no longer a coin, so later draws in those games move), and AI tactics (Hold/Hunt/Starve by opening index, so strengths and winners move). The rebase onto `2cdcf26` had left the earlier digest unchanged. `packages/career/src/c2.test.ts` pins the new digest.

The two stdout bytes matched. The in-process canonical save hashes to the same value. The JSON is `canonicalString` of the save (sorted keys, no trailing newline).

On that season, Neon Tide finishes 5th at 3 wins, map diff 0, 9 maps won, and Sable Comets finishes 6th at 2 / −3 / 8. The constructed standings fixture still ranks Neon Tide 2 / −3 / 7 above Sable Comets 2 / −4 / 8, which is the case where map differential and maps won disagree.

Invariants covered by tests: 28 unique regular pairs; published MD1–MD7 blue/red table; even clubs 4 blue sides and odd clubs 3; tie-break by series wins, map diff, maps won, head-to-head, then lower opening index, including the case where map diff and maps won disagree; playoff 1v4 and 2v3 then those winners, higher seed blue; point sum 73; Glickman 2013 example with the default `GLICKO_TAU` (asserted `=== 0.5`): 1500/200/0.06 vs 1400, 1550, 1700, scores 1, 0, 0 → r′ 1464.0507, RD′ 151.5165, σ′ 0.059996; idle clubs keep mu/phi/sigma; award minimum of 4 regular series; `meanMapRating` is the mean used by series MVP, the Finals MVP statistic, and the award sorts; Zonekeeper `zone_seconds + 20 * claim_denies`; lower `player_id` on a remaining tie; contract tick and renew-at-wage; no `crown-of-the-split` in the save.

## Assumptions

These are frozen so the runner is deterministic. They are not rulings. Detail is in `lab/career/OPEN-QUESTIONS.md`.

- The opening world is the frozen paper dump `opening_world(random.Random(20261123))`, SHA-256 `19b3fbe89aa605b8d131d8112e2790b82d5faae3e4fb395be22fcdffae7b0088` of the compact player array (C-R2-3). Ids are `standin-{pid}` and names are the model's `P####` placeholders, `shippable: false`, until GD-15. The old `P0001`–`P0080` sequence and `standin-{tag}-{slot}-{depth}` ids are gone. Mastery is `round(mastery_main)` on the lowest in-slot champion id and 60 on the other in-slot champions. Wages are the model's Marks scale (about 31–164 here) and stay in the data; this slice has no roster UI. Starter-OVR means under the paper `starters_of` order are ILO 77.4, HKW 70.8, NTD 69.0, VNO 67.8, JNR 65.4, SBC 63.8, GLW 61.8, KST 57.2. Play still picks starters by highest in-slot OVR, then lower `player_id`. Following is the paper scale (72 down to 32).
- Champion slots are a copy of the sandbox's 14 champions so each role has two fearless options. Picks are highest in-slot mastery, then lower champ id. Missing mastery is 70 in-slot and 40 off-slot.
- AI tactics follow opening index `i % 3` (C-R2-5): Hold for Iron Lotus, Vanta Owls, and Glasswing; Hunt for Hanok Wolves, Juniper Rush, and Kestrel Row; Starve for Neon Tide and Sable Comets. The human club uses the chosen preset, default Hold, so the recommended Juniper Rush opener against Vanta Owls is Hold versus Hold. No +1.2 human term. Aggression stays 0 and combo style stays `auto`. `k = 0.10`. Picks stay highest in-slot mastery, then lower champion id, fixed draft, no bans, fearless in games 1–2.
- RNG is splitmix32. A unit draw is `(u32 + 0.5) / 2^32`, in (0, 1). `seriesSeed = mix(careerSeed, ordinal + 1)`. `gameSeed = mix(seriesSeed, gameIndex)`. Ordinals are 0–27 in circle order, then 28, 29, 30 for 1v4, 2v3, and the final. Play order does not change seeds.
- `Math.exp`, `Math.log`, `Math.cos`, `Math.sqrt`, and `Math.PI` are used in `packages/career` only. `sim/` does not call them. No `Math.random`, `Date`, or wall clock in the career packages.
- First-to-10 duration is piecewise linear on knots (0, 90), (0.10, 132), (0.25, 165.5), (0.50, 200), (0.75, 220), (0.90, 235), (1, 239.5). The 90 and 239.5 ends are invented. The even-length mix in §14.5 was not re-fit.
- Every sudden death is 8–7, 9–8, or 10–9, equal weights (C-R2-4). It does not use a fair coin or the first-to-10 loser table. Zone and takedown scores stay an even draw of those same three lines. `coin_flip` is stored 10–9. Score parts are 40/35/25 times `(0.85 + 0.30 u)`, then largest remainder.
- Role weights, damage/heal/zone ranges, and `z = 0.35 * Box-Muller` are in `packages/career/src/fake.ts`. Team `claim_denied` / `claim_paid` are `u32 % 5` per side. Denies are dealt out with a top/support bias and sum to the team total. `peel_eligible` equals the sum of peels. `sanctuary_violations` is 0. `t_first_R = 0.3 * duration`, `t_L7 = 0.7 * duration`. Archetype strings are the tactic presets. Assists total `round(1.4 * kills)`.
- Cards fire when `u < 0.5`. There is no priced catalogue, so the 6-point cap is not applied.
- Placement points use the §7.2 row plus champion +12, runner-up +7, each semi-loser +4. The regular place is provisional until MD7 and then frozen. Sum at the end of the year is 73. Glicko and points live on `ranking_log` and `club_state`, not as new required §14 fields.
- Glicko stores `mu`, `phi`, `sigma`. Display is `r = 173.7178 * mu + 1500`, `RD = 173.7178 * phi`. Init is `mu = 0`, `phi = 350 / 173.7178`, `sigma = 0.06`, tau `0.5` (`GLICKO_TAU`). The example test calls `glickoUpdate` with that default and checks r′ 1464.0507, RD′ 151.5165, σ′ 0.059996 (the engine's values round to those printed figures: 1464.0506705…, 151.5165241…, 0.059995984…). Idle clubs are not given Glickman's sit-out RD bump.
- The dump script is `lab/career/dump-opening-world.py`. The runtime reads the frozen JSON and does not call Python.
- Award signatures, confirmed by C-R2-1 and C-R2-6: Split MVP → `pillar-of-the-split`, then `convergence-crown` for the five game-1 starters on the winning side of the final, then Finals MVP → `finals-poise`. The 1-cap keeps the newer one, so a player who receives all three holds `[finals-poise]`. Deadeye, Shepherd, and Zonekeeper get no signature. The final's `mvp_player_id` is the Finals MVP. *Crown of the Split* is not granted.
- If the human club is in neither semi, MD8 plays 1v4 then 2v3.
- `loadSave` accepts unknown keys and does not strip them on the object it returns. `saveJson` writes only the known save.

Proof club for the hash above is Juniper Rush, the recommended first save. Any other club changes matchday play order and therefore the ranking-log order. Series seeds do not depend on that order.
