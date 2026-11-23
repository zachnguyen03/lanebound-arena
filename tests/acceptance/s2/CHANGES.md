# s2-acceptance-v2

Verifier-owned S2 suite, updated for Appendix R #3 (23 Nov 2026). Additive over the sim: does not modify `tests/acceptance/s1/` or any sim / data file. v1→v2 edits are listed in CHANGELOG.md.

Sources: build spec §5.6, §8.3–8.4, §9, §12, Appendix R G9 and R #3 (L1909–1920), sandbox spec §11 S2, plan §1 and §8.4 S2 extras. Written against the S1 `2cdcf26` public API plus the R #3 names (`a_commit`, `shotcaller_id`, `dive`, `combo_style: "hold_R"`, Focus, `secondary`). New names are expected to type-error on `2cdcf26` until S2 lands; see README.

## Test count by area (v2)

Counted as vitest `it(...)` / `it.each` cases, including `it` inside `describe.skip` (those do not run). `it.each` with 3 hysteresis rows counts as 3.

| Area | File | Runnable | Skipped (deferred) |
|---|---|---:|---:|
| Fight Call / fight declaration | `01-fight-call.test.ts` | 9 | 0 |
| Chase stops (sanctuary, 10-tile leash, est_ttk > 2) | `02-chase-stops.test.ts` | 3 | 0 |
| Auto-peel + dive event + 400-game preview | `03-auto-peel.test.ts` | 7 | 0 |
| Digest with AI on; intent only-on-change / in-digest | `04-digest-ai.test.ts` | 5 | 0 |
| Attribute hooks (mastery, Execution, Positioning, Teamwork) | `05-attribute-hooks.test.ts` | 5 | 0 |
| Unit Brain gates (G3, Lock, WalkFromPad) | `06-unit-brain.test.ts` | 3 | 0 |
| Targeting ward | `07-targeting-ward.test.ts` | 2 | 0 |
| Deferred S3 / M6 stubs | `08-deferred-s3.test.ts` | 0 | 6 |
| Appendix R #3 rulings (timing, fields, delays, hyst, hold_R / Focus, hex pad) | `09-gd-rulings-r3.test.ts` | 14 | 0 |
| **Total** | | **48** | **6** |

Runnable tests that need S2 AI or the new S2 API shape are expected to **fail** on `2cdcf26`. Determinism (`04` identity), “no `fight_call` on tick 0 / in a 1v1”, and the hexed-to-pad-centre case (S1 motor) may already pass. Positive `fight_call` / `peel_start` / `dive` / chase / WalkFromPad / hook / delay / hysteresis tests should go red until S2.

Open leftovers and deferred items: `OPEN-QUESTIONS.md`, `DEFERRED.md`.
