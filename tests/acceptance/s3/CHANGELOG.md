# s3-acceptance changelog

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
