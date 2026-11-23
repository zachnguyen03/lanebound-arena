# s2-acceptance-v1

First verifier-owned S2 suite. Additive: does not modify `tests/acceptance/s1/` or any sim / data file.

Sources: build spec §5.6, §8.3–8.4, §9, §12, Appendix R G9, sandbox spec §11 S2, plan §1 and §8.4 S2 extras. Written against the S1 `2cdcf26` public API.

## Test count by area (v1)

Counted as vitest `it(...)` cases, including `it` inside `describe.skip` (those do not run).

| Area | File | Runnable | Skipped (deferred) |
|---|---|---:|---:|
| Fight Call / fight declaration | `01-fight-call.test.ts` | 9 | 0 |
| Chase stops | `02-chase-stops.test.ts` | 2 | 0 |
| Auto-peel + 400-game preview | `03-auto-peel.test.ts` | 5 | 0 |
| Digest with AI on | `04-digest-ai.test.ts` | 3 | 0 |
| Attribute hooks (mastery, Execution, Positioning, Teamwork) | `05-attribute-hooks.test.ts` | 5 | 0 |
| Unit Brain gates (G3, Lock, WalkFromPad) | `06-unit-brain.test.ts` | 3 | 0 |
| Targeting ward | `07-targeting-ward.test.ts` | 2 | 0 |
| Deferred S3 / M6 stubs | `08-deferred-s3.test.ts` | 0 | 6 |
| **Total** | | **29** | **6** |

Runnable tests that need S2 AI are expected to **fail** on `2cdcf26`. Determinism (`04`) and “no `fight_call` on tick 0 / in a 1v1” may already pass (the S1 sim emits neither). Positive `fight_call` / `peel_start` / chase / WalkFromPad / hook tests are the ones that should go red until S2.

Open questions and deferred items: `OPEN-QUESTIONS.md`, `DEFERRED.md`.
