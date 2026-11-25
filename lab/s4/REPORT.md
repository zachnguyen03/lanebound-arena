# S4 Report — Watch

**Branch:** `cursor/s4-watch-f8c1`  
**Base:** `s0` @ `1caa5eb`  
**sim merged from:** `origin/s3` @ `34f488b`  
**Code tip:** `e427530` (`e427530ed56e8a8d53939922460168332f28c562`)  
**Date:** 23 Nov 2026  

Desktop-only Watch. `sim/` is the `34f488b` tree. The bundled sample digest is the current quiet gold `7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f`. Tip `e427530` adds skill icons (replacing skill ids) on top of the earlier `829f769` Watch pass.

## Gates

| Command | Exit |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npm test` | 0 (1405 passed, 11 skipped) |
| `npm run purity` | 0 |
| `npm run watch:build` | 0 |
| `npm run watch:e2e` | 0 (31 passed) |

## QA of 3ae791e

- `vite.config.ts` no longer rewrites chunk strings. Clock-end errors are Watch `ConfigError` sentences. The even preset note is `Even match`, set in `apps/watch/src/lib/live-match.ts`. A dist grep for `S3-R5`, `S1 even default`, and `AI opt-in` is 0.
- Melee attack clips are not a Watch mapping miss. On seeds 20261122 and 20261123, Brannoch, Kerrig, Rhedan, and Tolle are the source of 0 `hit` and 0 `projectile_spawn` events across 772 ticks. Ranged autos (`skill_id: "auto"`) are the only hits. `sim/` was not changed.
- Telegraphs are not drawn. The plan (`lol-manager/eng/sandbox-plan-v1.md`) asks the Watch to blit generic telegraph shapes. The even default emits 0 `cast_start` events on both seeds, and that event is what carries `skill_id` and `cast_time`. Nothing was invented.
- Huntress and Sedge compact frames are 24×24 files drawn at 24px (`portrait/portrait-24.png`). The narrow rail does not fall back to the 64px portrait. Those two files are not pack bytes. `lanebound-champion-art-v1` has no `portrait-24.png`, `portrait-ui-24.png`, `{slug}-24.png`, or `{slug}-ui-24.png` for Huntress or Sedge (MANIFEST lists only the 64/128/256 pixel portraits and the painted 64 / ui-64). The other twelve champions' `portrait-24.png` and `portrait-ui-24.png` match the pack byte for byte. These two were nearest-neighbour scaled from `portraits/painted/{slug}/{slug}-64.png` (`ffmpeg scale=24:24:flags=neighbor`) because 64 is not an integer multiple of 24 and the pack has nothing to `cmp`. Huntress sha256 `ba24ed46ccb19de3a0ff6d882eb566bdcc3b7cb61815694a587d7d736fa1beaf` (1221 bytes). Sedge sha256 `1cdfc4b14bc0bb243c40333770e092e53f4ad9384d0d3eeaec6f62549e31fb1b` (1333 bytes).

## What changed in this pass

- Production dist no longer rewrites `placeholder` to `fieldhint`. `::placeholder`, `placeholder=` attributes, and Tailwind's own placeholder tokens are allowed. Any other hit fails the build.
- The event log hides `pos` and `move` outside dev builds.
- Dock titles stay on one line (no letter-spacing wrap).
- The death strip sits above the dock, fully inside the viewport.
- Champion bodies and team-frame portraits come from `apps/watch/public/champions/`. Mid-fight frames: `lab/s4/final/shots/watch-1280x720-mid.png` and `lab/s4/final/shots/watch-1920x1080-mid.png`.

Live digests are unchanged: 20261122 `54cae20c950a238d5c06a8324076cf2febe429d8dfe8b2c2057232fdf33f6b0d`, 20261123 `74d9794affef09962673f97a0ef1aaf934cc8f58116193c044ef6cad6f21f425`.
