# S4 Report — Watch viewer shell (layout fix + dummy body)

**Branch:** `cursor/s4-watch-f8c1`  
**Base:** `s0` @ `1caa5eb`  
**Tip commit:** `774cfc0100f0d0a02f2978e40e88748bf7e93e3e`  
**Layout tip verified independently:** `c6de901` (HUD rects ≤1 px, scale 1.0, bbox clean)  
**Dummy tip verified independently:** `fc1697a`  
**Date:** 23 Nov 2026  

Desktop-only Watch shell. Layout follows `hud-layout.json` / `hud-spec.md` (CD binding). Training-dummy body sheet from CD swapped in for labelled placeholders. No edits under `sim/`, `tests/`, or `data/`.

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
| `npm test` | **typecheck** (root + watch) + **32** vitest |
| `npx tsc --noEmit` | **PASS** (root excludes `apps/watch`) |
| `npx tsc -p apps/watch` | **PASS** |
| Canvas scale @1920 / @1280×720 / @1280×800 | **1.0** (intrinsic CSS == buffer; see `canvas-scale.txt`) |
| Drawer @1920 (push) | Flex column; stage reflows to 1600 px (112 rails, map 1:1, no translateX); rails + HUD hittable; 8× works |
| Drawer @1280 (modal) | Centred modal over dim (rails/transport hittable); focus trap; Close / Escape |
| 1280×800 utilities under HUD | **PASS** — spacer; loader below the fold |
| Takedown log (quiet S0) | **No takedowns yet** (no level_up filler) |
| Takedown log (handmade deaths) | `BLUE scores · 1–0` / death rows; see `watch-takedown-log-crop.png` |
| Cold load @1280×720 | Clean console; no 404 (`cold-load-console.txt`) — was favicon.ico |
| Sample digest | `07a8be5079bc66d6c5460a9b0ca4044ddada6158658cbf32476d05ab500d083a` |
| Determinism guard | Load + scrub leaves digest unchanged |
| Dummy art | Byte-identical to CD `arena-sandbox-dummy.tar.gz` (sha256 `1fa95a19…`) |

## Layout (this pass)

- **1080:** stage 1920×1080; rails 200 px; map **1056×580** 1:1, frame sized to map and centred in the playfield slot; takedown feed in right map margin `[1496,194,216,136]`; dock zone / pickups / fight call / watch transport; card-toast slot reserved (no dashed outline until a toast shows).
- **720:** stage 1280×720; rails **112 px**; map **1056×520** 1:1 (plinth crop); takedown feed in dock; same dock family.
- **1280×800:** 720 HUD + clear under-HUD spacer; utilities (loader / DEV) fully below the fold.
- **Below 1280×720:** desktop notice + horizontal scroll; no stacked mobile layout.
- **Event log @1080:** flex column drawer; stage rebuilt to 1600×1080 (112 px rails, map 1:1) and centred — no transform.
- **Event log @720:** centred **modal** over dimmed stage (dim is non-blocking so rails/transport stay hittable); focus trap; Close / Escape.
- Event log labels are human-readable (`Level up`, `Hide XP gains`) — no snake_case in the UI.
- Transport speeds: **0.5 / 1 / 2 / 4 / 8**.
- Fallback spawns at **tile centres** `(1.5,7.5)` / `(22.5,7.5)` (GD). Props at tile centres. Units follow log poses when present.

## Dummy body

- Atlas `animations[name][variant]`; names `idle` / `move` (`walk` alias) / `hit` / `death`; variants `blue-right` / `blue-left` / `red-right` / `red-left`.
- 18×24 cells, anchor (9,23); 2× sheet doubles rects/anchor → (18,46). Death holds last frame.
- Team → colour; facing from movement (held while idle); idle/move from velocity; hit on damage; death on death event.
- Integer nearest-neighbour blit at `world_px - anchor`. `dummy` removed from fallbacks panel.

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
- Dummy: `watch-1920-mid-dummy.png`, `watch-1280-mid-dummy.png`, `watch-dummy-map-crop.png`
- Drawer open: `watch-1920x1080-drawer.png`, `watch-1280x720-drawer.png`, `watch-1280x800-drawer.png`
- Takedown proof: `watch-1920-takedown-proof.png`, `watch-takedown-log-crop.png`
- Cold load: `cold-load-console.txt`

## Fallbacks / TODOs

See `fallbacks.md`, `unrendered.md`. No open champ-id fallbacks for the bundled S0 sample.

## Inventions (flagged)

| Item | Notes |
|---|---|
| Austere dock panels | Zone/pickups/fight call are labelled chrome until those events render; no invented VFX. |
| Kill feed | Only `death` / `takedown_score` (killer → victim + assists; `BLUE scores · 1–0`). Empty state: “No takedowns yet”. Level-ups stay in the drawer. |

## Open questions (parked)

Pad centres ruled by GD (tile centre). Dummy sheet delivered. No further CD questions for this round.
