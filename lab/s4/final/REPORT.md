# S4 final — Watch (live match)

**Branch:** `cursor/s4-watch-f8c1`  
**Tip:** follow-ups after `18905ef` (archive name is this tip)  
**Base merged:** `origin/s3` @ `47f1002` (QA tip cited as `b25a000`; this head is newer and was re-fetched before archive)  
**sim/:** not modified by Watch. Digest is `simulate(evenOvrConfig(seed))`.

## Commands

| Command | Exit |
|---|---|
| `npx tsc --noEmit` | 0 (re-run after the verify fixes) |
| `npx tsc -p apps/watch/tsconfig.json --noEmit` | 0 |
| `npm test` | 0 (1393 passed, 10 skipped) |
| `npm run purity` | 0 |
| `npm run watch:build` | 0 |
| `npm run watch:e2e` | 0 (21 passed) |

Port 4173 was closed before the e2e (`ss` is not on this machine; `netstat -ltnp` showed no listener).

## Verify fixes after 18905ef

- The fallbacks panel shows `liveDigest` (the CLI digest), not the debug-position tape.
- Missing champion art treats an HTML 200 as missing: content-type, then JSON parse or image decode. `missing-art.spec.ts` expects the 20 paths.
- On-screen copy no longer uses internal names. The clock-end check uses the file input. A bad JSON file replaces that error. Design markdown is not copied into `dist/`.
- The 720 drawer no longer sets `aria-modal`. The dim layer does not take pointer events, so the transport stays clickable.

```
rg -n "TODO|FIXME|placeholder|S3-R5|evenOvrConfig|canonical S0" apps/watch/dist
```

No matches. Seven `\bS[0-5]\b` hits in the bundle are minified names (`function S0`, `function S1`, `function S2`).

## What Watch runs

`evenOvrConfig(seed, "hold_the_pit")` via `loadMatchConfig`: AI on, `forced_clock_end: false`. A second `simulate` with `debug_pos: true` is the view tape only. `debug_pos` shifts `event_seq` inside projectile ids, so the **reported digest is the debug_pos-off run**, which matches the CLI. AI overlay lines are canvas-only and are not passed into `simulate`.

| Seed | Digest | `match_end` |
|---|---|---|
| 20261122 | `54cae20c950a238d5c06a8324076cf2febe429d8dfe8b2c2057232fdf33f6b0d` | `first_to_10` red 10–0 at t=77.2 |
| 20261123 | `74d9794affef09962673f97a0ef1aaf934cc8f58116193c044ef6cad6f21f425` | (differs from 20261122) |
| reimport of exported JSON | same as 20261122 | |

## Acceptance (sandbox spec §6, quoted)

> W1. A Watch match of seed `20261122` with the default even config (below) reaches `match_end` without a crash, at 1× and at 8×, and with pause + 20 single steps in the first 10 s.

Proof: `apps/watch/src/lib/live-match.test.ts` and `e2e/s4-live.spec.ts` (pause, 20 steps, speed control hittable, `data-match-end=first_to_10`).

> W2. Overlay-on and overlay-off do not change the digest (overlays are view-only).

Proof: digest above is `cliDigest` with no overlay input. E2e toggles `btn-toggle-overlays` after the digest attribute is already set; `data-digest` is not recomputed.

> W3. Jumping to a death tick, then pressing play, continues the *same* match (same subsequent digest prefix).

Proof: death row calls `jump(tick)` on the same `ReplayEngine` event tape. Digest is of the full log, not a second sim.

> W4. Authored Huntress (and at least one melee champ) faces, animates idle / walk / attack, and shows a telegraph on a scripted Q. If an art file is deleted in a test harness, the unit falls back to a labelled circle and the match still ends.

Proof: no `champions/{slug}/` tree is in the repo. Missing list: `lab/s4/final/missing-assets.md`. Loader normalises both `animations.idle["blue-right"]` and `animations.idle.blue.right` (`normalizeChampAtlas`). Units draw a labelled circle (champ slug), not the training dummy. The match still reaches `first_to_10`.

> W5. Screenshot proof: one mid-fight frame at 2× with overlays on, one HUD-wide frame showing score / clock / team frames.

Proof: `lab/s4/final/watch-1920x1080-mid.png`, `watch-1920x1080-end.png`, `watch-1280x720-mid.png`, `watch-1280x720-end.png` (also 1440).

> L1. In a scripted dive, a `peel_start` (or a logged skip with reason) appears on the peeler; death-click on a successful dive or a peeled dive opens both 5 s strips.

Proof: `deathDecisionStrip` keeps killer and victim decision events with `t` in `[death-5s, death]`. E2e clicks a `death` row and expects `decision-strip`. This even-OVR match is not a scripted dive fixture; the strip is the last 5 s of `intent` / `fight_call` / `peel_start` for those two units.

> L2. Filters hide other units; clearing them restores the stream.

Proof: `filterDecisions` + `decision-filter` input. Unit test filters to `red:adc`.

> L3. Same seed → same `decisions_digest`.

Proof: two `cliDigest(20261122)` calls match (`live-match.test.ts`). Decision events are inside that event log. There is no separate decisions stream on `SimulateResult` (Watch does not modify `sim/`).

> L4. Jump from a log row sets Watch to that tick (W3).

Proof: kill-feed death click sets the scrub tick to that death.

> R1. Two runs with the same seed and no extra pins produce identical lineups, attrs, and digest.

Proof: `cliDigest(20261122)` twice is identical; `evenOvrConfig` lineups are the fixed even picks.

> R2. Pinning `attrs.all = 60` and Blue ADC Aim `= 90` is visible in the exported config and in the isolation runner.

Proof: not a Watch pin UI. Exported JSON is the resolved `evenOvrConfig` (attrs 70, mastery default, `hold_the_pit`). Isolation runner is S5.

> R3. Pinning a Peel vs Dive pair produces those class mixes (§6.5.1) on both sides.

Proof: not implemented. Live Watch uses the fixed even lineups (brannoch/sedge/kerrig/huntress/ysol vs rhedan/tolle/helvar/maelis/saelo), not archetype pins.

> R4. Exported JSON from a Watch match, loaded as the config, replays the same digest.

Proof: `exportConfigJson` → `importConfigJson` → `simulate` digest equals `54cae20c…` (`live-match.test.ts`). UI: Export config writes `exported-config`. `loadMatchConfig({seed:1})` without `forced_clock_end` throws; the shell shows `config-error`.

## Hit tests

`elementFromPoint` plus full viewport bounds, drawer open, including both rails and the overlay toggle:

- 1920×1080 (push column, no translate)
- 1280×720 (modal)
- 1440×900 (modal)
- 1280×800 (modal, earlier gate)

Overlay open: same controls at 1920, 1440, and 1280 in `s4-live.spec.ts`.

## Art

Nearest-neighbour blit (`imageSmoothingEnabled = false`) when an atlas loads. Until the champion folders are present, every drafted slug is on the missing-asset list.
