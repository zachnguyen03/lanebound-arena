# S4 verify 5 — melee attack clip in the Watch

**Code tip:** `829f769`

**Preset:** S1 AI-on. Even lineup, `hold_the_pit`, AI on, `forced_clock_end: true`. The Watch builds this in `clockAiConfig` (note `Clock match`) and starts it from **Start clock AI 20261122**. The digest matches `defaultEvenConfig` with those two flags. No digest file was rewritten.

**Why this preset:** starve does land melee autos (20 on seed 20261122, 22 on 20261123, all Rhedan and Tolle), but those units stand on the same tile as their target, so the swing is hidden. S1 AI-on is the readable fight. Counts are 102 and 91 melee-source `hit` events.

**Seed shown:** `20261122`. Seed `20261123` is counted below and is not the still.

**Melee** means `l1.range <= 2` in `data/champions/defs.ts`. Helvar is a Mage at range 5.8 and is not counted.

| Champion | Class | Range | 20261122 source hits | 20261123 source hits |
|---|---|---|---|---|
| Brannoch | Tank | 1.5 | 17 | 30 |
| Kerrig | Assassin | 1.5 | 28 | 18 |
| Rhedan | Fighter | 1.45 | 30 | 17 |
| Tolle | Tank | 1.5 | 27 | 26 |

Attack clip for Kerrig (and the other three) is 6 frames at 83 ms, so a `hit` at tick T keeps the attack pose on ticks T through T+4. Tick T+2 is frame 2, mid-swing.

## Still

Kerrig (`blue:mid`) autos Tolle at tick 2109. The still is tick **2111** (frame 2). The left rail reads KERRIG. The transport reads `2111/2400`.

- `clock-ai-20261122-kerrig-tick2111-1280.png` — 1280×720
- `clock-ai-20261122-kerrig-tick2111-1920.png` — 1920×1080

## Recording

`clock-ai-20261122-kerrig-exchange.webm` scrubs ticks 2104–2126 at 1280×720. Kerrig’s arm extends to the right and comes back. The same window also has Brannoch at 2108 and 2122, Tolle at 2108 and 2122, and Rhedan at 2107 and 2119.

## Hit ticks (source is the melee champion)

Seed 20261122:

- Brannoch: 1399, 1413, 1427, 1759, 1773, 1787, 1801, 2010, 2024, 2038, 2052, 2066, 2080, 2094, 2108, 2122, 2136
- Kerrig: 410, 509, 520, 531, 542, 553, 564, 575, 586, 597, 608, 619, 630, 641, 652, 1398, 1408, 1418, 1428, 2109, 2119, 2129, 2139, 2149, 2159, 2169, 2179, 2189
- Rhedan: 1363, 1375, 1387, 1399, 1411, 1423, 1764, 1776, 1788, 1800, 1922, 1934, 1946, 1958, 2011, 2023, 2035, 2047, 2059, 2071, 2083, 2095, 2107, 2119, 2131, 2143, 2155, 2167, 2179, 2191
- Tolle: 518, 533, 548, 563, 578, 593, 608, 623, 638, 653, 1759, 1773, 1787, 1801, 1921, 1935, 1949, 1963, 2010, 2024, 2038, 2052, 2066, 2080, 2094, 2108, 2122

Seed 20261123:

- Brannoch: 1610, 1624, 1638, 1652, 1720, 1742, 1756, 1770, 1784, 1798, 1812, 1826, 1846, 1860, 1874, 1888, 1902, 1922, 1936, 2164, 2178, 2192, 2206, 2220, 2234, 2248, 2262, 2276, 2290, 2304
- Kerrig: 410, 421, 1355, 1365, 1762, 1772, 1782, 1985, 1995, 2005, 2015, 2025, 2035, 2045, 2370, 2380, 2390, 2400
- Rhedan: 1355, 1367, 1719, 1933, 1995, 2007, 2019, 2031, 2043, 2163, 2175, 2187, 2199, 2211, 2223, 2235, 2247
- Tolle: 1619, 1633, 1647, 1661, 1742, 1756, 1770, 1784, 1798, 1812, 1826, 2047, 2167, 2181, 2195, 2209, 2223, 2237, 2251, 2265, 2279, 2293, 2307, 2371, 2385, 2399

## Deferred

Anh deferred the melee AI fix and the ability-cast telegraph to the full game. The even default (`hold_the_pit`, `forced_clock_end: false`) still has Brannoch, Kerrig, and Rhedan idle of attacks. W4 telegraphs stay undrawn. `sim/` and `tests/acceptance/**` were not edited.

## Gates

Preview for the stills used port 4174 after `ss -ltnp` showed 4173 and 4174 free. `npm run watch:e2e` then used its own port 4173.

| Command | Exit |
|---|---|
| `npm run purity` | 0 |
| `npx tsc --noEmit` | 0 |
| `npm test` | 0 (1404 passed, 11 skipped) |
| `npm run watch:e2e` | 0 (29 passed) |
