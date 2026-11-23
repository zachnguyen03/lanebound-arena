# S4 Report — Watch viewer shell (layout fix)

**Branch:** `cursor/s4-watch-f8c1`  
**Base:** `s0` @ `1caa5eb`  
**Tip commit:** `485ac75ad7f574b14c16a263ff6a0b2d60af3da5` (`485ac75`); layout fix `f19344c`  
**Date:** 23 Nov 2026  

Desktop-only Watch shell. Layout follows `hud-layout.json` / `hud-spec.md` (CD binding). No edits under `sim/`, `tests/`, or `data/`.

## Commands (PM re-run)

```bash
npm ci
npm test
npm run watch:build
npm run watch:preview
npm run watch:e2e
npm run lab:s4
```

## Results

| Check | Result |
|---|---|
| `npm test` | **26 passed** |
| Canvas scale @1920 / @1280×720 / @1280×800 | **1.0** (intrinsic CSS == buffer; see `canvas-scale.txt`) |
| Playwright bbox @1920 / @1280 (drawer closed + open) | **PASS** — `bbox-check.txt` |
| Sample digest | `07a8be5079bc66d6c5460a9b0ca4044ddada6158658cbf32476d05ab500d083a` |
| Determinism guard | Load + scrub leaves digest unchanged |

## Layout (this pass)

- **1080:** stage 1920×1080; rails 200 px; map **1056×580** 1:1, frame sized to map and centred in the playfield slot; takedown feed in right map margin `[1496,194,216,136]`; dock zone / pickups / fight call / watch transport; empty card-toast slot.
- **720:** stage 1280×720; rails **112 px**; map **1056×520** 1:1 (plinth crop); takedown feed in dock; same dock family.
- **Below 1280×720:** desktop notice + horizontal scroll; no stacked mobile layout.
- **Event log:** collapsible right-edge **drawer** (closed by default); flex push so it never covers controls (bbox-proven).
- Transport speeds: **0.5 / 1 / 2 / 4 / 8**.
- Fallback spawns at **tile centres** `(1.5,7.5)` / `(22.5,7.5)` (GD). Props at tile centres. Units follow log poses when present.

## Canvas scale factors (measured)

| Viewport | Intrinsic | CSS | scaleX | scaleY |
|---|---|---|---|---|
| 1920×1080 | 1056×580 | 1056×580 | **1** | **1** |
| 1280×720 | 1056×520 | 1056×520 | **1** | **1** |
| 1280×800 | 1056×520 | 1056×520 | **1** | **1** |

## Screenshots

- `watch-1920-t0.png`, `watch-1920-mid.png`, `watch-1920-drawer.png`
- `watch-1280-t0.png`, `watch-1280-mid.png`
- `watch-1280x800-mid.png`

## Fallbacks / TODOs

See `fallbacks.md`, `unrendered.md`.

## Inventions (flagged)

| Item | Notes |
|---|---|
| Austere dock panels | Zone/pickups/fight call are labelled chrome until those events render; no invented VFX. |
| Kill feed content | Shows deaths when present; otherwise recent interesting events (e.g. level_up) so the slot is not empty on quiet S0 logs. |

## Open questions (parked)

CD confirmed 112 px rails, dummy sheet later, log homes. Pad centres ruled by GD (tile centre). No further CD questions for this round.
