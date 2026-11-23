# S4 final — Watch (live match)

**Branch:** `cursor/s4-watch-f8c1`  
**Base:** `s0` @ `1caa5eb`  
**sim merged from:** `origin/s3` @ `34f488b` (`sim/` byte-identical to that tree)  
**Code tip:** `829f769`  
**Sample digest:** `7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f`

## Gates

| Command | Exit |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npx tsc -p apps/watch/tsconfig.json --noEmit` | 0 |
| `npm test` | 0 (1404 passed, 11 skipped) |
| `npm run purity` | 0 |
| `npm run watch:build` | 0 |
| `npm run watch:e2e` | 0 (29 passed) |

## Fixes

1. **Art.** Fourteen champions under `apps/watch/public/champions/`. Bodies blit from the 1× atlas at 2× (36×48) with nearest-neighbour. Idle, walk, attack, cast, and death play from the atlas; blue faces right and red faces left unless movement turns them. Team frames use the 64px portrait at 1920 and the 24px portrait at 720 and 1440, both at an integer scale. At 1920, Huntress and Sedge blue frames use `portraits/painted/{slug}/{slug}-64.png`. At 1280 and 1440 they use `portrait/portrait-24.png` (24×24), not the painted 64. The pack has no 24px file for either slug, so those two are nearest-neighbour scales of the painted 64 (`ffmpeg scale=24:24:flags=neighbor`). 64 is not an integer multiple of 24, and there is no `{slug}-24.png` or `{slug}-ui-24.png` in `lanebound-champion-art-v1` to copy. The other twelve `portrait-24.png` and `portrait-ui-24.png` files match the pack byte for byte. Huntress `portrait-24.png` sha256 `ba24ed46ccb19de3a0ff6d882eb566bdcc3b7cb61815694a587d7d736fa1beaf`. Sedge `portrait-24.png` sha256 `1cdfc4b14bc0bb243c40333770e092e53f4ad9384d0d3eeaec6f62549e31fb1b`. Maelis `status.slow.file` resolves to `vfx/slow.png`. The missing-art list is hidden for the even lineup (`missing-art.spec.ts`). Proof: `lab/s4/final/shots/watch-1280x720-mid.png`, `lab/s4/final/shots/watch-1920x1080-mid.png`.
2. **Dist grep.** `distHygiene` no longer rewrites `placeholder` to `fieldhint`. `::placeholder`, `placeholder=` attributes, and Tailwind's placeholder tokens stay. Any other hit fails `watch:build`.
3. **Event log.** `pos` and `move` stay out of the production log. `event-log.spec.ts` finds no Position or Move rows.
4. **Reports.** This file and `lab/s4/REPORT.md` name code tip `829f769`, base `1caa5eb`, sim `34f488b`, and the gate counts above.
5. **Dock titles.** No letter-spacing. Titles are one line at 1280×720, 1440×900, and 1920×1080 (`dock-titles.spec.ts`).
6. **Death strip.** Opens above the dock. `decision-strip.spec.ts` checks the viewport rect and `elementFromPoint` at the strip centre, and the transport controls still hit.

## Digests (unchanged)

| Seed | Digest | `match_end` |
|---|---|---|
| 20261122 | `54cae20c950a238d5c06a8324076cf2febe429d8dfe8b2c2057232fdf33f6b0d` | `first_to_10` red 10–0 at t=77.2 |
| 20261123 | `74d9794affef09962673f97a0ef1aaf934cc8f58116193c044ef6cad6f21f425` | differs from 20261122 |
| reimport | same as 20261122 | |

Overlays are canvas-only. The reported digest is the `debug_pos: false` run.

## QA of 3ae791e

- Bundle text is not rewritten. `distHygiene` only deletes markdown and fails the build on a stray `placeholder`. User-facing clock-end text is the Watch `ConfigError` (`This match file needs a clock-end setting, true or false.` / `The clock-end setting must be true or false.`). The exported note is `Even match`.
- Melee: Brannoch, Kerrig, and Rhedan source 0 attack events in 772 ticks on seeds 20261122 and 20261123 (also Tolle). Event totals for 20261122: 226 `hit`, 230 `projectile_spawn`, 0 `cast_start`. Every `hit` is `skill_id: "auto"` from Huntress, Sedge, Ysol, Helvar, Maelis, or Saelo. Closest Brannoch comes to an enemy on the `debug_pos` tape is 4.15, against range 1.5, so `pickAutoTarget` in `sim/combat.ts` never starts a windup. Same pattern for Kerrig (min 4.38), Rhedan (5.20), Tolle (5.41). Seed 20261123: 221 `hit`, 223 `projectile_spawn`, 0 `cast_start`, and the same four melee champions source none of them. Watch already maps `hit` + `auto` onto the attack clip. `sim/` was not edited.
- Telegraph: sandbox plan line 187 says the Watch blits telegraphs; line 294 names line, circle, cone, dash streak, and impact spark. `cast_start` is the event that carries `unit_id`, `skill_id`, and `cast_time` (`sim/cast.ts` `beginCast`). The even default emits 0 of them on both seeds, so no telegraph is drawn.
- Compact portraits: `champions/huntress/portrait/portrait-24.png` and `champions/sedge/portrait/portrait-24.png` are 24×24, drawn at 24 CSS px with `image-rendering: pixelated`. `TeamRail` uses that file only when its natural size is 24.

## Not in this pass

R2 attribute pins and R3 Peel-vs-Dive pins. No deploy. No edits under `sim/` or `tests/acceptance/**`.
