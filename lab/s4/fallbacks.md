# S4 Watch — champion art fallbacks

| Champ id (from log) | Asset expected | Fallback used | Notes |
|---|---|---|---|
| `dummy` | CD dummy sheet later at `arena-sandbox/dummy/` (18×24 cell, anchor (9,23), blue/red) | Labelled placeholder rectangle + team ring + “DUMMY” / `L{n}` | Keep until CD delivers the sheet. Logged in the Watch DEV panel. |

**Rule:** missing champ ids → labelled placeholder + entry here. Never invent kit art.

**Viewer fallback spawn (no `pos`/`move` in log):** tile centres per GD ruling — blue `(1.5, 7.5)`, red `(22.5, 7.5)`, plus `SPAWN_JITTER_Y = 0.3`. Units still render at sim poses when the log has them. Prop pads use tile centres (`(tx+0.5)*44`, `(ty+0.5)*32`). Zone centre stays geometric `(12.0, 8.0)`.
