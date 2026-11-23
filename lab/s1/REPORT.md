# S1 Report — 14 champions + combat tests (M1) — fix round

**Branch:** `s1`  
**Commit:** generated from code at `8cc54bc109b13f3a55a7aa6c3424ec22788426fa`  
**Date:** 23 Nov 2026  
**Regenerate:** `LANEBOUND_COMMIT=<tip> npm run lab:s1` (report commit itself need not match)

## Commands

```bash
npm ci && npm test
npm run digest -- --seed 20261122
npm run digest -- --seed 20261123
npm run purity
LANEBOUND_COMMIT=<tip> npm run lab:s1
npx tsx apps/lab/mutation-s1.ts
```

## Results

| Check | Result |
|---|---|
| `npm test` | **PASS — 1095 passed** |
| acceptance s1 | **960/960** |
| M1 fixtures | **PASS** |
| `constants_hash` | `69f5b9e615f3e57f458c0dd40875d2cd178cc4ac728da2f9e5f4f51e8ff54fc1` |
| `data_hash` | `af2cbafa03a1cea2485b6118b09232a7c511e682189102e486d3e2cd549a32f2` (INV-DATA-HASH) |
| Mutation probe | see table below |

### Digests (current gold)

```
seed=20261122
constants_hash=69f5b9e615f3e57f458c0dd40875d2cd178cc4ac728da2f9e5f4f51e8ff54fc1
data_hash=af2cbafa03a1cea2485b6118b09232a7c511e682189102e486d3e2cd549a32f2
digest=7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f

seed=20261123
constants_hash=69f5b9e615f3e57f458c0dd40875d2cd178cc4ac728da2f9e5f4f51e8ff54fc1
data_hash=af2cbafa03a1cea2485b6118b09232a7c511e682189102e486d3e2cd549a32f2
digest=f3946e13929209cf9fd179cf20b147b050a6402ab09a83d2bdf6306e3c744cd0
```

### Digest / hashes before → after (L214)

| | before (pre-L214 `419dbf1`) | after (L214 — this code tip) |
|---|---|---|
| constants_hash | `c25f7a1779f6115a2b6f27cd118e57a4a83c6dec20ebec599b7a5430ef4a7364` | `69f5b9e615f3e57f458c0dd40875d2cd178cc4ac728da2f9e5f4f51e8ff54fc1` |
| data_hash | `af2cbafa03a1cea2485b6118b09232a7c511e682189102e486d3e2cd549a32f2` (unchanged) | `af2cbafa03a1cea2485b6118b09232a7c511e682189102e486d3e2cd549a32f2` |
| digest 20261122 | `5c784b9aca72ed2015a249f08245fc1e839529029ffde80ee84013bbc9590fd6` | `7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f` |
| digest 20261123 | `2f6e9d8046542c9ceb19243c3e698e5096ba6579007e79d98623d761602aab0a` | `f3946e13929209cf9fd179cf20b147b050a6402ab09a83d2bdf6306e3c744cd0` |

**Reason:** L214 spawn slots — `SPAWN_JITTER_Y` 0.3 removed, `SPAWN_SLOT_SPACING` 1.0 added (pad centre + role×spacing). `constants_hash` `c25f7a17…` → `69f5b9e6…`; digests follow; S0 + brawl gold re-pinned.

## Fixture coverage

### Helper-level

| Spec # | Spec value | Measured | Tolerance | Pass |
|---|---|---|---|---|
| 5 | L1/L7/L10 snapshots ×14 | all match | display round | PASS |
| 6 | Huntress Q L7 vs 36 PRes = 139.706 | 139.705882 | ±0.02 | PASS |
| 7h | Huntress R absolute base from kits | 335.0000 | 230+1.05*ATK | PASS |
| 8a | Maelis R absolute L7 base | 492.8000 | 350+1.7*POW | PASS |
| 8b | Kerrig R absolute L7 base | 471.6000 | 330+1.4*ATK+0.15*POW | PASS |
| 11h | Tolle W radius/duration from kits | r=0; d=1.8 | 0 / 1.8 | PASS |
| 12h | Saelo R Still Hour r=2.4 | Still Hour r=2.4 | Still Hour / 2.4 | PASS |
| calder | Calder W radius 0.0 | 0 | 0.0 | PASS |
| mirren-slow | Mirren W hex slows 35% | 0.35 | 0.35 | PASS |
| 16 | shield cap 25% | 250 | 250 | PASS |
| 17 | combat heal ×0.75 | 75 | 75 | PASS |
| 18 | DR d,0.70d,0.49d | 2.00,1.40,0.98 | 2,1.4,0.98 | PASS |
| 19 | Lock taper ×0.35 | 0.48999999999999994 | 0.49 | PASS |
| 5.ss | skill_scale | 0.7/1/1.15 | 0.7/1/1.15 | PASS |

