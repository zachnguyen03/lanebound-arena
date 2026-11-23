# s2-acceptance-v6

Verifier-owned S2 suite. Additive over the sim: does not modify `tests/acceptance/s1/` or any sim / data file. v1→v6 edits are listed in CHANGELOG.md.

Sources: build spec §5.6, §8.3–8.4, §9, §12, Appendix R G9, R #3 (L1911–1922), R #4 (L1924–1930), sandbox spec §11 S2, plan §1 and §8.4 S2 extras. Written against the S1 `2cdcf26` public API plus the R #3 / R #4 names.

v6 changes: `configOf` defaults `ai_enabled` on (M2-20..24 L1734–1737, R #3 S2-4 L1916). Four labs are skipped, deferred to post-game polish (Anh 19:30); their bodies are unchanged. The disengage-follow check in `10` (R #4 S2-R4-2 L1926) stays live.

## Test count by area (v6)

Counted as vitest `it(...)` / `it.each` / `it.skip` cases, including `it` inside `describe.skip` (those do not run). `it.each` with 3 hysteresis rows counts as 3.

| Area | File | Runnable | Skipped (deferred) |
|---|---|---:|---:|
| Fight Call / fight declaration | `01-fight-call.test.ts` | 10 | 0 |
| Chase stops (sanctuary, 10-tile leash, est_ttk > 2) | `02-chase-stops.test.ts` | 4 | 0 |
| Auto-peel + dive event + 400-game preview | `03-auto-peel.test.ts` | 8 | 1 |
| Digest with AI on; intent only-on-change / in-digest | `04-digest-ai.test.ts` | 6 | 0 |
| Attribute hooks (mastery, Execution, Positioning, Teamwork) | `05-attribute-hooks.test.ts` | 5 | 0 |
| Unit Brain gates (G3, Lock, WalkFromPad) | `06-unit-brain.test.ts` | 3 | 0 |
| Targeting ward | `07-targeting-ward.test.ts` | 2 | 0 |
| Deferred S3 / M6 stubs | `08-deferred-s3.test.ts` | 0 | 6 |
| Appendix R #3 rulings | `09-gd-rulings-r3.test.ts` | 16 | 1 |
| Appendix R #4 rulings (reach, S2-R4-4 focus_id, follow-call, Teamwork isolation) | `10-gd-rulings-r4.test.ts` | 7 | 0 |
| Probe gaps (Focus ×1.25, Lock ×1.25, hold_R vs auto) | `11-probe-gaps.test.ts` | 2 | 1 |
| Held-out survivor gaps | `12-survivor-gaps.test.ts` | 9 | 0 |
| Anti-tuning (HP floor, scripted_casts AI gate, pad scorer, default-Decision dive) | `13-anti-tuning.test.ts` | 4 | 1 |
| **Total** | | **76** | **10** |

Of the 10 skipped: 6 are the existing S3 / M6 stubs in `08-deferred-s3.test.ts`; 4 are post-game polish (Anh 19:30) listed in `DEFERRED.md`.

Runnable tests that need S2 AI or the new S2 API shape are expected to **fail** on `2cdcf26`. The disengage-follow behaviour check in `10` is live and is expected to fail on a tip that does not always follow a disengage call (R #4 S2-R4-2 L1926). A hard Focus override remains a defect (needle S2R30).

Open leftovers and deferred items: `OPEN-QUESTIONS.md`, `DEFERRED.md`.
