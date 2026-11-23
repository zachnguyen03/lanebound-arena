# S4 final — Watch (live match)

**Branch:** `cursor/s4-watch-f8c1`  
**Base:** `s0` @ `1caa5eb`  
**sim merged from:** `origin/s3` @ `34f488b` (`sim/` byte-identical to that tree)  
**Code tip:** `795ee10`  
**Sample digest:** `7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f`

## Gates

| Command | Exit |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npx tsc -p apps/watch/tsconfig.json --noEmit` | 0 |
| `npm test` | 0 (1402 passed, 11 skipped) |
| `npm run purity` | 0 |
| `npm run watch:build` | 0 |
| `npm run watch:e2e` | 0 (29 passed) |

## Fixes

1. **Art.** Fourteen champions under `apps/watch/public/champions/`. Bodies blit from the 1× atlas at 2× (36×48) with nearest-neighbour. Idle, walk, attack, cast, and death play from the atlas; blue faces right and red faces left unless movement turns them. Team frames use the 64px portrait at 1920 and the 24px portrait at 720, both integer. Huntress and Sedge blue frames prefer `portraits/painted/{slug}/{slug}-64.png`. Maelis `status.slow.file` resolves to `vfx/slow.png`. The missing-art list is hidden for the even lineup (`missing-art.spec.ts`). Proof: `lab/s4/final/shots/watch-1280x720-mid.png`, `lab/s4/final/shots/watch-1920x1080-mid.png`.
2. **Dist grep.** `distHygiene` no longer rewrites `placeholder` to `fieldhint`. `::placeholder`, `placeholder=` attributes, and Tailwind's placeholder tokens stay. Any other hit fails `watch:build`.
3. **Event log.** `pos` and `move` stay out of the production log. `event-log.spec.ts` finds no Position or Move rows.
4. **Reports.** This file and `lab/s4/REPORT.md` cite `795ee10`, base `1caa5eb`, sim `34f488b`, and the gate counts above.
5. **Dock titles.** No letter-spacing. Titles are one line at 1280×720, 1440×900, and 1920×1080 (`dock-titles.spec.ts`).
6. **Death strip.** Opens above the dock. `decision-strip.spec.ts` checks the viewport rect and `elementFromPoint` at the strip centre, and the transport controls still hit.

## Digests (unchanged)

| Seed | Digest | `match_end` |
|---|---|---|
| 20261122 | `54cae20c950a238d5c06a8324076cf2febe429d8dfe8b2c2057232fdf33f6b0d` | `first_to_10` red 10–0 at t=77.2 |
| 20261123 | `74d9794affef09962673f97a0ef1aaf934cc8f58116193c044ef6cad6f21f425` | differs from 20261122 |
| reimport | same as 20261122 | |

Overlays are canvas-only. The reported digest is the `debug_pos: false` run.

## Not in this pass

R2 attribute pins and R3 Peel-vs-Dive pins. No deploy. No edits under `sim/` or `tests/acceptance/**`.
