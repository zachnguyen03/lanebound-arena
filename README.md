# lanebound-arena

Lanebound Arena sandbox: deterministic match sim, fight AI, watch and batch tuning.

## S0 — headless sim

```bash
npm ci && npm test
npm run digest -- --seed 20261122
npm run purity
npm run lab:s0
```

See `lab/s0/REPORT.md`.

## S4 — Watch shell (early)

Vite + React + TypeScript + Tailwind + shadcn/ui in `apps/watch`. Static build; no backend. Loads a canonical S0 `.jsonl`, replays it, draws Layout B art.

```bash
npm run gen:watch-sample
npm run watch:dev          # http://127.0.0.1:5173
npm run watch:build && npm run watch:preview
npm run watch:e2e
npm run lab:s4
```

See `lab/s4/REPORT.md`.
