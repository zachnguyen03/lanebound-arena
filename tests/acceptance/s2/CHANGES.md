# s2-acceptance-v3

Verifier-owned S2 suite, updated for Appendix R #4 (23 Nov 2026). Additive over the sim: does not modify `tests/acceptance/s1/` or any sim / data file. v1→v3 edits are listed in CHANGELOG.md.

Sources: build spec §5.6, §8.3–8.4, §9, §12, Appendix R G9, R #3 (L1909–1920) and R #4 (L1924–1927), sandbox spec §11 S2, plan §1 and §8.4 S2 extras. Written against the S1 `2cdcf26` public API plus the R #3 names (`a_commit`, `shotcaller_id`, `dive`, `combo_style: "hold_R"`, Focus, `secondary`). New names are expected to type-error on `2cdcf26` until S2 lands; see README.

## Test count by area (v3)

Counted as vitest `it(...)` / `it.each` cases, including `it` inside `describe.skip` (those do not run). `it.each` with 3 hysteresis rows counts as 3.

| Area | File | Runnable | Skipped (deferred) |
|---|---|---:|---:|
| Fight Call / fight declaration | `01-fight-call.test.ts` | 10 | 0 |
| Chase stops (sanctuary, 10-tile leash, est_ttk > 2) | `02-chase-stops.test.ts` | 3 | 0 |
| Auto-peel + dive event + 400-game preview | `03-auto-peel.test.ts` | 7 | 0 |
| Digest with AI on; intent only-on-change / in-digest | `04-digest-ai.test.ts` | 5 | 0 |
| Attribute hooks (mastery, Execution, Positioning, Teamwork) | `05-attribute-hooks.test.ts` | 5 | 0 |
| Unit Brain gates (G3, Lock, WalkFromPad) | `06-unit-brain.test.ts` | 3 | 0 |
| Targeting ward | `07-targeting-ward.test.ts` | 2 | 0 |
| Deferred S3 / M6 stubs | `08-deferred-s3.test.ts` | 0 | 6 |
| Appendix R #3 rulings | `09-gd-rulings-r3.test.ts` | 14 | 0 |
| Appendix R #4 rulings (reach, follow-call, Teamwork isolation) | `10-gd-rulings-r4.test.ts` | 5 | 0 |
| **Total** | | **54** | **6** |

Runnable tests that need S2 AI or the new S2 API shape are expected to **fail** on `2cdcf26`. On an S2 tip that has not yet taken R #4, the new reach / follow-call / near-pad tests are the ones that should go red.

Open leftovers and deferred items: `OPEN-QUESTIONS.md`, `DEFERRED.md`.
