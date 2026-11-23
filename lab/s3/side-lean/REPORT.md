# S3 side lean — investigate only (no fix)

**Tip measured:** `b25a000` lineage (this commit).  
**Preset:** `evenOvrConfig(seed, "hold_the_pit")`, `forced_clock_end: false`, AI on.  
**Seeds:** 20 = `{20261122, 20261123, 5, 10, 18, 1..4, 6..9, 11..17}`.

## Verdict

The **18/20 red win rate is primarily kit asymmetry**, not a pure map/side bug.

| Experiment | Blue wins | Red wins |
|---|---:|---:|
| Default even-OVR kits | 2 | **18** |
| **Swap kits** (blue↔red lineups) | **17** | 3 |
| Identical **blue** kits both sides | 11 | 9 |
| Identical **red** kits both sides | 3 | 17 |

Swapping lineups nearly **inverts** the lean (18–2 → 17–3). That is the kit effect.

Identical blue kits are roughly even (11–9). Identical red kits still lean red (3–17) — a residual side×kit interaction, not enough to explain the default 18/20 on its own.

Raw table: `kit-swap-20.txt`.

## Default lineups (the kit gap)

```85:87:sim/simulate.ts
const DEFAULT_BLUE_PICKS = ["brannoch", "sedge", "kerrig", "huntress", "ysol"];
const DEFAULT_RED_PICKS = ["rhedan", "tolle", "helvar", "maelis", "saelo"];
```

Wired into `defaultEvenConfig` / `evenOvrConfig` at `sim/simulate.ts:117–125` and `sim/match_config.ts` (even-OVR wrapper).

L1 base MS examples (spawn→zone dx = 10.5): blue mid `kerrig` ms 3.5 (eta ≈ 3.0 s); red mid `helvar` ms 3.15 (eta ≈ 3.33 s). Red still captures first on the 0–10 seeds — the lean is combat/zone outcome after contact, not “red walks in first.”

## Canonical 0–10 @ 77.2 s (seeds 22, 23, 5, 10, 18)

Same shape on each of those five:

| t | Event | Score |
|---|---|---|
| 5.3 | `zone_capture` team=red | — |
| ~15.4 | `takedown_score` red | 1 |
| 17.2 | `zone_tick` red | 2 |
| ~27.8 | `takedown_score` red | 3 |
| 29.2 | `zone_tick` red | 4 |
| ~39.4 | `takedown_score` red | 5 |
| 41.2 | `zone_tick` red | 6 |
| ~52.5 | `takedown_score` red | 7 |
| 53.2 | `zone_tick` red | 8 |
| 65.2 | `zone_tick` red | 9 |
| 77.2 | `zone_tick` red + `match_end` `first_to_10` | 10 |

= **1 capture + 4 takedowns + 6 zone ticks**. `ZONE_CAPTURE_S=3`, `ZONE_TICK_S=12` (`sim/constants.ts`).

After kit swap, seed 20261123 becomes **blue 10–0 @ 77.2** (mirror), and seed 20261122 becomes **blue 10–1 @ 74.0**.

## Side asymmetries found (file:line) — residual, not the main cause

Documented because they exist; kit swap already shows they are secondary under default even-OVR.

| Site | What |
|---|---|
| `sim/simulate.ts:85–87` | **Different default picks** per side (primary cause). |
| `sim/simulate.ts:239–249` | Units built `blue` then `red`; blue gets `index` 0–4, red 5–9. |
| `sim/combat.ts:278–281` | Equal-distance auto target tie → lower `index` (blue). |
| `sim/arena.ts:254–257` | Capture race: blue progress checked before red. |
| `sim/arena.ts:303–310` | Claim denier tie → lower `index` (blue). |
| `sim/simulate.ts:923–924` | Assist sort by `index` (blue first). |
| `sim/simulate.ts:1156–1157` | Bo1 coin: `flip < 0.5 ? "blue" : "red"` (fair; unused on these first_to_10 ends). |
| `sim/constants.ts:136–141` | Pads mirrored (`BLUE_SPAWN` 1.5 / `RED_SPAWN` 22.5), zone centre 12 — geometrically symmetric. |
| `sim/ai/tick.ts:191` / `:290` / `:343` | L1 / peel / brain iterate `["blue","red"]` — blue acts first each tick. |

Blue-favoring tie-breaks make the residual **identical-red-kits → 17 red** more surprising (not explained by index alone). Likely kit-skill / RNG interaction with “who acts first,” not a scoring bug. **Not fixed here.**

## Not done

No sim changes. No kit rebalance. Investigation only, as requested.
