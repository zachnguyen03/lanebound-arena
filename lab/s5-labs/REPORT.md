# S5 follow-up labs — random-draft + isolation (report only)

**Branch:** `s5-labs`  
**Base:** `d691445df27ab35b80afb9fc89333e1df9039b30` (`s5`)  
**Label:** **auto-only baseline (no AI casts)**  
**Spec:** Appendix R #6 / S5-R6-8 + **R7-11** (build-spec sha `f30352477590f552f71f19c4827787096d9ff115282f15f5c8bde4780f2d79d1`)  
**Date:** 24 Nov 2026  

**Seat split (random-draft, N=1200):** unswapped blue **46.00%** (276/600) · swapped blue **53.83%** (323/600) · pooled blue **49.92%** (599/1200).  
**Pair split (600 pairs):** **70.8%** decided by comp · **29.2%** by side.

`sim/` and `tests/acceptance/**` were **not** edited. No balance knobs / constants changed.

## Spec check

```
sha256sum -c /cursor/stores/bot/lanebound-specs/SHA256SUMS
→ lanebound-arena-build-spec-v1.md: OK  (sha f3035247…)
```

M6 Scope (L2001): **Role-random draft (R7-11)** — one champion per Position per team in its matching slot; uniform draw within each Position pool from champion data; cross-team duplicates allowed (lab only). Fully uniform 14-champion deals are **not** valid drafts.

## Draft (R7-11)

`quickDraftPicks` draws each of Top / Jungle / Mid / ADC / Support independently and uniformly from `default_slot` pools in `data/champions/defs.ts` (sizes 2 / 3 / 4 / 3 / 2). Lab Mulberry32 stream (`seed ⊕ domain`); not any sim RNG stream.

Unit tests: `tests/s5-draft-mix.test.ts` — seeded N=8000; appearance near Top/Support **75%**, Jungle/ADC **55.6%**, Mid **43.75%**; mirror-at-Position near **50% / 33.3% / 25%**; structural invariants every game.

## Gates

| Command | Exit |
|---|---:|
| `npm run purity` | **0** |
| `npx tsc --noEmit` | **0** |
| `npm test` | **0** — 1424 passed / 11 skipped |
| `npm run watch:e2e` | **0** — 34 passed (`ss -ltnp`: 4173/4175 free) |

## Digests (must stay gold)

| Config | seed | digest |
|---|---:|---|
| S1 AI-off | 20261122 | `7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f` |
| S1 AI-off | 20261123 | `f3946e13929209cf9fd179cf20b147b050a6402ab09a83d2bdf6306e3c744cd0` |
| S1 AI-on | 20261122 | `fccc7096e248c64a3182bfa244eaf7f16630525fcd5960c1abf7ef9215f18e48` |
| S1 AI-on | 20261123 | `68e5fcfbdfa65f73272d8c8de9ee89c9da27545ba690b650ab65449d14083d3b` |
| even-OVR Hold | 20261122 | `54cae20c950a238d5c06a8324076cf2febe429d8dfe8b2c2057232fdf33f6b0d` |
| even-OVR Hold | 20261123 | `74d9794affef09962673f97a0ef1aaf934cc8f58116193c044ef6cad6f21f425` |

## Blocked — skillshot isolation (S5-R6-1) / ENG-5

**No skillshot-capable match preset without editing `sim/`.** Do not fake one.

`sim/ai/brain.ts` `chooseExecutionCast`:

```529:530:sim/ai/brain.ts
): { skill: "Q" | "W" | "R"; target_id: UnitId | null } | null {
  if (u.champ !== "kerrig" && u.champ !== "huntress") return null;
```

Only Kerrig/Huntress, gated R only (never Q/W). **Aim / Reflexes arms = BLOCKED** until ENG-5; re-run then.

## Isolation (S5-R6-7) — unchanged (fixed even-OVR lineups)

| Attr | Δ pp (N=400) | Notes |
|---|---:|---|
| aim / reflexes | **+0.00** | **BLOCKED** until ENG-5 |
| execution | **−2.50** | fail band |
| decision | **−1.00** | fail band |
| positioning | **−5.75** | fail band |
| teamwork | **−0.25** | fail band |
| mastery 50→90 (ADC) | **+0.50** | **not comparable** to S5 +28.75 (`mastery_all`, no swap) |

Control blue WR **50.25%**. Band +3…+6: **fail**. No knobs applied.

## Random-draft — R7-11 auto-only baseline (N=1200)

```bash
npm run batch -- --n 1200 --seed 20261122 --scheme random_draft --side-swap-pairs --out lab/s5-labs/random-draft
```

Proof extras: `random-draft/r7-11-report.json`, `pair-lean.json`.

### N per champion + appearance vs expected

| Champ | Position | N (picks) | Appear rate | Expected |
|---|---|---:|---:|---:|
| brannoch | Top | 1240 | 76.8% | 75% |
| rhedan | Top | 1160 | 73.5% | 75% |
| sedge | Jungle | 744 | 51.0% | 55.6% |
| tolle | Jungle | 864 | 58.5% | 55.6% |
| torun | Jungle | 792 | 54.5% | 55.6% |
| calder | Mid | 624 | 45.7% | 43.75% |
| helvar | Mid | 584 | 43.5% | 43.75% |
| kerrig | Mid | 596 | 42.8% | 43.75% |
| mirren | Mid | 596 | 43.5% | 43.75% |
| huntress | ADC | 818 | 56.7% | 55.6% |
| isra | ADC | 820 | 56.7% | 55.6% |
| maelis | ADC | 762 | 52.7% | 55.6% |
| saelo | Support | 1196 | 74.7% | 75% |
| ysol | Support | 1204 | 75.0% | 75% |

