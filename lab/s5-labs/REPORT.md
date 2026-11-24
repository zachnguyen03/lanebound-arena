# S5 follow-up labs — random-draft + isolation (report only)

**Branch:** `s5-labs`  
**Base:** `d691445df27ab35b80afb9fc89333e1df9039b30` (`s5`)  
**Label:** **auto-only baseline (no AI casts)**  
**Spec:** Appendix R #6 / S5-R6-8 (build-spec)  
**Date:** 24 Nov 2026  

**Seat split (random-draft, N=1200):** unswapped blue **48.17%** (289/600) · swapped blue **50.83%** (305/600) · pooled blue **49.50%** (594/1200).  
**Pair split (600 pairs):** **74.3%** decided by comp · **25.7%** by side.

`sim/` and `tests/acceptance/**` were **not** edited. No balance knobs / constants changed.

## Draft mix fix (lab tooling)

**Defect:** `quickDraftPicks` correlated across consecutive seeds. Bare xorshift on raw seeds parked `isra` in the sit-out seat (**0/100** appearances) while **six** champs appeared in **all 100**. Role-preference slot fill then forced both tops + both supports every game, so uniform ~143 appearances/champ (N≈200, p=10/14) was impossible.

**Fix (lab-only):** Mulberry32 stream mixed from `seed ⊕ domain` (not any sim RNG stream) → Fisher–Yates → deal blue=first 5 / red=next 5. Deterministic per seed. Unit test: `tests/s5-draft-mix.test.ts` — over 100 consecutive seeds every champ’s appearance count is in **[55, 90]** (E≈71.4, σ≈4.5; band ≈ mean ± 3.5σ — fails 0/100 while tolerating CI noise).

## Gates

| Command | Exit |
|---|---:|
| `npm run purity` | **0** |
| `npx tsc --noEmit` | **0** |
| `npm test` | **0** — 1423 passed / 11 skipped (+2 draft-mix tests) |
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

Only Kerrig/Huntress, gated R only (never Q/W). Hold/Hunt/Starve + poke/dive probes: `cast_start=0`, `skillshot_roll=0`. **Aim / Reflexes arms = BLOCKED** (ran as auto-only, Δ +0.0).

**The skillshot arm and the Aim/Reflexes isolation stay unmet until AI casting (ENG-5) lands, and must be re-run then.**

## Isolation (S5-R6-7) — pair_swap + TW floor 40 + mastery_one

```bash
npm run isolation -- --n 400 --seed 20261122 --teamwork-floor 40 --pairing pair_swap --out lab/s5-labs/isolation-tw40
```

Uses **fixed** even-OVR lineups (not `quickDraftPicks`). Re-run after draft fix: **unchanged** vs prior tip (control 50.25%, deltas identical).

| Setup | Value |
|---|---|
| Pairing | 200 seeds × 2 (picks swapped) = **N=400**/arm |
| Control blue WR | **50.25%** (Wilson 95% [45.4%, 55.1%]) |
| Mirror control | n=200, blue WR **43.5%** (Wilson [36.8%, 50.4%]) |
| Teamwork floor | **40** — `callFollowSlack=1+0.01*max(0,50−T)` inert at T≥50; floor so +30 can leave always-follow. (R6-7d notes the formula itself is buggy; not changed here.) |
| Mastery arm | **mastery_one** on blue ADC pick only (§8.5 / R6-7a). Test: `tests/s5-isolation-mastery.test.ts`. |

| Attr | Δ pp (N=400) | Notes |
|---|---:|---|
| aim | **+0.00** | **BLOCKED** — unmet until ENG-5 |
| reflexes | **+0.00** | **BLOCKED** — unmet until ENG-5 |
| execution | **−2.50** | fail band |
| decision | **−1.00** | fail band |
| positioning | **−5.75** | fail band |
| teamwork | **−0.25** | fail band |
| mastery 50→90 (ADC) | **+0.50** | see comparability note below |

Band +3…+6 / no Δ>2× another: **fail**. No knobs applied.

**Comparability (mastery):** this lab’s mastery **+0.50** (one player — the blue ADC — under `pair_swap`, 50% control WR) is **NOT comparable** to S5’s **+28.75** (`mastery_all`, no side-swap). Different pin scope, different pairing, different control baseline.

### Isolation control dashboard

`isolation-tw40/isolation-control-dashboard.json` regenerated with current fight-quality (S5-R6-8). F1–F4 medians: **1 / 0 / 1 / 0** (match random-draft formulas).

## Random-draft — auto-only baseline, side-swapped pairs

```bash
npm run batch -- --n 1200 --seed 20261122 --scheme random_draft --side-swap-pairs --out lab/s5-labs/random-draft
```

600 pair-seeds × 2 = **1200 games**, Hold, even-OVR. Seeds/lineups: `random-draft-seeds.csv`.

**Draft:** lab Mulberry32 hash stream → Fisher–Yates → 5+5 deal (no role-preference fill).

### Old vs new headlines (draft-mix fix)

