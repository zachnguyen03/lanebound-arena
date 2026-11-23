# S4 Report — Watch viewer shell (early)

**Branch:** `s4-watch`  
**Base:** `s0` @ `1caa5eb`  
**Commit:** run `git rev-parse HEAD` on this branch for the SHA used in QA.  
**Date:** 23 Nov 2026  

**Scope of this pass:** renderer shell + transport + event log + HUD chrome against S0 canonical logs. No sim/, tests/, or data/champions edits. Parallel with S1.

## Commands (PM re-run)

```bash
npm ci
npm test
npm run gen:watch-sample
npm run watch:build
npm run watch:preview   # or: npx vite preview --config apps/watch/vite.config.ts --host 127.0.0.1 --port 4173
npm run watch:e2e
npm run lab:s4
```

## Results

| Check | Result |
|---|---|
| `npm test` | **20 passed** (17 S0 + 3 Watch determinism/spawn) |
| Sample digest (seed 20261122) | `07a8be5079bc66d6c5460a9b0ca4044ddada6158658cbf32476d05ab500d083a` (matches S0 gold) |
| Determinism guard | Loading + scrubbing the log leaves digest **unchanged** |
| Replay purity | `apps/watch/src/lib/replay.ts` does not import/call `simulate` |
| Playwright bbox @390 / @1280 | **PASS** — `lab/s4/bbox-check.txt` |
| Screenshots | `lab/s4/watch-{1920,1280,390}.png` (+ `-viewport.png`) |
| Art sha256 | Verified against `arena-sandbox-art.sha256s` before commit |

## What renders

- Layout B terrain @2× (1056×580), sanctuary wash/threshold, zone **neutral** + centre mark, `orb.down` / `buff.down` pads, pillars with y-sort (`sort_y_px` 128 / 448).
- Units from log-derived state: spawn placement (S0 pads + jitter) or `pos`/`move` when present; labelled placeholders for missing champ art; floating HP; levels from `level_up`.
- HUD chrome: clock, scores, team rails (HP / level), Watch transport (play / pause / step / scrub / 0.5×–4×).
- Event log side panel: filterable, click → jump to tick.
- Empty + loading states; file picker + drag-drop; bundled sample `apps/watch/public/samples/seed-20261122.jsonl`.

## Fallbacks

See `lab/s4/fallbacks.md`. Champ id `dummy` → labelled placeholder (no CD dummy body in arena-sandbox P0). Also shown in the Watch DEV panel.

## Unrendered (TODO, no invented visuals)

See `lab/s4/unrendered.md`: casts, hits, CC plates, zone ownership, orb/buff up states, scoring popups, fight call.

## Inventions (flagged)

| Item | Notes |
|---|---|
| Viewer spawn without `pos` | Quiet S0 logs omit `pos`. Watch places units at S0 spawn + `SPAWN_JITTER_Y` until `pos`/`move` appear. Does not call the sim; digest unchanged. |
| Austere HTML HUD | CD composed HUD PNGs are shipped under `public/arena-sandbox/hud/` for reference; interactive chrome is React/Tailwind per tokens (field `#0B0E14`, Barlow). Score/clock/HP/levels are live from the log. |
| Speed cap 4× | Shell exposes 0.5 / 1 / 2 / 4 (spec also mentions 8× later). |

## Open questions for Chief Designer

1. **Pad centres vs sim integers** — art pads at tile centre (+0.5); S0 sim spawns at `(1,7)` / `(22,7)`. Confirm which the Watch should prefer when overlaying props vs units.
2. **720 rails at 112 px** — confirm vs original HUD C 160 px (map is 1056 wide).
3. **Dummy body sheet** — should CD ship a generic dummy (36×48 @2×) for S0/S1 logs, or keep labelled placeholders until real champ atlases are wired?
4. **Takedown log home** — right map margin @1080 vs dock @720.
5. **Y axis** — Watch treats sim `y` as screen-down (G1); confirm no flip.

## Artefacts

```
lab/s4/
  REPORT.md
  digest-20261122.txt
  vitest.log
  bbox-check.txt
  fallbacks.md
  unrendered.md
  watch-1920.png / watch-1920-viewport.png
  watch-1280.png / watch-1280-viewport.png
  watch-390.png / watch-390-viewport.png
```