### Sim-level (scripted_casts / scripted_skillshots)

| Spec # | Spec value | Measured | Tolerance | Pass |
|---|---|---|---|---|
| 7s | Huntress mark apply+consume via scripted casts | see vitest m1-sim-behavior | events | PASS |
| 9s | Isra R sanctuary clip via cast | see vitest | sanctuary_clip | PASS |
| 10s | Sedge R ally sleep + dispels | see vitest | cc_apply/dispel | PASS |
| 11s | Tolle W banish invuln + r=0 | see vitest | banish | PASS |
| 12s | Saelo R timestop + CD freeze | see vitest | timestop | PASS |
| 13s | Brannoch R petrify stun | see vitest | petrify | PASS |
| 14s | Mirren Kiln +12% / hex end / Break | see vitest | 1.12 | PASS |
| 15s | Kerrig R cast 0.7 + mark gate | see vitest | 0.7 | PASS |
| 19b | Aim 55/85/25% ±2 over 2000 via scripted_skillshots | see vitest | HIT_* | PASS |
| gates | windup cancel / Blind / attack_reset / timestop / assists | see vitest | §6.8–6.10 | PASS |

## Mutation probe

Each single-number / behavior edit must turn ≥1 test red:

| Mutation | Turns red? | Note |
|---|---|---|
| Huntress Q CD 8→9 | YES | ≥1 test red |
| Tolle W banish duration 1.8→1.5 | YES | ≥1 test red |
| Saelo R radius 2.4→2.0 | YES | ≥1 test red |
| Maelis R base 350→340 | YES | ≥1 test red |
| Huntress R base 230→220 | YES | ≥1 test red |
| Kerrig R base 330→320 | YES | ≥1 test red |
| banish skip removed (invuln) | YES | ≥1 test red |
| CC assist credit removed | YES | ≥1 test red |
| heal assist credit removed | YES | ≥1 test red |
| Blind miss disabled | YES | ≥1 test red |
| time-stop auto pause disabled | YES | ≥1 test red |
| Mirren W slow 35→25 | YES | ≥1 test red |
mutation_probe_pass=true


## Kits

brannoch, calder, helvar, huntress, isra, kerrig, maelis, mirren, rhedan, saelo, sedge, tolle, torun, ysol — wired into `simulate()` via lineup picks; abilities cast through `scripted_casts`.

## Constants changed

L214: deleted `SPAWN_JITTER_Y` (was 0.3); added `SPAWN_SLOT_SPACING` 1.0 (tunable 0.8–1.2, hashed). Spawn/respawn y = pad_centre_y + role×spacing (Top −2 … Support +2). Pad centres unchanged from tile-centre ruling. `constants_hash` `c25f7a17…` → `69f5b9e6…`.

## New hashes / inventions

| Id | Item | Notes |
|---|---|---|
| INV-DATA-HASH | `data_hash` | SHA-256 of canonical kits + L1/growth/snapshots; on `match_start` next to `constants_hash`. Engineering addition. |
| INV-SEP-STRENGTH | `SEPARATION_STRENGTH` | Ruled into constants table (Appendix R #2). |
| INV-ARRIVE-R | `SCRIPTED_ARRIVE_R` | Lab-only; out of constants_hash (Appendix R #2). |

## Open questions

1. Full projectile geometry for every skillshot (width/pierce/lead) beyond the M1 fixture set is deferred; scripted force_hit covers packet/CC correctness.
2. Attack-reset is set for the duration of a skill cast (blocks autos mid-cast); cleared on cast_end.
