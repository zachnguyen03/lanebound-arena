# s3-acceptance changelog

## v4 — type-only TS2559 fix (23 Nov 2026)

- `03-zone.test.ts`: widen the `lost()` helper parameter with an index signature so `SimEvent` type-checks under `npx tsc --noEmit` (TS2559 at L317–318). No assert changes.

## v3 — triage of tip 358e83c (23 Nov 2026)

Fixture-only fixes after the S3 build at `358e83c` stopped on 6 questions (144/152). No assert was loosened to match a wrong sim. Write-up: `lab/s3-acceptance/TRIAGE-358e83c.md` (not in the official tarball).

### Tests / harness changed

- `03-zone.test.ts` / `10-gd-rulings-r5.test.ts`: empty-bar banish moves from tick 20 to 21 (G8 same-tick occupancy). 20 exclusive + 10 empty still pins bar 10.
- `10-gd-rulings-r5.test.ts`: 119+contest first banish duration is 14.75 (covers ticks 1–148 when a new CC is not ticked on the apply tick). Ownership-flip timer fixture uses first-banish `4.95` and ends at `T: 8.0` (Red's capture tick), not 9.0. Fear / hex / leash (and the rest of the G7 table) apply on the pickup tick so a solo hex cannot walk to its own pad first; the buff fear case applies on its pickup tick too. The 2–2 then 3–2 win fixture sets `SPAWN_SHIELD_S: 0` so the re-kill does not need a silent pierce.
- `01-match-end.test.ts` and the S3-R5-2 log-order fixture: bodies stand outside the pit so the scripted claim is awarded, not denied.
- `05-orbs-buffs.test.ts`: +10% MS walk is a long diagonal ended mid-path (`T: 3.0`, spawn 0.1) so both units do not finish the same short path.
- `_harness.ts` / `_contract.md`: `sim_until` is set from scenario `T` (run cap). `scripted_damage` does not pierce the spawn shield.

## v2 — Appendix R #5 (23 Nov 2026)

Game Designer ruled OQ-S3-1..12 as S3-R5-1..10 (build spec L1932–L1972; edited lines L146, L303, L311, L313; edit note L1972). `lab/s3-acceptance/OPEN-QUESTIONS.md` is on the box (the path L1934 cites) and each item is marked resolved with its ruling line. The same file is in the official pack.

### Tests added

- `10-gd-rulings-r5.test.ts`: every R #5 ruling, cited by line. Independent bars with 1.0/s drain and integer ticks (30 → capture, 20 then 1 → 19/1, 120 → one `zone_tick`, 119 + contest + 1, owner bar held at 0, flip resets `tick_timer`); phase-14 single decision (sudden-death trades cancel, same-team events lead, log order, `first_to_10` precedes clock); catch-up from a tick-start snapshot over all five enemies, folded into one `xp_gain` (138 / 1.3225, no `catchup` source); CC'd units occupy, banished/dead don't; G7 pickup once in phase 11 with no swept path, orbs and buffs; Bo1 +15 s reason `sudden_death`, ladder once at 270, `coin_flip` at 285, `tiebreak` counter unchanged; aura one tick after `zone_capture`; dwell `N = max(1, round(dwell×10))` plus additive `claim_deny.deniers` (no exact-key assert); per-player `zone_seconds` and Σ ≥ `control_time`; win needs ≥ 10 and strictly ahead (10–10 continues; a 3-with-cap-2 is still `first_to_10`).

### v1 tests changed

- `03-zone.test.ts`: progress is read via `barTicks`; the leftover-progress case now asserts the 19/1 drain (S3-R5-1). OQ-S3-1 wording is gone.
- `05-orbs-buffs.test.ts` / `06-xp-respawn.test.ts`: catch-up is the folded event (138 / 1.3225, no `source:"catchup"`). `XP_TO_LEVEL` is confirmed by Anh (L5=820); the "pending" flag is dropped.
- `_contract.md`: `claim_deny.deniers`, required `zone_seconds`, `rng_counters.tiebreak`, lab `unit_overrides.ms`, integer-tick bars exposed as seconds, strictly-ahead win, `catchup` never emitted.
- `_harness.ts`: `barTicks` / `timerTicks` / `deniersOf` / `zoneSecondsOf` / `streamCounter`, and lab `ms`.

### Docs

- `OPEN-QUESTIONS.md` resolved. `DEFERRED.md` notes that a series-map-draw `match_end` at 4:30 is out of sandbox S3 (Bo1 only); §4.4 has `winner: draw` but no reason enum for it.

## v1 — initial verifier pack (23 Nov 2026)

S3 acceptance for scoring, zone, claims, orbs, buffs, XP / respawn, full-match end conditions, two-process determinism, and the AI-off S1 digest regression. Written against the S1 `2cdcf26` public API plus the minimal additions in `_contract.md`. Assertions cite a spec section and line number. No rules were invented; silences went to `OPEN-QUESTIONS.md`.
