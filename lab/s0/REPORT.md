# S0 Report — Sim core, headless + determinism

**Branch:** `s0`  
**Commit:** branch `s0` tip — run `git rev-parse HEAD` for the SHA used in QA. Digests below are the authority.  
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
| `npm test` | **17 passed** |
| Forced 4:00 ticks | **2400** |
| L2 tick (time XP only) | **122** (140 XP @ 1.15/tick) |
| Sanctuary shove | **0** `sanctuary_violation`; `sanctuary_clip` logged |
| Twin digest (in-process ×2) | **byte-identical** |
| **Two-process** digest (M0.1) | **byte-identical** |
| seed+1 digest | **differs** |
| Gold-hash regression | **pinned** (see below) |
| G2 death-tick XP | **pass** |
| AUTO_WINDUP cadence | **pass** |
| `npm run purity` | **PURITY OK** (incl. tan/atan/Intl/setTimeout/setInterval) |

### Digests (current gold — after AUTO_WINDUP)

```
seed=20261122
constants_hash=08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb
digest=07a8be5079bc66d6c5460a9b0ca4044ddada6158658cbf32476d05ab500d083a

seed=20261123
constants_hash=08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb
digest=be36ec904ceb38fcdb2f32c752cda188655fd54b65b8d6ca1442b391783922f3
```

### Digest / constants_hash before → after

**1. Initial S0 ship (`53dcef8`):**

| | value |
|---|---|
| constants_hash | `55713b35526c584698d4f8fb2068495da98a83c4c86ea118b5498fdce8358204` |
| digest 20261122 | `cf8b9269579c4aae6203813a681a7d44c507493d7fdca4e1d3a7dd912ba39e1b` |
| digest 20261123 | `6860cbdeea1f1baa63d8511143353aee11b759c27d23d6196370c7dfa75c3274` |

**2. After G2 phase-10 XP order** (kill/assist → time → level-ups; `constants_hash` unchanged):

| | before | after |
|---|---|---|
| constants_hash | `55713b35…8358204` | *(same)* |
| digest 20261122 | `cf8b9269…ba39e1b` | `2202014e…adabe00` |
| digest 20261123 | `6860cbde…75c3274` | `d9d438aa…beac7f` |

**3. After AUTO_WINDUP added to constants table** (spec §15; also changes `match_start.constants_hash` → digest):

| | before | after |
|---|---|---|
| constants_hash | `55713b35526c584698d4f8fb2068495da98a83c4c86ea118b5498fdce8358204` | `08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb` |
| digest 20261122 | `2202014ebe26f2667b1cc23d9bbd55fa150d592a32741d95721d733ecadabe00` | `07a8be5079bc66d6c5460a9b0ca4044ddada6158658cbf32476d05ab500d083a` |
| digest 20261123 | `d9d438aade560fabebcb3cb0f1c1afa35c91e672b1279319cf83e8a787beac7f` | `be36ec904ceb38fcdb2f32c752cda188655fd54b65b8d6ca1442b391783922f3` |

Reason for (3): `AUTO_WINDUP: 0.25` entered the effective constants table. Default quiet matches still fire no autos (out of range), so event bodies beyond `match_start.constants_hash` are unchanged in shape; the hash change alone retargets the digest.

## Constants changed

| Constant | Before | After | Reason |
|---|---|---|---|
| `AUTO_WINDUP` | *(absent — instant autos, INV-AUTO-WINDUP)* | **`0.25`** (windup_s = `AUTO_WINDUP / AS`) | Spec §6.8 / §6.9 / §15; was incorrectly stubbed |

No other §15 default was edited.

## Arena geometry — source of truth

| Concern | Source |
|---|---|
| Pillar tile indices (Layout B four 2×2) | **`layoutB-tiles.json`** → `data/layout-b.json` |
| Sanctuary columns, spawn pads, orb/buff pads | **`layoutB-tiles.json`** / build-spec §5.1 |
| Named centres / body radius / map clamp | **build-spec §5.1** |
| Axis (y=0 = top/north) | **GD ruling G1** |

## Canonical JSON recipe (G10 — frozen, becomes spec)

1. **UTF-8** text.
2. **Objects:** keys sorted lexicographically `(a < b ? -1 : a > b ? 1 : 0)`.
3. **No whitespace.**
4. **Numbers:** integers unadorned; `t` → 1 dp; physical floats (`x`,`y`,`vx`,`vy`,`hp`,`max_hp`,`hp_after`,`raw`,`mitigated`,`shield_absorbed`,`applied`,`amount`,`amp`) → 4 dp; other floats → shortest round-trip.
5. **Event digest:** `seq` order; omit `move`/`pos`; one object per line; `\n`-joined with trailing `\n`; SHA-256 hex.
6. **`constants_hash`:** SHA-256 of canonical JSON of the effective constants table (incl. `AUTO_WINDUP` and S0 invention keys).

## Inventions (flagged)

| Id | What | Value | Why |
|---|---|---|---|
| **INV-SEP-RADIUS** | Soft ally separation radius | `0.6` | G6 |
| **INV-SEP-STRENGTH** | Separation push at dist=0 | `2.0` tiles/s | G6 silent on magnitude |
| **INV-SPAWN-JITTER** | Pad overlap ±y | `0.3` | §5.1 |
| **INV-ARRIVE-R** | Scripted motor arrive radius | `0.15` | Spec silent |
| **INV-DUMMY-STATS** | S0 dummy marksman | Huntress L1 (§7.1) | M0 allows dummies |
| **INV-SHA256** | Pure JS SHA-256 in `sim/` | — | No `node:` in `sim/` |

~~INV-AUTO-WINDUP~~ **removed** — real `AUTO_WINDUP` implemented.

## Purity

`npm run purity` greps `sim/` for: `Math.random`, `Date.now`, `performance.now`, `new Date`, `Math.sin|cos|tan|atan|atan2|exp|log|pow`, `Intl`, `setTimeout`, `setInterval`.

`mergeConstants` sorts `Object.keys(overrides)` before apply so iteration order is explicit (values are independent; order cannot affect results, but we do not rely on engine key order).

## Not verified

- Browser / Safari digest parity (Node CLI is authority).
- Full A* pathfinding (straight steer + clip in S0).
- Orb / buff / zone scoring (S3).
- Real champion kits / Aim vs Reflexes (S1).
