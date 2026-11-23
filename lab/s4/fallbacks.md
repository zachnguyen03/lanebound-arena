# S4 Watch — champion art fallbacks

| Champ id (from log) | Asset expected | Fallback used | Notes |
|---|---|---|---|
| `dummy` | CD body sheet (18×24 → 36×48 @2×) under a champion atlas | Labelled placeholder rectangle + team ring + “DUMMY” / `L{n}` text | No dummy body exists in `arena-sandbox` P0 art. Logged in the Watch DEV panel. |

**Rule:** if an S1+ log carries real champ ids and those atlases are not yet wired into Watch, add each missing id here and keep drawing the labelled placeholder. Never invent kit art.

**Viewer spawn (when log has no `pos`/`move`):** units are placed at S0 pads `blue (1,7)` / `red (22,7)` with `SPAWN_JITTER_Y = 0.3` matching `sim/constants.ts`. This is viewer-side derivation only; it does not call the sim.