| Metric | Old (biased draft) | New (mixed stream) |
|---|---:|---:|
| Seat unswapped blue | 51.17% | **48.17%** |
| Seat swapped blue | 49.33% | **50.83%** |
| Seat pooled blue | 50.25% | **49.50%** |
| Pair comp / side | 75.2% / 24.8% | **74.3% / 25.7%** |
| Length median | 108.3 s | **114.6 s** |
| Zone share winner | 52.5% | **52.3%** |
| End first_to_10 | 94.4% | **96.3%** |
| End clock | 3.8% | **2.9%** |
| End zone_time | 1.7% | **0.8%** |
| End sudden_death | 0.08% | **0%** |
| F1 / F2 / F3 / F4 medians | 1 / 0 / 1 / 0 | **1 / 0 / 1 / 0** |
| Champ appearances (min–max) | 578–1200 | **812–888** (≈857 expected) |

### Per-champion appearances (old → new)

| Champ | Old n | New n |
|---|---:|---:|
| brannoch | 1200 | **858** |
| calder | 616 | **880** |
| helvar | 584 | **858** |
| huntress | 804 | **836** |
| isra | 788 | **866** |
| kerrig | 578 | **872** |
| maelis | 808 | **888** |
| mirren | 622 | **860** |
| rhedan | 1200 | **844** |
| saelo | 1200 | **850** |
| sedge | 844 | **884** |
| tolle | 782 | **812** |
| torun | 774 | **832** |
| ysol | 1200 | **860** |

### §6.5 (one source: `buildDashboard`)

| Metric | Value | Mark |
|---|---|---|
| Length median | **114.6 s** (p10 65.2, p90 180.7) | **fail** (210–270) |
| Zone share winner | **52.3%** | **fail** (30–40) |
| Per-champion | min n=**812**; several outside 45–55% | **fail** |
| Archetype | Dive 38% (178); Peel 25% (192); Poke 55% (578); Balanced 20% (54) | **under-powered** (Balanced n&lt;80) |
| Auto-peel | **94.7%** (1940/2048 `dive_geom`) | **pass** |
| Sanctuary | **0** | **pass** |
| Side lean pooled | blue **49.50%** / red 50.50% | **report** |

### Pair lean (comp vs side)

| | Count | Rate |
|---|---:|---:|
| Comp decisive (same kit wins both sides) | 446 | **74.3%** |
| Side decisive (same side wins both kits) | 154 | **25.7%** |

### Per-champion (n, WR, Wilson 95%)

| Champ | n | WR | CI95 |
|---|---:|---:|---|
| brannoch | 858 | 41.7% | [38.5, 45.1] |
| calder | 880 | 55.3% | [52.0, 58.6] |
| helvar | 858 | 55.9% | [52.6, 59.2] |
| huntress | 836 | 56.6% | [53.2, 59.9] |
| isra | 866 | 68.2% | [65.1, 71.3] |
| kerrig | 872 | 40.8% | [37.6, 44.1] |
| maelis | 888 | 58.4% | [55.2, 61.6] |
| mirren | 860 | 53.7% | [50.4, 57.0] |
| rhedan | 844 | 41.1% | [37.8, 44.5] |
| saelo | 850 | 47.5% | [44.2, 50.9] |
| sedge | 884 | 54.6% | [51.3, 57.9] |
| tolle | 812 | 36.2% | [33.0, 39.6] |
| torun | 832 | 39.4% | [36.2, 42.8] |
| ysol | 860 | 48.6% | [45.3, 51.9] |

### End mix

| Reason | Share |
|---|---:|
| first_to_10 | 96.3% |
| clock | 2.9% |
| zone_time | 0.8% |
| sudden_death | 0% |

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
| Contested-pit share* | 88.1% | 43.3% | 100% |

\*Stand-in: pit-centred `fight_call` / all `fight_call`. True R6-5 “owned time contested” needs occupancy ticks (not in the event export).

F2 is 0 under auto-only (no hard CC / skill hits). Definitions live in `apps/lab/lib/fight-quality.ts`.

### Known gaps — omitted R6-8 sub-metrics

This report ships the headline F1–F4 counts only. The following Appendix R6-8 sub-metrics are **omitted** (not computed in this pass):

- **F1** duration and decisive share
- **F2** combo-kill
- **F3** survival rate
- **F4** triples / aces
- **Pair-level rollup** of the above

## Recommended knobs (**not applied**)

Per R6-4 / R6-6: **no constant changes in S5.** Prerequisite is §9.4.1 cast policy (sim) / **ENG-5**. Then re-measure F1–F4 (and re-run Aim/Reflexes + skillshot arms), then zone/`SCORE_TO_WIN` only if still out of band.

## Inventions

| | |
|---|---|
| Lab Mulberry32 draft stream (`seed ⊕ domain`) | `labDraftUnit` / `quickDraftPicks` |
| Fisher–Yates + 5+5 deal (no role-pref fill) | `quickDraftPicks` |
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