N can exceed 1200 when a champ is mirrored (both teams). Appear = present on ≥1 team that game.

### Mirror-at-Position rates (600 pair-seeds)

| Position | Observed | Expected |
|---|---:|---:|
| Top | 49.7% | 50% |
| Jungle | 36.0% | 33.3% |
| Mid | 24.5% | 25% |
| ADC | 34.0% | 33.3% |
| Support | 50.3% | 50% |

### Seat / pooled / pair

| Metric | Value |
|---|---:|
| Unswapped blue WR | **46.00%** |
| Swapped blue WR | **53.83%** |
| Pooled blue WR | **49.92%** (599/1200) |
| Comp-decided pairs | **70.8%** (425/600) |
| Side-decided pairs | **29.2%** (175/600) |

### Length / zone / F1–F4

| Metric | Value |
|---|---:|
| Length median | **119.2 s** (p10 65.2, p90 200.9) |
| Zone share winner | **52.8%** |
| F1 / F2 / F3 / F4 medians | **1 / 0 / 1 / 0** |

### F4 + comp-decided pairs by mirrored Positions (0–5)

| # mirrored | Pairs | Comp-decided | Comp rate | F4 close rate | F4 comeback | F4 shutout |
|---:|---:|---:|---:|---:|---:|---:|
| 0 | 50 | 38 | 76.0% | 0% | 10.0% | 20.0% |
| 1 | 163 | 121 | 74.2% | 0% | 9.5% | 20.9% |
| 2 | 207 | 147 | 71.0% | 0% | 10.9% | 19.1% |
| 3 | 135 | 97 | 71.9% | 0% | 6.7% | 18.9% |
| 4 | 40 | 22 | 55.0% | 0% | 7.5% | 7.5% |
| 5 | 5 | 0 | 0% | 0% | 0% | 0% |

(F4 rates over the 2 games in each pair. Full-mirror pairs are side-decided only — identical comps.)

### §6.5 (one source: `buildDashboard`)

| Metric | Value | Mark |
|---|---|---|
| Length median | **119.2 s** | **fail** (210–270) |
| Zone share winner | **52.8%** | **fail** (30–40) |
| Per-champion | min n=**584**; several outside 45–55% | **fail** |
| Archetype | Dive 39% (556); Peel 49% (534); Poke 59% (736); Balanced 23% (106) | **report** |
| Auto-peel | **94.3%** (2760/2928 `dive_geom`) | **pass** |
| Sanctuary | **0** | **pass** |

### Per-champion (n, WR, Wilson 95%)

| Champ | n | WR | CI95 |
|---|---:|---:|---|
| brannoch | 1240 | 56.2% | [53.4, 58.9] |
| calder | 624 | 56.6% | [52.7, 60.4] |
| helvar | 584 | 55.0% | [50.9, 59.0] |
| huntress | 818 | 39.4% | [36.1, 42.8] |
| isra | 820 | 58.0% | [54.6, 61.4] |
| kerrig | 596 | 33.6% | [29.9, 37.4] |
| maelis | 762 | 52.8% | [49.2, 56.3] |
| mirren | 596 | 54.7% | [50.7, 58.7] |
| rhedan | 1160 | 43.4% | [40.5, 46.2] |
| saelo | 1196 | 48.3% | [45.5, 51.2] |
| sedge | 744 | 62.8% | [59.2, 66.2] |
| tolle | 864 | 46.5% | [43.2, 49.9] |
| torun | 792 | 41.8% | [38.4, 45.3] |
| ysol | 1204 | 51.7% | [48.8, 54.5] |

### End mix

| Reason | Share |
|---|---:|
| first_to_10 | 93.8% |
| clock | 5.2% |
| zone_time | 0.8% |
| sudden_death | 0.3% |

### Known gaps — omitted R6-8 sub-metrics

- **F1** duration and decisive share
- **F2** combo-kill
- **F3** survival rate
- **F4** triples / aces
- **Pair-level rollup** of the above (beyond the mirrored-Position split above)

## Recommended knobs (**not applied**)

Per R6-4 / R6-6: **no constant changes in S5.** Prerequisite ENG-5 / §9.4.1 cast policy. Then re-measure.

## Inventions

| | |
|---|---|
| Lab Mulberry32 draft stream (`seed ⊕ domain`) | `labDraftUnit` |
| R7-11 Position-pool draws from `CHAMPIONS.default_slot` | `quickDraftPicks` |
| `side_swap_pairs` / `seed+1e9` twin | batch-runner / isolation |
| `mastery_one` (ADC pick) | applyPins / §8.5 |
| F1–F4 from event log (R6-8) | fight-quality.ts |

## Proof tree

```
lab/s5-labs/
  REPORT.md  config.json  random-draft-seeds.csv
  random-draft/{batch-*,dashboard,pair-lean,r7-11-report}.*
  isolation-tw40/{isolation-results,isolation-control-dashboard}.json
  logs/
```

## Constant edits

**None.**
