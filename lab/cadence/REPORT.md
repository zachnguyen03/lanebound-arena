# Orb/buff cadence experiment (branch `exp/orb-buff-cadence`)

Experimental, not build-spec. Everything is behind `MatchConfig.cadence` / the
`cadence-step1` preset; default digests are unchanged (`npm test`: 1513 passed).

```bash
npx tsx apps/lab/cadence-lab.ts --n 40 --arms baseline,step1,step2,step3 --out lab/cadence
```

80 games per arm per tactic (40 seeds × side swap). Full table: `REPORT-table.txt`,
raw: `results-baseline_step1_step2_step3.json`.

| Arm | What |
|---|---|
| step1 | Constants only: buffs 35 s / every 55 s, orbs every 20 s |
| step2 | + rover AI (jungle invades, support guards, carry takes own buff, skirmish-seek, detached rovers ignore pit disengage) |
| step3 | + orb waves (20 s), buff +20% dmg / +15% MS shared with allies within 4 tiles, `buff_soon` 10 s warning; Watch countdown, aura, BUFF DOWN tag |

Headline (Hold / Starve; Hunt unchanged because rovers are off under Hunt):

| Metric | Hold base → step3 | Starve base → step3 |
|---|---|---|
| Kills / game | 11.3 → 11.3 | 3.0 → 9.1 |
| Quiet time (median) | 26% → 23% | 92% → 29% |
| Skirmish deaths (≤4 units within 6 tiles) | 2.6% → 3.3% | 4.5% → 43.9% |
| Deaths in lanes / at orbs | 2.8% → 4.5% | 1.2% → 34.9% |
| Solo kills / game | 0.3 → 0.4 | 0.1 → 1.5 |
| Ult casts / game | 8.5 → 9.1 | 0 → 9.8 |
| Orb pickups / game | 0.4 → 12.4 | 57 → 48 |
