# S5 follow-up labs — random-draft + isolation (report only)

**Branch:** `s5-labs`  
**Base:** `d691445df27ab35b80afb9fc89333e1df9039b30` (`s5`)  
**Label:** **auto-only baseline (no AI casts)**  
**Spec:** Appendix R #6 / S5-R6-8 (build-spec)  
**Date:** 24 Nov 2026  

`sim/` and `tests/acceptance/**` were **not** edited. No balance knobs / constants changed.

## Gates

| Command | Exit |
|---|---:|
| `npm run purity` | **0** |
| `npx tsc --noEmit` | **0** |
| `npm test` | **0** — 1421 passed / 11 skipped (+2 mastery tests) |
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

## Blocked — skillshot isolation (S5-R6-1)

**No skillshot-capable match preset without editing `sim/`.** Do not fake one.

`sim/ai/brain.ts` `chooseExecutionCast`:

```529:530:sim/ai/brain.ts
): { skill: "Q" | "W" | "R"; target_id: UnitId | null } | null {
  if (u.champ !== "kerrig" && u.champ !== "huntress") return null;
```

Only Kerrig/Huntress, gated R only (never Q/W). Hold/Hunt/Starve + poke/dive probes: `cast_start=0`, `skillshot_roll=0`. **Aim / Reflexes arms = BLOCKED** (ran as auto-only, Δ +0.0).

## Isolation (S5-R6-7) — pair_swap + TW floor 40 + mastery_one

```bash
npm run isolation -- --n 400 --seed 20261122 --teamwork-floor 40 --pairing pair_swap --out lab/s5-labs/isolation-tw40
```

| Setup | Value |
|---|---|
| Pairing | 200 seeds × 2 (picks swapped) = **N=400**/arm |
| Control blue WR | **50.25%** (Wilson 95% [45.4%, 55.1%]) |
| Mirror control | n=200, blue WR **43.5%** (Wilson [36.8%, 50.4%]) |
| Teamwork floor | **40** — `callFollowSlack=1+0.01*max(0,50−T)` inert at T≥50; floor so +30 can leave always-follow. (R6-7d notes the formula itself is buggy; not changed here.) |
| Mastery arm | **mastery_one** on blue ADC pick only (§8.5 / R6-7a). Test: `tests/s5-isolation-mastery.test.ts`. |

| Attr | Δ pp (N=400) | Notes |
|---|---:|---|
| aim | **+0.00** | **BLOCKED** |
| reflexes | **+0.00** | **BLOCKED** |
| execution | **−2.50** | fail band |
| decision | **−1.00** | fail band |
| positioning | **−5.75** | fail band |
| teamwork | **−0.25** | fail band |
| mastery 50→90 (ADC) | **+0.50** | smaller than raw +30 (expected) |

Band +3…+6 / no Δ>2× another: **fail**. No knobs applied.

## Random-draft — auto-only baseline, side-swapped pairs

```bash
npm run batch -- --n 1200 --seed 20261122 --scheme random_draft --side-swap-pairs --out lab/s5-labs/random-draft
```

600 pair-seeds × 2 = **1200 games**, Hold, even-OVR. Seeds/lineups: `random-draft-seeds.csv`.

**Draft inventions:** lab xorshift + **SplitMix32 avalanche** (consecutive seeds previously always parked `isra` last — fixed); role-preference slot fill.

### §6.5 (one source: `buildDashboard`)

| Metric | Value | Mark |
|---|---|---|
| Length median | **108.3 s** (p10 65.1, p90 185.4) | **fail** (210–270) |
| Zone share winner | **52.5%** | **fail** (30–40) |
| Per-champion | min n=**578**; many outside 45–55% | **fail** |
| Archetype | Dive 26% (512); Peel 48% (516); Poke 60% (822); Balanced 17% (78) | **under-powered** (Balanced n&lt;80) |
| Auto-peel | **94.7%** (2443/2581 `dive_geom`) | **pass** |
| Sanctuary | **0** | **pass** |
| Side lean pooled | blue **50.2%** / red 49.8% | **report** |

### Pair lean (comp vs side)

| | Count | Rate |
|---|---:|---:|
| Comp decisive (same kit wins both sides) | 451 | **75.2%** |
| Side decisive (same side wins both kits) | 149 | **24.8%** |

### Per-champion (n, WR, Wilson 95%)

| Champ | n | WR | CI95 |
|---|---:|---:|---|
| brannoch | 1200 | 62.3% | [59.5, 64.9] |
| calder | 616 | 58.1% | [54.2, 62.0] |
| helvar | 584 | 56.7% | [52.6, 60.6] |
| huntress | 804 | 37.3% | [34.0, 40.7] |
| isra | 788 | 62.8% | [59.4, 66.1] |
| kerrig | 578 | 28.5% | [25.0, 32.4] |
| maelis | 808 | 50.1% | [46.7, 53.6] |
| mirren | 622 | 55.6% | [51.7, 59.5] |
| rhedan | 1200 | 37.8% | [35.1, 40.5] |
| saelo | 1200 | 52.3% | [49.4, 55.1] |
| sedge | 844 | 67.4% | [64.2, 70.5] |
| tolle | 782 | 37.2% | [33.9, 40.7] |
| torun | 774 | 43.9% | [40.5, 47.4] |
| ysol | 1200 | 47.8% | [44.9, 50.6] |

### End mix

| Reason | Share |
|---|---:|
| first_to_10 | 94.4% |
| clock | 3.8% |
| zone_time | 1.7% |
| sudden_death | 0.08% |

### F1–F4 (S5-R6-8) — values only, no targets

| Id | median | p10 | p90 |
|---|---:|---:|---:|
| **F1** teamfights/game | 1 | 1 | 2 |
| **F2** combo chains/game | 0 | 0 | 0 |
| **F3** clutch moments/game | 1 | 0 | 2 |
| **F4** close finish | 0 | 0 | 1 |
| F4 comeback | 0 | 0 | 1 |
| F4 shutout | 0 | 0 | 1 |
| F4 multikills/game | 0 | 0 | 0 |
| Lead changes/game | 3 | 1 | 7 |
| Contested-pit share* | 97.2% | 58.5% | 100% |

\*Stand-in: pit-centred `fight_call` / all `fight_call`. True R6-5 “owned time contested” needs occupancy ticks (not in the event export).

F2 is 0 under auto-only (no hard CC / skill hits). Definitions live in `apps/lab/lib/fight-quality.ts`.

## Recommended knobs (**not applied**)

Per R6-4 / R6-6: **no constant changes in S5.** Prerequisite is §9.4.1 cast policy (sim). Then re-measure F1–F4, then zone/`SCORE_TO_WIN` only if still out of band.

## Inventions

| | |
|---|---|
| Lab draft RNG + SplitMix32 avalanche | `quickDraftPicks` |
| Role-preference fill | `quickDraftPicks` |
| `side_swap_pairs` / `seed+1e9` twin | batch-runner / isolation |
| `teamwork_all` floor pin | applyPins |
| `mastery_one` (ADC pick) | applyPins / §8.5 fix |
| F1–F4 from event log (R6-8) | fight-quality.ts |
| Contested-pit fight_call proxy | fight-quality.ts |
| Peel denom = `dive_geom` | unchanged S5 |

## Proof tree

```
lab/s5-labs/
  REPORT.md  config.json  random-draft-seeds.csv
  random-draft/{batch-results,batch-summaries,batch-dashboard,dashboard,pair-lean}.*
  isolation-tw40/{isolation-results,isolation-control-dashboard}.json
  logs/  digests  purity.txt  tests.log  watch-e2e.log
```

## Constant edits

**None.**
