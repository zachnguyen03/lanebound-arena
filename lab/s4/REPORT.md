# S4 Report — Watch

**Branch:** `cursor/s4-watch-f8c1`  
**Base:** `s0` @ `1caa5eb`  
**sim merged from:** `origin/s3` @ `34f488b`  
**Code tip:** `795ee10` (this note is the following commit)  
**Date:** 23 Nov 2026  

Desktop-only Watch. `sim/` is the `34f488b` tree. The bundled sample digest is the current quiet gold `7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f`.

## Gates

| Command | Exit |
|---|---|
| `npx tsc --noEmit` | 0 |
| `npm test` | 0 (1402 passed, 11 skipped) |
| `npm run purity` | 0 |
| `npm run watch:build` | 0 |
| `npm run watch:e2e` | 0 (29 passed) |

## What changed in this pass

- Production dist no longer rewrites `placeholder` to `fieldhint`. `::placeholder`, `placeholder=` attributes, and Tailwind's own placeholder tokens are allowed. Any other hit fails the build.
- The event log hides `pos` and `move` outside dev builds.
- Dock titles stay on one line (no letter-spacing wrap).
- The death strip sits above the dock, fully inside the viewport.
- Champion bodies and team-frame portraits come from `apps/watch/public/champions/`. Mid-fight frames: `lab/s4/final/shots/watch-1280x720-mid.png` and `lab/s4/final/shots/watch-1920x1080-mid.png`.

Live digests are unchanged: 20261122 `54cae20c950a238d5c06a8324076cf2febe429d8dfe8b2c2057232fdf33f6b0d`, 20261123 `74d9794affef09962673f97a0ef1aaf934cc8f58116193c044ef6cad6f21f425`.
