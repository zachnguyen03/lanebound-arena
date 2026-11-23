# S4 Watch — champion art fallbacks

| Champ id (from log) | Asset | Status |
|---|---|---|
| `dummy` | `arena-sandbox/dummy/` (`dummy-2x.png` + `atlas.json`) | **Resolved** — training-dummy body sheet (CD). No longer a fallback. |

The bundled sample and the live even match use the real lineup. Those ten slugs ship under `apps/watch/public/champions/`, so they are not fallbacks. A champ id with no atlas still draws a labelled circle.

**Rule:** if an S1+ log carries real champ ids without a body sheet under `arena-sandbox/`, add each missing id here, draw the labelled placeholder, and list it in the Watch DEV panel.

**Viewer fallback spawn (no `pos`/`move`):** tile centres — blue `(1.5, 7.5)`, red `(22.5, 7.5)`, plus `SPAWN_JITTER_Y = 0.3`. Units still render at sim poses when the log has them. Prop pads use tile centres. Zone centre stays geometric `(12.0, 8.0)`.
