# S1 Report — 14 champions + combat tests (M1) — fix round

**Branch:** `s1`  
**Commit:** `a4aff84c9a8e6a64fb0e1451dfa81397785a8f5d`  
**Date:** 23 Nov 2026  
**Regenerate:** `npm run lab:s1` (set `LANEBOUND_COMMIT` in git-archive extracts)

## Commands

```bash
npm ci && npm test
npm run digest -- --seed 20261122
npm run digest -- --seed 20261123
npm run purity
npm run lab:s1
npx tsx apps/lab/mutation-s1.ts
```

## Results

| Check | Result |
|---|---|
| `npm test` | **122 passed** |
| M1 fixtures | **pass** |
| `data_hash` | `82875d4c32712d11116f71eccca0997fcacea006c0997103ebc15603a3d1a06a` (INV-DATA-HASH) |
| Mutation probe | see table below |

### Digests (current gold)

```
seed=20261122
constants_hash=08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb
data_hash=82875d4c32712d11116f71eccca0997fcacea006c0997103ebc15603a3d1a06a
digest=e0c3d7b631b35e13f8420e0fa0711c8e7fb24678413d5568ce097bfc627fffe4

seed=20261123
constants_hash=08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb
data_hash=82875d4c32712d11116f71eccca0997fcacea006c0997103ebc15603a3d1a06a
digest=d3df901fd5e5ed364fcb1bd8353532551a296570460b5b1b384be95da4b9d270
```

### Digest / hashes before → after

| | before (S0 `1caa5eb` / prior S1 dummy) | after (this tip — real champions) |
|---|---|---|
| constants_hash | `08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb` | `08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb` *(unchanged)* |
| data_hash | *(absent)* | `82875d4c32712d11116f71eccca0997fcacea006c0997103ebc15603a3d1a06a` **NEW** |
| digest 20261122 | `07a8be5079bc66d6c5460a9b0ca4044ddada6158658cbf32476d05ab500d083a` | `e0c3d7b631b35e13f8420e0fa0711c8e7fb24678413d5568ce097bfc627fffe4` |
| digest 20261123 | `be36ec904ceb38fcdb2f32c752cda188655fd54b65b8d6ca1442b391783922f3` | `d3df901fd5e5ed364fcb1bd8353532551a296570460b5b1b384be95da4b9d270` |

**Reason:** Default even match now picks real champions (stats from §7 tables). `match_start` includes `data_hash` (canonical kits+defs). No §15 constant changed.

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
| mirren-slow | Mirren W hex slows 35% | hex also slows 35% | 35% | PASS |
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
| Mirren W slow 35→25 in notes+apply | YES | ≥1 test red |
mutation_probe_pass=true


## Kits

brannoch, calder, helvar, huntress, isra, kerrig, maelis, mirren, rhedan, saelo, sedge, tolle, torun, ysol — wired into `simulate()` via lineup picks; abilities cast through `scripted_casts`.

## Constants changed

None. `constants_hash` unchanged.

## New hashes / inventions

| Id | Item | Notes |
|---|---|---|
| INV-DATA-HASH | `data_hash` | SHA-256 of canonical kits + L1/growth/snapshots; on `match_start` next to `constants_hash`. Engineering addition. |
| INV-SEP-STRENGTH | `SEPARATION_STRENGTH` | Still unruled. |
| INV-ARRIVE-R | `SCRIPTED_ARRIVE_R` | Still unruled. |

## Open questions

1. Full projectile geometry for every skillshot (width/pierce/lead) beyond the M1 fixture set is deferred; scripted force_hit covers packet/CC correctness.
2. Attack-reset is set for the duration of a skill cast (blocks autos mid-cast); cleared on cast_end.
