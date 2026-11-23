# S5 Report — Batch, dashboard, tuning panel, isolation runner

**Branch:** `s5`  
**Base:** `cursor/s4-watch-f8c1` @ `e427530ed56e8a8d53939922460168332f28c562`  
**Tip:** `800df02013cc5d376f5e1209b5c669117fa9dc8f` (`800df02`)

**Date:** 23 Nov 2026  

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

# Isolation six deltas (preview N=50; claim band needs --n 400)
npm run isolation -- --n 50 --out lab/s5/isolation
# Full claim-size command PM can run:
# npm run isolation -- --n 400 --out lab/s5/isolation400
```

## Official 2,000-game even lab (`evenOvrConfig`, Hold, seeds 20261122…)

| Metric | Value | Target | Mark |
|---|---|---|---|
| Length median | **104.4 s** (p10 77.2, p90 177.0) | 210–270 s | **fail** |
| Zone share of winner's score | **51.8%** | 30–40% | **fail** |
| Auto-peel | **96.3%** (fired 3194 / eligible 3317) | ≥ 70% | **pass** |
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
4. **Attribute isolation (N=50/arm, under-powered):** five attrs +0.0 pp, positioning +2.0 pp on Blue ADC +30 from a 60-floor. Control blue win% is 2% (kit lean dominates). Mastery 50→90 on **all** players moved blue win 2%→44% (+42 pp) — surprising for a symmetric buff; likely kit×mastery interaction under the lean. Re-run with `--n 400` before claiming the +3–6 pp band. **No constants changed.**

## Isolation (six deltas)

```bash
npm run isolation -- --n 50 --out lab/s5/isolation
```

| Attr | Δ pp (blue win) | N |
|---|---:|---:|
| aim | +0.0 | 50 |
| reflexes | +0.0 | 50 |
| execution | +0.0 | 50 |
| decision | +0.0 | 50 |
| positioning | +2.0 | 50 |
| teamwork | +0.0 | 50 |

Mastery 50→90: **+42.0 pp** (n=50). Output: `lab/s5/isolation/isolation-results.json`.

## Acceptance map

| ID | Result |
|---|---|
| B1 | Cancel at 20 → `lab/s5/cancel/` (n_finished=20). Full 100 rerun digests stable (`tests/s5-batch.test.ts`). |
| B2 | `--n 1000` accepted by `clampBatchN`; 2000 lab ran (~5.3 min @ ~6.2 games/s). |
| B3 | Static check: `apps/lab/**` does not import `@watch` / canvas. |
| T1–T4 | `tests/s5-tuning.test.ts` — illegal `ZONE_TICK_S=7` rejected; staged mid-match edit keeps digest; preset round-trip; defaults == `DEFAULT_CONSTANTS` / §15. |
| D1–D4 | Dashboard rows + CSV/JSON; isolation deltas; sanctuary fail fixture; screenshots `lab/s5/shots/dashboard-{1280x720,1920x1080}.png`. |

## Known deferred (not fixed; visible in this lab)

| Issue | Where it shows |
|---|---|
| Melee idling under a hold commit | `sim/ai/brain.ts` engage gate — Hold even lab still has melee champions with sparse auto `hit`s (S4 note). |
| No `cast_start` telegraph | Even Hold emits 0 `cast_start` on gold seeds; Watch cannot draw skill telegraphs from that event. |
| Side lean (kit×side) | 2000-game blue kit win ~13% / red ~87%; see `lab/s3/side-lean/REPORT.md`. Isolation control blue win 2% at attrs=60. |

## Inventories / assumptions

- **Batch runner = Node CLI first** (sandbox plan §3.1 / Anh). In-browser Lab UI loads CLI JSON; does not re-implement 2,000-game workers.
- **Archetype tags** (§6.5.1 proposal): nearest class-mix neighbour; distance > 2 → Other.
- **Quick draft** for `random_draft` scheme: lab-local xorshift shuffle (not sim RNG stream `draft`) — flagged.
- **Tuning panel** lists every §15 key. Keys not in `sim/constants.ts` (`OVR_WEIGHTS`, `REACTION_*`, …) are shown as `sim-hardcoded` / non-editable (editing `sim/` is out of S5 scope). `CONTROL_COEF` retired. GD extras (`SEPARATION_*`, `SPAWN_SLOT_SPACING`) editable.
- **Peel denominator** = `ai_stats.dive_geom` (perceived geometric dives), matching S2 counters.
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
