# S1 Report — 14 champions + combat tests (M1)

**Branch:** `s1`  
**Commit:** `37af68596d5cbcfc27f332fff77a940432745e46`  
**Date:** 23 Nov 2026  
**Regenerate:** `npm run lab:s1`

## Commands

```bash
npm ci && npm test
npm run digest -- --seed 20261122
npm run digest -- --seed 20261123
npm run purity
npm run lab:s1
```

## Results

| Check | Result |
|---|---|
| `npm test` | **104 passed** (see `tests.log`) |
| M1 fixtures 5–19b | **all pass** |
| Twin / gold digests | **unchanged from S0 tip `1caa5eb`** (quiet default match) |
| `npm run purity` | **PURITY OK** |

### Digests (gold — unchanged this milestone)

```
seed=20261122
constants_hash=08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb
digest=07a8be5079bc66d6c5460a9b0ca4044ddada6158658cbf32476d05ab500d083a

seed=20261123
constants_hash=08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb
digest=be36ec904ceb38fcdb2f32c752cda188655fd54b65b8d6ca1442b391783922f3
```

### Digest / constants_hash before → after

| | before (S0 `1caa5eb`) | after (this S1 tip) |
|---|---|---|
| constants_hash | `08a57092…caffb` | `08a57092e523021c6e5ed0ce354b1668bf4f11fe4d3c4f3fa05f5d40052caffb` *(same)* |
| digest 20261122 | `07a8be50…083a` | `07a8be5079bc66d6c5460a9b0ca4044ddada6158658cbf32476d05ab500d083a` *(same)* |
| digest 20261123 | `be36ec90…22f3` | `be36ec904ceb38fcdb2f32c752cda188655fd54b65b8d6ca1442b391783922f3` *(same)* |

**Reason:** S1 adds champion/combat modules and auto gates, but the default quiet even-OVR match still fires no autos (units out of range) and emits the same event bodies. No §15 constant was added or changed.

## Fixture table (M1 5–19b)

| Spec # | Spec value | Measured | Tolerance | Pass |
|---|---|---|---|---|
| 5 | L1/L7/L10 snapshots ×14 | all match | display round / eHP ±0.05 | PASS |
| 5.skill_scale | 0.70/0.90/1.00/1.15 | 0.7/0.9/1/1.15 | exact | PASS |
| 6 | Huntress Q L7 vs 36 PRes = 139.706 | 139.705882 | ±0.02 | PASS |
| 7 | Huntress R mark +35% | 1.350000 | exact 1.35 | PASS |
| 8a | Maelis R 1+0.20*missing | 1.080000 | ±0.02 packet | PASS |
| 8b | Kerrig R 1+0.35*missing; no-mark fizzle | 1.175000; fizzle=true | ±0.02 | PASS |
| 9 | Isra R on enemy pad → 0 + clip | dmg=0; clipped=true | dmg=0 | PASS |
| 10 | sleep break / Ysol strong / Saelo basic | shieldKeep=true; hpBreak=true; basicKeeps=true; strong=true | all true | PASS |
| 11 | Tolle W banish 1.8s r=0 | applied=1.8; r=0 | 1.8 / 0.0 | PASS |
| 12 | Saelo R timestop (caster excluded) | kit R=Still Hour; r=2.4 | Still Hour / 2.4 | PASS |
| 13 | Brannoch petrify 25% DR | 0.7500 | 0.75 | PASS |
| 14 | Mirren Kiln-Cured +12% | 1.1200 | 1.12 | PASS |
| 15 | Kerrig R no-mark fizzle; cast 0.7; commit 2.8 | cast=0.7 | 0.7 | PASS |
| 16 | shield cap 25% max HP | pool=250 | 250 | PASS |
| 17 | combat heal ×0.75 in 3s | in=75; out=100 | 75 / 100 | PASS |
| 18 | DR d, 0.70d, 0.49d | 2.0000, 1.4000, 0.9800 | 2, 1.4, 0.98 | PASS |
| 19 | Lock taper ×0.35 once owed≥7.5 | taper=true; applied=0.48999999999999994 | 0.49 | PASS |
| 19b-55 | Aim 60 vs Reflexes 60 → 55% | rate=54.65%; digest=29ca0a0e96e2… | ±2 pts; identical replay | PASS |
| 19b-85 | Aim 90 vs Reflexes 60 → 85% | rate=84.70%; digest=4458b1cc5f73… | ±2 pts; identical replay | PASS |
| 19b-25 | Aim 60 vs Reflexes 90 → 25% | rate=24.95%; digest=7307990a2bb4… | ±2 pts; identical replay | PASS |
| 19b-formula | hit%=clamp(0.55+0.01*(Aim−Ref),0.25,0.90) | 0.55/0.8500000000000001/0.25000000000000006 | 0.55/0.85/0.25 | PASS |

## Kits

All 14 authored kits present: brannoch, calder, helvar, huntress, isra, kerrig, maelis, mirren, rhedan, saelo, sedge, tolle, torun, ysol.

## Constants changed

None. `constants_hash` unchanged.

## New constants

None added this milestone.

## Inventions (still flagged)

| Id | Constant / rule | Notes |
|---|---|---|
| INV-SEP-STRENGTH | `SEPARATION_STRENGTH` | Unruled soft-separation push (G6). **Keep flagged.** |
| INV-SEP-RADIUS | `SEPARATION_RADIUS` | Soft-separation radius 0.6 (G6). |
| INV-ARRIVE-R | `SCRIPTED_ARRIVE_R` | Scripted-motor arrive radius. **Keep flagged.** |
| INV-SPAWN-JITTER | `SPAWN_JITTER_Y` | Pad spawn y-jitter. |
| INV-DUMMY-STATS | dummy L1 = Huntress | S0 placeholder until lineup picks drive stats (S1 kits available; defaultEvenConfig still uses dummy). |
| INV-SHA256 | pure JS SHA-256 | No `node:crypto` in `sim/`. |
| INV-G10 | canonical JSON recipe | Frozen in S0 report; now spec via G10. |

`AUTO_WINDUP` is **not** an invention (spec §6.8 / §15).

## Open questions

1. Default even match still spawns `champ: "dummy"` with Huntress L1 numbers — wiring picks→kit stats into `defaultEvenConfig` is deferred (would retarget digests; do in a dedicated commit with gold update).
2. Mirren W extract uses `l7_damage: "none"` rather than `l7_formula` in one note — kit record uses damage:`"none"` / hex as the point; no number disagreement.
3. Full skill cast/projectile engine for all 14 kits is fixture-covered for M1 packets/CC; AI targeting of kits is S2.

## Deferred S0 items now in scope

| Item | Status |
|---|---|
| Skill start cancels windup (§6.9) | `cancelAutoWindup` |
| Blind / Disarm / Lock / timestop / attack-reset gates (§6.8) | `canStartAuto` + Blind miss on apply |
| Assists from CC and heals (§6.10) | `assist_log` kinds `cc` / `heal` / `shield` |
