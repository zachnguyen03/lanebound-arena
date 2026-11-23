# S2 fight AI — REPORT (s2-acceptance-v4)

**Tip:** (this commit) on `cursor/s2-fight-ai-1498`  
**Gate:** `tests/acceptance/s2` = s2-acceptance-v4 (`844848060b0e2595dbe57944c3482914866adb67a66cac6a6d32037bddbbd838`)  
**S1 suite:** archive `69ccef0b` restored; not edited this tip.

## Gates

| Check | Exit |
|---|---:|
| `npm run purity` | **0** |
| `npx tsc --noEmit` | **0** |
| `npx vitest run` (S1 v4 + S2 v4 + lab) | **1** (2 design-Q reds in R #4; see below) |
| S1 acceptance | **960 / 960** |
| S2 acceptance | **59 passed / 2 failed / 6 skipped** (61 runnable) |

## Digests (quiet `defaultEvenConfig`)

| Seed | AI off (`ai_enabled: false`) | AI on (default) |
|---|---|---|
| 20261122 | `7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f` | `7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f` |
| 20261123 | `f3946e13929209cf9fd179cf20b147b050a6402ab09a83d2bdf6306e3c744cd0` | `f3946e13929209cf9fd179cf20b147b050a6402ab09a83d2bdf6306e3c744cd0` |

AI-off digests equal published S1 quiet gold. Quiet AI-on matches AI-off (pad residents Idle; no digest-changing fight intents).

## Design question — Focus ×1.25 vs R #4 `focus_id`

**Kept:** Focus is a **×1.25 score multiplier** only (v4 probe `11-probe-gaps`, R #3 S2-6). No hard override onto the coach Focus slot for `fight_call.focus_id`.

**Red (2):** `10-gd-rulings-r4` — Teamwork 90 greener local + disengage follow both assert `fight_call.focus_id === red:adc` (coach Focus) while a much greener local mid wins the ×1.25 blend. Hard-setting `focus_id` to the coach slot would fail the v4 probe.

**Ask GD:** Is `fight_call.focus_id` (a) the ×1.25 score winner (probe), or (b) the coach Focus whenever set (R #4 asserts)? Unit freelancing under R #4 Teamwork can be tested either way; the two suites disagree on the call field.

## Fix cites (this tip + parents)

| Fix | Where | Commit |
|---|---|---|
| S2 acceptance v4 install (sha `84484806…`) | `tests/acceptance/s2/*` | `605e8b2` |
| S1 harness + 13-gd restore | `tests/acceptance/s1/_harness.ts`, `13-gd-rulings.test.ts` | `5e56e58` |
| R #4 reach / Teamwork slack / remove `nearOwnPad` | `sim/ai/target.ts`, `sim/ai/fight.ts` | `8d1c48d` |
| Focus ×1.25 (no hard override); Lock ×1.25 | `sim/ai/target.ts` | `8d1c48d` + this tip |
| Dive emit T/F at §9.5 (2); M2 true-only rate | `sim/ai/tick.ts`, `sim/ai/peel.ts` | `8d1c48d` + this tip |
| Intent only on state/target change | `sim/ai/tick.ts` | `8d1c48d` + this tip |
| hold_R vs auto; Focus HP floor under hold | `sim/ai/brain.ts`, `sim/simulate.ts` | this tip |
| Parked S1 labs suppress AI (no harness edit) | `sim/simulate.ts` `wantFightAi` | this tip |
| In-fight Focus scorer (pad Top shotcaller) | `sim/ai/tick.ts` | this tip |
| Secondary idle L1 swap | `sim/ai/tick.ts` | `77db09c` / lab test |
| AI-off digests = S1 | `tests/s0-gold-hash.test.ts`, `tests/s2-ai-fight.test.ts` | `8d1c48d` |

## Suite sha256 (do not edit)

See agent summary for full per-file lists. Spot checks: S2 `11-probe-gaps` `b56589ecd88f36db6acea5b6397d678a3275860533da46f64042c2cb1589e704`; S1 `_harness` `d329ecb437fd0979661415f35ba9e7a6843b3d162a379a70ed5f6ecf5dbdddd4`.
