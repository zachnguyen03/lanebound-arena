# S3 side lean — tick-order measurement (no sim fix)

**Status:** Anh deferred the side-fairness SIM FIX. This note is **measurement only**.
**Committed sim tick order was not changed.** Temporary reverse patches were applied locally, measured, then restored.

**Context:** `REPORT.md` (kit asymmetry is the main 18/20 lean; residual on identical-red kits) and `kit-swap-20.txt` (n=20).
**Preset:** `evenOvrConfig(seed, "hold_the_pit")`, `forced_clock_end: false`, AI on.
**Seeds (n=42):** `{20261122, 20261123, 5, 10, 18}` ∪ `{1..40}` (deduped).
**Subset for tick-order A/B (n=40):** first 40 of that list.

## 1. Mirrored matches + side swap (baseline, committed tick order)

Same 5 champions on both sides for each default lineup; plus kit side-swap of the asymmetric defaults.

| Experiment | Blue wins | Red wins | n |
|---|---:|---:|---:|
| Default kits (blue≠red lineups) | 6 | **36** | 42 |
| **Mirrored blue lineup** both sides | 25 | 15 | 42 |
| **Mirrored red lineup** both sides | 6 | **36** | 42 |
| **Swap sides** (blue↔red default picks) | **35** | 7 | 42 |

Same pattern as `kit-swap-20.txt` / `REPORT.md`, at larger n:

- Kit swap nearly inverts the default lean (6–36 → 35–7) → **kit asymmetry**, not a pure map bug.
- Mirrored **blue** kits are mildly blue-leaning (25–15).
- Mirrored **red** kits still lean hard red (6–36) → **residual side×kit** interaction (same residual REPORT saw at 3–17 / n=20).

### Same n=40 subset (for A/B with reversed order)

| Experiment | Blue wins | Red wins | n |
|---|---:|---:|---:|
| Mirrored blue lineup | 25 | 15 | 40 |
| Mirrored red lineup | 6 | **34** | 40 |

## 2. Temporary tick-order reverse (throwaway; restored after)

### Sites touched (file:line) — blue-first order dependence

| Site | What |
|---|---|
| `sim/ai/tick.ts:178` | Soft-issue engage window: iterate `["blue","red"]`. |
| `sim/ai/tick.ts:191` | L1 Fight Call: iterate `["blue","red"]` — blue acts first. |
| `sim/ai/tick.ts:290` | Peel / dive: iterate `["blue","red"]`. |
| `sim/ai/tick.ts:340` | Unit Brain: `for (const u of state.units)` — blue-first because `buildUnits` order. (REPORT cited ~`:343`.) |
| `sim/ai/fight.ts:117` | 2v2 escalate scan: `[...blue, ...red]`. |
| `sim/simulate.ts:239` | `buildUnits`: teams `["blue","red"]` → blue `index` 0–4, red 5–9. |
| `sim/arena.ts:254–257` | Capture race: blue progress checked before red. |
| `sim/combat.ts:278–281` | Equal-distance auto target → lower `index` (blue). |
| `sim/arena.ts:303–310` | Claim denier tie → lower `index` (blue). |
| `sim/simulate.ts:923–924` | Assist sort by `index` (blue first). |

### Experiment A — reverse AI team / brain processing only

Temporarily set tick L178/L191/L290 to `["red","blue"]`, brain loop red-first, fight.ts `[...red,...blue]`.

| Experiment | Baseline (n=40) | AI-order reversed (n=40) |
|---|---|---|
| Mirrored blue | blue **25** / red 15 | blue **25** / red 15 |
| Mirrored red | blue 6 / red **34** | blue 6 / red **34** |

**Per-seed:** 0 winners changed (0 flips). Residual lean **did not flip**.

### Experiment B — stronger reverse (AI + buildUnits + capture race)

Also temporarily reversed `buildUnits` team order and arena capture check (red before blue).

| Experiment | Baseline (n=40) | Strong reverse (n=40) |
|---|---|---|
| Mirrored blue | blue **25** / red 15 | blue **26** / red 14 |
| Mirrored red | blue 6 / red **34** | blue 5 / red **35** |

**Per-seed:** mirrored-blue 14 score/timing diffs / **1** winner flip; mirrored-red 9 diffs / **3** winner flips.
Aggregate residual lean **did not flip** (red kits still ~5–35 red).

## 3. Verdict (measurement)

1. **Primary lean** under default even-OVR remains **kit asymmetry** (swap sides inverts it).
2. **Residual** mirrored-red red-lean persists at n≈40 and is **not explained by blue-first AI tick order** alone (zero outcome change when that order is reversed).
3. Broader blue-first loops (indices / capture race) move a few seeds but **do not flip** the residual lean.
4. **Anh deferred the sim fix** — no committed tick-order change. Ready-to-enable gate: `tests/s3-side-neutral.test.ts` (`it.skip`).

## 4. Not done

- No sim tick-order fix committed.
- No kit rebalance.
- Digests / acceptance gates untouched.
