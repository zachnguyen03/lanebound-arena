# S5 Report — Batch, dashboard, tuning panel, isolation runner

**Branch:** `s5`  
**Base:** `cursor/s4-watch-f8c1` @ `e427530ed56e8a8d53939922460168332f28c562`  
**Proof produced on:** `b140ab1dad358e7993d9cfeabe575adcaec8ac7b` (`b140ab1`)  
**Docs / caption / isolation-N=400 tip:** `d691445df27ab35b80afb9fc89333e1df9039b30` (`d691445`)  
*(Later commits on this branch are docs/UI only — REPORT wording, Watch HUD/Lab keep-alive, Content-Type headers — and cannot contain their own tip hash. Lab2000 digests and sim/ are unchanged.)*

**Date:** 23–24 Nov 2026  

`sim/` and `tests/acceptance/**` were **not** edited. Digests below are byte-identical to the S4 tip.

## Gates

| Command | Exit |
|---|---:|
| `npm run purity` | **0** |
| `npx tsc --noEmit` | **0** |
| `npx tsc -p apps/watch/tsconfig.json --noEmit` | **0** |
| `npm test` | **0** — 1419 passed / 11 skipped |
| `npm run watch:build` | **0** |
| `npm run watch:e2e` | **0** — 34 passed (includes 3 new S5 lab specs) |

Port check before e2e: `4173` free (python socket probe; `ss` unavailable on this image). Playwright used the existing preview on `127.0.0.1:4173`.

## Digests (unchanged)

| Config | seed | digest |
|---|---:|---|
| S1 AI-off `defaultEvenConfig` | 20261122 | `7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f` |
| S1 AI-off | 20261123 | `f3946e13929209cf9fd179cf20b147b050a6402ab09a83d2bdf6306e3c744cd0` |
| S1 AI-on (`ai_enabled: true`) | 20261122 | `fccc7096e248c64a3182bfa244eaf7f16630525fcd5960c1abf7ef9215f18e48` |
| S1 AI-on | 20261123 | `68e5fcfbdfa65f73272d8c8de9ee89c9da27545ba690b650ab65449d14083d3b` |
| even-OVR Hold | 20261122 | `54cae20c950a238d5c06a8324076cf2febe429d8dfe8b2c2057232fdf33f6b0d` |
| even-OVR Hold | 20261123 | `74d9794affef09962673f97a0ef1aaf934cc8f58116193c044ef6cad6f21f425` |

## Exact commands (PM re-run)

```bash
# Gates
npm run purity
npx tsc --noEmit
npx tsc -p apps/watch/tsconfig.json --noEmit
npm test
npm run watch:e2e

# B1 cancel + full 100
npm run batch -- --n 100 --seed 20261122 --cancel-after 20 --out lab/s5/cancel
npm run batch -- --n 100 --seed 20261122 --out lab/s5

# Official 2,000-game even lab
npm run batch -- --n 2000 --seed 20261122 --out lab/s5/lab2000

# Isolation six deltas
npm run isolation -- --n 50 --out lab/s5/isolation
npm run isolation -- --n 400 --out lab/s5/isolation400
```

## Official 2,000-game even lab (`evenOvrConfig`, Hold, seeds 20261122…)

| Metric | Value | Target | Mark |
|---|---|---|---|
| Length median | **104.4 s** (p10 77.2, p90 177.0) | 210–270 s | **fail** |
| Zone share of winner's score | **51.8%** | 30–40% | **fail** |
| Auto-peel | **96.3%** (fired 3194 / eligible 3317) | ≥ 70% of `dive_geom` | **pass** |
| Sanctuary violations | **0** | 0 | **pass** |
| End reasons | first_to_10 98.85%, clock 1.15% | — | report |
| First R median | **64.0 s** (n=2000) | ~80 s flavour | report (early) |
| L7 median | **126.6 s** (n=663 games that reached L7) | ~160 s flavour | report (early / rare) |

Per-champion win rates on the **fixed even lineups** are kit-asymmetric (~13% blue kits / ~87% red kits), not a random-draft sample — dashboard marks **fail** / reports the known side×kit lean from `lab/s3/side-lean/`.

