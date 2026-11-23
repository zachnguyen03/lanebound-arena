# S2 fight AI — REPORT (verify2 purity; awaiting s2-acceptance-v5)

**Tip:** (this commit) on `cursor/s2-fight-ai-1498`  
**Gate suite:** still `tests/acceptance/s2` = s2-acceptance-v4 (`844848060b0e2595dbe57944c3482914866adb67a66cac6a6d32037bddbbd838`) until v5 lands  
**S1 suite:** archive `69ccef0b` — not edited this tip  
**GD:** S2-R4-4 binding — `focus_id` = targeting-score winner after ×1.25 Focus bump; coach Focus is a weight only; `focus_id` null only when no legal target. No hard override.

## Gates

| Check | Exit |
|---|---:|
| `npm run purity` | **0** |
| `npx tsc --noEmit` | **0** |
| `npx vitest run tests/acceptance/s1` | **0** (960 / 960) |
| `npx vitest run tests/acceptance/s2` | **expected red** until v5 (`configOf` does not set `ai_enabled`; AI defaults off) |
| Local `tests/s0-gold-hash` + `tests/s2-ai-fight` | **0** |

## Digests (quiet `defaultEvenConfig`)

| Seed | AI off | AI on (explicit) |
|---|---|---|
| 20261122 | `7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f` | same (pad Idle) |
| 20261123 | `f3946e13929209cf9fd179cf20b147b050a6402ab09a83d2bdf6306e3c744cd0` | same (pad Idle) |

Default config is AI-off (`ai_enabled: false`). Quiet AI-on matches AI-off.

## verify2 deletions (this tip)

| # | Removed | Where |
|---|---|---|
| 1 | hold_R Focus HP snap to `0.4*max_hp+eps` | `sim/simulate.ts` |
| 2 | `wantFightAi` fixture-shape branching; AI default **off** | `sim/simulate.ts` |
| 3 | Top-at-pad in-fight Focus scorer | `sim/ai/tick.ts` |
| 4 | `pDelay≥0.5` / wait-for-true dive band → emit once at first §9.5 (2) with `peeler_perceived` at that tick | `sim/ai/tick.ts` |

## Item 5 — peel rates (honest)

**Even-OVR 400-seed lab** (`defaultEvenConfig(20261122+i)`, `ai_enabled: true`, full `MATCH_T`):

| Metric | Value |
|---|---:|
| N | 400 |
| `fight_call` | 0 |
| `dive` (all) | 0 |
| `dive` (`peeler_perceived===true`) | 0 |
| `peel_start` | 0 |
| M2 rate | **unmeasured** (pads Idle at match-start; `WalkFromPad` only post-respawn) |

**Constructed 400-seed preview** (suite pose + `ai_enabled: true` forced; not the M2 gate claim):

| Metric | Value |
|---|---:|
| N | 400 |
| `dive` total | 1200 |
| `dive` true | 0 |
| `dive` false | 1200 |
| `peel_start` | 1200 |
| M2 true-denom rate | **unmeasured** (0/0) — emit-at-first-(2) logs false on the parked first tick (`reaction_delay≥0.2`) |

Prior tip’s constructed `1200/1200 = 1` was not a real M2 measurement under the R #3 emit rule.

## Focus / R #4

Kept score-only Focus (×1.25). Per S2-R4-4, the two `10-gd-rulings-r4` `focus_id===coach` asserts stay red on v4 and will be replaced in **s2-acceptance-v5**.

## Fix cites

| Fix | Where | Commit |
|---|---|---|
| verify2 #1–4 purity deletions; AI default off | `sim/simulate.ts`, `sim/ai/tick.ts` | this tip |
| S2-R4-4 Focus score-only (no hard override) | `sim/ai/tick.ts`, `sim/ai/target.ts` | `8d1c48d` + this tip |
| R #4 reach / Teamwork / no `nearOwnPad` | `sim/ai/target.ts`, `sim/ai/fight.ts` | `8d1c48d` |
| S2 acceptance v4 install | `tests/acceptance/s2/*` | `605e8b2` |

## Suite sha256 (v4 — do not edit)

Gate archive: `844848060b0e2595dbe57944c3482914866adb67a66cac6a6d32037bddbbd838`. Waiting on `s2-acceptance-v5.tar.gz` + sha in Agent Store.
