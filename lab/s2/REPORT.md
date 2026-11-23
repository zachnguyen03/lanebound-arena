# S2 fight AI — REPORT (pad-idle planner fix)

**Tip:** this commit on `cursor/s2-fight-ai-1498` (PR #5)  
**Parent:** `6256140` + planner commit `7060d17` lineage  
**Gate suite:** s2-acceptance-v6 (`e3ecb1a732eb58f5fd11336deef1de99f2883ae0067c34c5f77dde536e2271b8`); tip ships v4 suite files plus official v6 `DEFERRED.md` (Anh peel-lab deferral)  
**S1 suite:** v4 archive `69ccef0b…` — not edited this tip  
**Fix:** §9.2 planner walks live units off pads from match start; lab-parked slots (`auto_next_start_t ≥ 900`) stay Idle; `defaultEvenConfig.ai_enabled` remains `false`

## Gates (this tip)

| Check | Exit |
|---|---:|
| `npm run purity` | **0** |
| `npx tsc --noEmit` | **0** |
| `npm test` (with official S2 v6 overlay) | **0** — 1198 passed / 10 skipped |
| S1 acceptance v4 | **0** (960 / 960) |
| S2 acceptance v6 | **0** (76 passed / 10 skipped) |

## Digests (`defaultEvenConfig`)

AI-off equals S1 quiet gold. AI-on differs and is two-process identical. First `fight_call` at `t=2.2` both seeds.

| seed | mode | digest | fight_call | intent | dive | auto hits | kills |
|---|---|---|---:|---:|---:|---:|---:|
| 20261122 | AI-off | `7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f` | 0 | 0 | 0 | 0 | 0 |
| 20261122 | AI-on | `e3080dfdc9b21c1c8936d8055d14b9fb2d4277af1c89e01011b716c3b0e19750` | 952 | 600 | 4 | 225 | 7 |
| 20261123 | AI-off | `f3946e13929209cf9fd179cf20b147b050a6402ab09a83d2bdf6306e3c744cd0` | 0 | 0 | 0 | 0 | 0 |
| 20261123 | AI-on | `69a025465924c57f81b7963332743590a264980aabc9041b163ca3072daf5e49` | 478 | 8253 | 5 | 518 | 14 |

See `digest-20261122.txt`, `digest-20261123.txt`, `two-process-digest-check.txt`.

## Lab artifacts

| File | Role |
|---|---|
| `digest-*.txt` | AI-off (= S1 gold) + AI-on digests, event counts |
| `two-process-digest-check.txt` | two-process identity AI-off and AI-on |
| `purity.txt` | `npm run purity` |
| `tests.log` | `npm test` (1198 / 10 skipped) |
| `REPORT.md` | this file |

## Suite note

`tests/acceptance/s2/DEFERRED.md` is the official v6 file byte-for-byte (sha256 `52557931…`). No other suite file was edited on this tip.