Archetype tags on the default even picks land as Dive (blue) vs Poke (red); Peel/Balanced vs-field N=0 → **under-powered** for the triangle claim.

### Out-of-band — recommended knobs (**not applied**)

1. **Match length too short (median 1:44 vs 3:30–4:30).** Matches end first-to-10 after a red snowball. Knobs in order: `SCORE_TO_WIN` (raise), then kit/side lean (design), not XP. Do not silently buff blue kits.
2. **Zone share of winner 51.8% > 40%.** Winner score is tick-heavy after early captures. Knobs: `CLAIM_DELAY_S` (first), then `CLAIM_DENY_DWELL_S`, then `ZONE_TICK_S` (sandbox §13 / M6 order).
3. **R / L7 early vs flavour** when a match lasts long enough — kill XP + short games. XP table is **(P)**; revise only in a design pass.
4. **Attribute isolation** — see § Isolation below (N=400 is the claim-size run). **No constants changed.**

## Isolation (six deltas)

### Preview N=50 (`lab/s5/isolation/`)

```bash
npm run isolation -- --n 50 --out lab/s5/isolation
```

Control blue win 2%. Deltas: aim/reflexes/execution/decision/teamwork +0.0, positioning +2.0. Mastery 50→90 +42.0 pp.

### Claim-size N=400 (`lab/s5/isolation400/`) — verified

```bash
npm run isolation -- --n 400 --out lab/s5/isolation400
```

Control blue win **4.5%**. Output: `lab/s5/isolation400/isolation-results.json`.

| Attr | Δ pp (blue win) | N |
|---|---:|---:|
| aim | **+0.0** | 400 |
| reflexes | **+0.0** | 400 |
| execution | **−0.75** | 400 |
| decision | **+0.25** | 400 |
| positioning | **+1.25** | 400 |
| teamwork | **+0.0** | 400 |

Mastery 50→90 (all players): **+28.75 pp** (n=400). Target band is +3 to +6 pp per raw +30 attr with no delta >2× another — **fail / under the claim**; reported, not retuned.

#### Zero / near-zero rows — sim/lab-setup gap (reasons; knobs not applied)

| Attr | Why the lab cannot move the needle | Recommended knobs (**not applied**) |
|---|---|---|
| **aim**, **reflexes** | Hold even lab fires almost no Aim skillshots (`cast_start` / skillshot rolls stay rare under Hold + kit lean). Aim vs Reflexes hit% therefore has nothing to act on. | Isolation arm that forces skillshot traffic (scripted casts / Hunt tactic / poke comps), or measure Aim only in a dedicated skillshot fixture — not a constant retune. |
| **teamwork** | `callFollowSlack` is inert at Teamwork ≥ 50 (`1 + 0.01 * max(0, 50 − T)` → 1.0). Isolation floor is attrs=60, so +30 never leaves the always-follow band. | Isolation floor Teamwork at **40** (or a dedicated <50 arm) so the follow-call multiplier can move; do not change the formula defaults. |
| **execution / decision / positioning** | Small or negative deltas under the 4.5% blue base — kit lean still dominates. Positioning is the only raw attr with a measurable +1.25 pp. | Revisit after side/kit lean is addressed; knobs stay in AI thresholds (`CHASE_*`, planner) only if a design pass asks. |

## Peel denominator — flagged invention

