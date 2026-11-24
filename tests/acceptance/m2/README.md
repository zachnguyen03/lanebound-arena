# M2 cast-policy / K-2 acceptance (s6-acceptance)

Verifier-owned tests for **M2-25 … M2-37** (cast policy, §9.4.1) and **M1-19c** (disabled-target skillshot, K-2). Written against build spec sha256 `16fab94d29ef37a6dfacf090122f2d8377d9db6b783c779602ac4f9dd6566739` (R7-1…R7-10 + R7-6b binding). They assert the gated floors from the spec; provisional bands are logged, not gated.

These tests are **expected to fail on `bb4cb63`**, which has no cast policy and no K-2. They are behind `LB_M2` so default `npm test` stays green.

## Run

```bash
# default CI / local — M2 suite skipped
npm test
npm run purity
npm run typecheck

# opt in to M2 cast-policy + 19c
LB_M2=1 npx vitest run tests/acceptance/m1-19c-disabled-skillshot.test.ts
LB_M2=1 npx vitest run tests/acceptance/m2-cast-policy.test.ts

# or the whole suite with M2 on (lab ~200 games, several minutes)
LB_M2=1 npm test
```

## Layout

| File | Contents |
|---|---|
| `tests/acceptance/_m2_gate.ts` | `LB_M2` flag (`process.env.LB_M2 === "1"`) |
| `tests/acceptance/_m2_lab.ts` | 200-game side-swapped random-draft lab helper + F1/F2 / Lock metrics |
| `tests/acceptance/m1-19c-disabled-skillshot.test.ts` | M1-19c (L1927) |
| `tests/acceptance/m2-cast-policy.test.ts` | M2-25…M2-37 + R7 unit checks |
| `tests/acceptance/m2/README.md` | this file |

Existing suites under `tests/acceptance/s1|s2|s3/` and `sim/` are untouched. M1-19b stays in `s1/11-aim-skillshots.test.ts`.

## Lab definition

* 100 pair-seeds × 2 side-swaps = **200 games** (S5-R6-3)
* seed start `20261122`, even OVR attrs **70**, mastery **50**
* `evenOvrConfig` → `forced_clock_end: false`, AI on
* scheme: `quickDraftPicks` random draft

Each lab gate logs `num`, `den`, and `N`. Rows with den < 30 log `insufficient sample` and do not fail (R7-3 / R7-7).
