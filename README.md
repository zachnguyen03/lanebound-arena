# lanebound-arena

Lanebound Arena sandbox: deterministic match sim, fight AI, watch and batch tuning.

## S0 (current)

Headless sim core + determinism. No UI.

```bash
npm ci && npm test
npm run digest -- --seed 20261122
npm run purity
npm run lab:s0
```

See `lab/s0/REPORT.md` for digests, the canonical JSON recipe, and inventions.
