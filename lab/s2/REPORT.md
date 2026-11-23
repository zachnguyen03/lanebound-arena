# S2 Report — Fight-layer AI (Appendix R #3)

**Branch:** `s2`  
**Commit:** `77db09c` (AI tip; this REPORT is `c1a6d94` or later)  
**Date:** 23 Nov 2026  
**Acceptance:** verifier-owned `tests/acceptance/s2` v2 (sha256 `2fcdc24cc65036767b76acdcdf28a0bfdfbd88969d8363ef4024909bc1edb529`)

## Commands

```bash
npm ci && npm test
npx tsc --noEmit
npm run purity
npm run digest -- --seed 20261122
npm run digest -- --seed 20261123
```

## Results

| Check | Result |
|---|---|
| `npm test` | **PASS — 1165 passed / 6 skipped** |
| acceptance s1 | **960/960** |
| acceptance s2 v2 | **48 passed / 6 skipped** (S3/M6 deferred) |
| `npx tsc --noEmit` | **exit 0** |
| `npm run purity` | **exit 0** |
| Two-process digests (20261122, 20261123) | **byte-identical** |
| `constants_hash` | `69f5b9e615f3e57f458c0dd40875d2cd178cc4ac728da2f9e5f4f51e8ff54fc1` (unchanged from S1) |
| `data_hash` | `af2cbafa03a1cea2485b6118b09232a7c511e682189102e486d3e2cd549a32f2` (unchanged) |

### Digests (defaultEvenConfig, AI on)

```
seed=20261122
digest=0f7456370f500188fa4fddde922d9c55213e792819bb9b8614b370a1c5df2e26

seed=20261123
digest=612148a2e910c47c0cf5793153e3cd4d7023dbebb287caeed1797f883bb89760
```

### Digest before → after (S1 tip → S2 AI-on default)

| | before (S1 `2cdcf26` / lab tip) | after (this S2 tip) |
|---|---|---|
| digest 20261122 | `7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f` | `0f7456370f500188fa4fddde922d9c55213e792819bb9b8614b370a1c5df2e26` |
| digest 20261123 | `f3946e13929209cf9fd179cf20b147b050a6402ab09a83d2bdf6306e3c744cd0` | `612148a2e910c47c0cf5793153e3cd4d7023dbebb287caeed1797f883bb89760` |
| constants_hash | `69f5b9e6…` | unchanged |
| data_hash | `af2cbafa…` | unchanged |

**Reason:** `defaultEvenConfig` enables fight-layer AI. Unit Brain emits first-class `intent` events on change (Appendix R #3 / OQ-S2-7). `intent` is **not** omitted from the G10 digest (only `move`/`pos` are). Quiet-match event logs therefore gain WalkFromPad / Idle / Approach intents and related motion, so digests diverge from S1 while remaining two-process stable. AI-off recovers the S1 digest (`ai_enabled: false` → `7e6516f4…` / `f3946e13…`).

S1 acceptance brawl gold digests are **unchanged** (harness forces `ai_enabled: false`).

## S1 API deviation — Tactics

Frozen S1 (`2cdcf26`) type:

```ts
interface Tactics {
  preset: "hold_the_pit" | "hunt" | "starve";
  aggression: -1 | 0 | 1;
  protect_the_carry: boolean;
  combo_style: "auto" | "aggressive" | "conservative";
}
```

S2 / Appendix R #3 (S2-6) type now in `sim/types.ts`:

```ts
interface Tactics {
  preset: "hold_the_pit" | "hunt" | "starve";
  secondary?: "hold_the_pit" | "hunt" | "starve";
  aggression: -1 | 0 | 1;
  protect_the_carry: boolean;
  combo_style: "auto" | "hold_R";
  focus?: "auto" | "top" | "jungle" | "mid" | "adc" | "support";
}
```

Root `tsc` only passes once the public `Tactics` matches the harness. `aggressive` / `conservative` are retired; `hold_R`, optional `focus`, and optional `secondary` are required names.

## Shotcaller

Highest Decision among living teammates; ties break by slot order Top > Jungle > Mid > ADC > Support (spec L947 / R #3).

## Targeting / Focus (§9.3)

Score product used by `sim/ai/target.ts`:

`value × killability × reach × sticky × call × tactic × ward`

| Factor | Reading |
|---|---|
| value | class VALUE × (1 + 0.4 × missing_hp) — see INV-CLASS-VALUE |
| killability | `1 / (est_ttk + 0.5)` |
| reach | 1.0 if in range or ETA≤1.5 s; else linear falloff (INV-REACH-LINEAR) |
| sticky | 1.25 if current target |
| call | 1.3 / teamwork_slack on L1 focus; 0.85 while peeling |
| tactic | 1.2 for hunt (Marksman/Mage), hold_the_pit (zone occupant), starve (isolated) |
| ward | 1.0 (hard legality ward excludes sanctuary / banished before scoring) |
| coach Focus | slot score ×1.25 (§12 L1352) |

## Secondary tactic (L1344 / L1358)

When the 1 s L1 planner tick has **no** Fight Call, the planner would otherwise idle → `active_tactic = secondary ?? preset` (INV-SECONDARY-IDLE-L1). Fight Call ticks always use primary `preset`.

## Inventions

| Id | Item | Notes |
|---|---|---|
| INV-CLASS-VALUE | ChampClass → value | Marksman 1.3, Mage 1.15, Assassin 1.1, Enchanter 1.05, Fighter 0.95, Tank 0.75. Spec §9.3 names “value” without a numeric table; this is the S2 literal fill. |
| INV-REACH-LINEAR | reach falloff | No `Math.exp` (purity). Linear `max(0.05, 1 − 0.25×(eta−1.5))` past 1.5 s ETA. |
| INV-SECONDARY-IDLE-L1 | secondary trigger | L1 tick with no Fight Call → apply `secondary` if set. Suite does not assert the swap. |
| INV-AI-DEFAULT-ON | `ai_enabled` | `defaultEvenConfig` sets `true`. S1 harness / scripted labs force `false`. |
| INV-INTENT-DIGEST | `intent` events | First-class; included in digest (R #3 OQ-S2-7). |

## Deferred (suite-skipped)

Hold / Hunt / Starve full planners and M6 items — `08-deferred-s3.test.ts` (6 skipped). See `tests/acceptance/s2/DEFERRED.md`.

## Verifier suite

Acceptance under `tests/acceptance/s2/` was not edited after unpack. S1 `run()` / local `runConst` set `ai_enabled: false` so scripted S1 fixtures stay put under AI-default-on.