Build-spec L1162 / L1737 / L1916 (and R #3 S2-4) define the auto-peel acceptance denominator as **perceived, reachable** dives (`dive` with `peeler_perceived === true`).

**This lab uses the stricter `dive_geom` count (all geometrically reachable dives), not the perceived-at-dive-begin filter.** Reason: on even Hold, `dive.peeler_perceived` is **false at dive-begin** (spec denom = perceived *on the tick the dive began*). Perception then opens and `peel_start` follows — measured on seed `20261622`: 7/7 dives emit `peeler_perceived: false`, then `peel_start` at **+0.6 s** every time (lag min = median = max = 0.6). Filtering the lab on perceived-at-begin therefore yields **0/0**; the rate here is “of geometrically reachable dives, how often did peel eventually start?” Dashboard copy and `MatchSummary.peel_eligible` say **geometrically reachable / `dive_geom`**, never “perceived”. Caption sources: `apps/lab/lib/dashboard.ts`, `apps/lab/lib/summary.ts`. Rate on the 2000-game lab: 3194/3317 = 96.3% under that denominator.

## Acceptance map

| ID | Result |
|---|---|
| B1 | Cancel at 20 → `lab/s5/cancel/` (n_finished=20). Full 100 rerun digests stable (`tests/s5-batch.test.ts`). |
| B2 | `--n 1000` accepted by `clampBatchN`; 2000 lab ran (~5.3 min @ ~6.2 games/s). |
| B3 | Static check: `apps/lab/**` does not import `@watch` / canvas. |
| T1–T4 | `tests/s5-tuning.test.ts` — illegal `ZONE_TICK_S=7` rejected; staged mid-match edit keeps digest; preset round-trip; defaults == `DEFAULT_CONSTANTS` / §15. |
| D1–D4 | Dashboard rows + CSV/JSON; isolation deltas (incl. N=400); sanctuary fail fixture; screenshots `lab/s5/shots/dashboard-{1280x720,1920x1080}.png`. |

## Known deferred (not fixed; visible in this lab)

| Issue | Where it shows |
|---|---|
| Melee idling under a hold commit | `sim/ai/brain.ts` engage gate — Hold even lab still has melee champions with sparse auto `hit`s (S4 note). |
| No `cast_start` telegraph | Even Hold emits 0 `cast_start` on gold seeds; Watch cannot draw skill telegraphs from that event. Also blocks Aim/Reflexes isolation (above). |
| Side lean (kit×side) | 2000-game blue kit win ~13% / red ~87%; see `lab/s3/side-lean/REPORT.md`. Isolation control blue win 4.5% at attrs=60 (N=400). |
| `peeler_perceived` false at dive-begin | Spec denom wants perceived *at dive begin*; Hold tapes show it false then true ~0.6 s later (seed `20261622`). Forces the `dive_geom` peel denominator invention above. |

## Full-game follow-ups (not implemented here)

| ID | Follow-up |
|---|---|
| **S5-N1** | Re-run attribute isolation on a **skillshot-capable preset** (Hunt / poke comps) with **Teamwork floor 40** so Aim, Reflexes, and Teamwork arms can move. Keep the Hold N=400 zeros as the honest baseline for that setup. Do **not** retune constants to force a +3–6 pass. |
| **S5-N3** | Optional in-browser batch runner (Start / Cancel / progress) in the Lab Batch panel. Sandbox plan allows Node CLI first; not required to close S5. |

## Inventories / assumptions

- **Batch runner = Node CLI first** (sandbox plan §3.1 / Anh). In-browser Lab UI loads CLI JSON; does not re-implement 2,000-game workers.
- **Archetype tags** (§6.5.1 proposal): nearest class-mix neighbour. **INVENTION:** `distance > 2 → Other` (exclude from edge math) — §6.5.1 is silent on the cutoff; implemented in `apps/lab/lib/archetypes.ts`.
- **Quick draft** for `random_draft` scheme: lab-local xorshift shuffle (not sim RNG stream `draft`) — flagged.
- **Tuning panel** lists every §15 key. Keys not in `sim/constants.ts` (`OVR_WEIGHTS`, `REACTION_*`, …) are shown as `sim-hardcoded` / non-editable (editing `sim/` is out of S5 scope). `CONTROL_COEF` retired. GD extras (`SEPARATION_*`, `SPAWN_SLOT_SPACING`) editable.
- **Peel denominator** = `ai_stats.dive_geom` (geometrically reachable dives; see invention above).
- **Zone share** = (ticks + claims) / (kills + ticks + claims) of the winner.
- Presets: `lab/presets/s5-default.json`, `lab/presets/s5-xp14.json` (also copied under `lab/s5/`).

## Proof tree

```
lab/s5/
  REPORT.md
  batch-results.json / batch-summaries.csv / batch-dashboard.csv
  cancel/…
  lab2000/…
  isolation/isolation-results.json
  isolation400/isolation-results.json
  shots/dashboard-1280x720.png
  shots/dashboard-1920x1080.png
  s5-xp14.json / s5-default.json
  digest-*.txt
  purity.txt
  tests.log
  watch-e2e.log
```

## Constant edits

**None.** Defaults unchanged. No silent retune.
