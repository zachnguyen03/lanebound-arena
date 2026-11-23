# S3 — QA S2 notes + R5-12 (M2-23 tactic side dropped)

**S2 tip cited:** `7685c53` (PR #5).  
**Scope (Anh):** drop tactic / M2-23 Hunt-inert work; no `lab/s3/m2-23.mjs`. Keep R5-12 and QA S2 notes **1, 3, 4, 5, 6**. Focus match implementation (scoring / zone / orbs / full match with `forced_clock_end: false`).

## Gates

| Gate | Result |
|---|---|
| `npm run purity` | 0 |
| `tsc --noEmit` | 0 |
| `npm test` | **1368 passed / 10 skipped** |
| S1 v4 | **960 / 960** |
| S2 v6 | **76 passed / 10 skipped** (86 total) |
| S3 v4 | **152 / 152** |
| AI-off = S1 gold | both seeds |

## Digests (defaultEvenConfig, MATCH_T clock)

| Seed | AI-off (= S1 gold) | AI-on (after §9.2 dwell) |
|---|---|---|
| 20261122 | `7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f` | `fccc7096e248c64a3182bfa244eaf7f16630525fcd5960c1abf7ef9215f18e48` |
| 20261123 | `f3946e13929209cf9fd179cf20b147b050a6402ab09a83d2bdf6306e3c744cd0` | `68e5fcfbdfa65f73272d8c8de9ee89c9da27545ba690b650ab65449d14083d3b` |

See `digest-20261122.txt`, `digest-20261123.txt`.

## Full match (`evenOvrConfig`, `forced_clock_end: false`)

| Seed | Score | End reason | Duration (s) |
|---|---|---|---|
| 20261122 | 0–10 (red) | `first_to_10` | 77.2 |
| 20261123 | 0–10 (red) | `first_to_10` | 77.2 |

See `full-match-*.txt`.

## QA S2 notes — proof

### 1. Intent oscillation (§9.2 L1115)

**Before (QA on tip, seed 20261123):** 3298 of 4459 intent flips were 0.1 s apart (Retreat↔HoldZone / HoldZone↔Idle).  
**Fix:** 1 s `ai_no_trickle_until` dwell at the decision point (`sim/ai/tick.ts` + sanctuary hold in `brain.ts`); arrival hysteresis via `ai_at_planner_wp` in `planner.ts`. Not intent-emit dedupe.  
**After:**

| Seed | intent events | flips &lt; 0.1 s | Retreat→HoldZone &lt; 1 s |
|---|---|---|---|
| 20261122 | 1686 | 316 | **0** |
| 20261123 | 1680 | 278 | **0** |

Test: `tests/s2-intent-dwell.test.ts` (both seeds).

### 3. Extra S2 behaviour pins

See `tests/s2-mutation-survivors.test.ts`, `tests/s2-r25-follow-focus.test.ts`,
and `tests/s2-survivor-behaviour.test.ts` (names and behaviours listed in
`SURVIVORS-R25.md`).

### 4. Vacuous holders slice + one rim function

`sim/ai/planner.ts`: `holders = ranked.slice(0, 2)` (was `Math.max(2, length)`). Rim geometry lives in one `zoneRim()` helper used by Hold backliners and Starve pre-orb.

### 5. DEFERRED 0/1200 + REPORT sha

`tests/acceptance/s2/DEFERRED.md` peel row records that tip **`7685c53`** measured **0 of 1200** even-OVR dives with `peeler_perceived === true`. This REPORT cites that sha.

### 6. `isLabParked`

Documented in `lol-manager/eng/sandbox-plan-v1.md` §8.3.1 as a **lab convention** (`auto_next_start_t ≥ 900`), not a build-spec line. Implementation: `isLabParked` in `sim/ai/planner.ts`.

## R5-12

- `sim/match_config.ts`: `loadMatchConfig` refuses a missing `forced_clock_end`; `evenOvrConfig` / `ARENA_PRESETS` set `forced_clock_end: false`.
- `defaultEvenConfig` keeps `forced_clock_end: true` (S1 gold).
- Test: `tests/s3-r5-12-config.test.ts`.

## Explicitly not done (Anh)

- No M2-23 TRACE / Hunt-inert fix / `lab/s3/m2-23.mjs`.
- No tactic-gate tuning for Hold > Hunt > Starve zone-time.
