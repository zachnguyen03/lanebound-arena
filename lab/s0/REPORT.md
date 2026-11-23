# S0 Report — Sim core, headless + determinism

**Branch:** `s0`  
**Commit:** branch `s0` — run `git rev-parse HEAD` on the tip used for QA (digests below are the authority).  
**Date:** 23 Nov 2026  

## Commands (PM re-run)

```bash
npm ci && npm test
npm run digest -- --seed 20261122
npm run digest -- --seed 20261123
npm run purity
npm run lab:s0
```

## Results

| Check | Result |
|---|---|
| `npm test` | **11 passed** |
| Forced 4:00 ticks | **2400** |
| L2 tick (time XP only) | **122** (140 XP @ 1.15/tick) |
| Sanctuary shove | **0** `sanctuary_violation`; `sanctuary_clip` logged |
| Twin digest (same seed ×2) | **byte-identical** |
| seed+1 digest | **differs** |
| `npm run purity` | **PURITY OK** |

### Digests (documented seed pair)

```
seed=20261122
constants_hash=55713b35526c584698d4f8fb2068495da98a83c4c86ea118b5498fdce8358204
digest=cf8b9269579c4aae6203813a681a7d44c507493d7fdca4e1d3a7dd912ba39e1b

seed=20261123
constants_hash=55713b35526c584698d4f8fb2068495da98a83c4c86ea118b5498fdce8358204
digest=6860cbdeea1f1baa63d8511143353aee11b759c27d23d6196370c7dfa75c3274
```

## Arena geometry — source of truth

| Concern | Source |
|---|---|
| Pillar tile indices (Layout B four 2×2) | **`layoutB-tiles.json`** → committed as `data/layout-b.json` (matches build-spec §5.1) |
| Sanctuary columns, spawn pads, orb/buff pads | **`layoutB-tiles.json`** / build-spec §5.1 |
| Named centres / body radius / map clamp | **build-spec §5.1** |
| Axis (y=0 = top/north) | **GD ruling G1** |
| Walkability cross-check | `metrics.json` → `B-four-pillars` (not loaded at runtime in S0) |

## Canonical JSON recipe (G10 — frozen here, becomes spec)

1. **UTF-8** text.
2. **Objects:** keys sorted lexicographically with comparator `(a < b ? -1 : a > b ? 1 : 0)`.
3. **No whitespace** (`JSON.stringify` default separators when building; encoder emits compact form).
4. **Numbers:**
   - Integers (`Number.isInteger`): unadorned JSON numbers.
   - Key `t` (sim time): exactly **1** decimal place via `parseFloat(n.toFixed(1))`.
   - **Physical floats** (keys `x`,`y`,`vx`,`vy`,`hp`,`max_hp`,`hp_after`,`raw`,`mitigated`,`shield_absorbed`,`applied`,`amount`,`amp`): exactly **4** decimal places via `parseFloat(n.toFixed(4))`.
   - All other floats: ECMA-262 shortest round-trip (`JSON.stringify(number)`).
5. **Event digest:** events in `seq` order; omit types `move` and `pos`; one canonical object per line; lines joined by `\n` with a **trailing** `\n`; SHA-256 hex (lowercase) of that string.
6. **`constants_hash`:** SHA-256 hex of `canonicalJSON(effectiveConstantsTable)` where the table is the full effective §15 (+ S0 invention keys listed below), keys sorted recursively. Nested `PILLARS` entries are `{name,x0,x1,y0,y1}`.

Implementation: `sim/canonical.ts`, `sim/sha256.ts` (pure, no `node:crypto` in `sim/`).

## Inventions (flagged — not silent rules)

| Id | What | Value | Why |
|---|---|---|---|
| **INV-SEP-RADIUS** | Soft ally separation radius | `0.6` | G6 names 0.6; constant `SEPARATION_RADIUS` |
| **INV-SEP-STRENGTH** | Separation push at dist=0 | `2.0` tiles/s | G6 says “small repulsion” but gives no magnitude |
| **INV-SPAWN-JITTER** | Pad overlap ±y | `0.3` | Build-spec §5.1 names 0.3; exposed as `SPAWN_JITTER_Y` |
| **INV-ARRIVE-R** | Scripted motor arrive radius | `0.15` | Spec silent on scripted-motor arrive threshold |
| **INV-DUMMY-STATS** | S0 dummy marksman | Huntress L1 numbers (§7.1) | M0 allows dummy marksmen with autos only |
| **INV-AUTO-WINDUP** | S0 autos ignore windup | CD = `1/AS`, instant packet | Full windup is M1; S0 only needs the auto hook |
| **INV-SHA256** | Pure JS SHA-256 in `sim/` | — | Keep `sim/` free of `node:` APIs |

## Constants I would change

**None.** All §15 defaults left at authored values. Invention keys above are *additions* required by G6 / G5, not edits to existing defaults.

## Stack choices (sandbox §14)

- TypeScript strict + Vitest + Node CLI (Anh-approved).
- binary64 in core (Anh decision 2) with IEEE-exact ops only.
- Playfield collision from `data/layout-b.json` (no PNG blit in S0).
- No preview URL, no database, no Watch UI (S4).

## GD rulings honoured in S0

G1 axes, G2 time XP in phase 10, G3 clock (tick 0 setup; tick 2400 included), G5 scripted motor + `sanctuary_violation` + optional `pos`, G6 soft separation, G10 canonical recipe, G12 displacement clip path (steering + queue helper).

## Not verified (stated plainly)

- Browser / Safari digest parity (authority is Node CLI).
- Full A* pathfinding around pillars (S0 scripted motor steers straight and clips; A* arrives with AI in S2).
- Orb / buff / zone scoring (S3).
- Real champion kits and Aim vs Reflexes (S1).
- `AUTO_WINDUP = 0.25/AS` timing (stubbed in S0).
- Cross-process digest via two OS processes beyond in-process twin run (lab:s0 twin is same process twice; PM can also run `digest` twice in separate shells).
