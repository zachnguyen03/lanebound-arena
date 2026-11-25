# Teamfight dynamics experiment (branch `exp/teamfight-dynamics`)

Experimental, not build-spec. Behind `MatchConfig.teamfight` (absent = spec
behaviour; `npm test` 1522 passed, default digests unchanged).

```bash
npx tsx apps/lab/cadence-lab.ts --n 40 --arms baseline,combo,roles,chase,tf,step3,tf_cadence --out lab/teamfight
```

| Flag | Change |
|---|---|
| `combo` | Locked enemy ×2.2 killability (was ×1.25); R hold rule never blocks an ult into a locked enemy |
| `roles` | Divers (Assassin / jungle) ×1.8 on backline, ×0.7 otherwise; front line scored by nearness; both ignore the focus call |
| `chase` | Chase TTK stop and leash relaxed ×2 on targets <35% HP, ×1.5 with an ally within 4 tiles (leash capped ×1.5) |

80 games per arm per tactic. Full table: `REPORT-table.txt`.

Findings:
- `chase` is the only flag with a clear effect: Hunt kills 6.3 → 7.9, multikills 0.8 → 1.5, quiet 59% → 46%; Hold quiet 26% → 22%.
- `combo` has no measurable effect: follow-up hits and ults into CC unchanged. Allies already converge (focus call + stickiness dominate), and ult timing is gated per kit in `cast_policy.ts`, not by the generic hold rule.
- `roles` moves Hunt backline deaths 39% → 45% but nothing in Hold; deaths stay 5-man (gang deaths ~70%).
- Combined with cadence step 3 (`tf_cadence`): Hold quiet 26% → 18%, the lowest of any arm.
