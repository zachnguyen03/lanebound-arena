# S3 items deferred — not dropped

This pack covers M3 tests 26–31, the scripted `match_end.reason`s, two-process determinism, `claim_denies`, and the AI-off S1 regression. The items below need a larger lab, S2 AI on a live zone, or a later milestone. They are **not** faked here.

## Needs a larger / AI-on lab (M6 or a later S3 preview)

| Item | Spec | Why deferred |
|---|---|---|
| 0 illegal enemy-sanctuary entries over a **400-game** preview and the **2,000-game** even lab | M3-25 L1747, sandbox §11 S3 L627 / L705 | This pack ships the constructed shove and a 20-seed AI-off preview in `09-sanctuary.test.ts`. The 400 / 2,000 counts need the fight-layer AI running on full matches (S2 + S3). |
| Hold the Pit > Hunt > Starve on mean zone-time, 200 even-OVR games; the reverse on orbs | M2-23 L1736, plan §8.4, sandbox §11 S2, S2 suite `08-deferred-s3.test.ts` | Still lives in the S2 suite as `describe.skip`. Un-skip there once S3 is green and AI is on. Not duplicated here. |
| Planner jobs: Hold occupies the pit; Starve dips to pause the tick timer; two buffs → two units | §9.2 L1107–1117 | AI planner, not a scoring-rule test. |
| Isolation +30 attribute, 400 games/arm | §8.5 L1052–1058 | Explicitly M6. Needs full-match winners (this pack's scoring) plus a batch runner (S5). |
| Official lab bands (median length, zone share of winner's score, triangle edges) | M6 L1779+, sandbox §6.5 | S5 dashboard; fail = report, not a silent retune. |

## Needs rules that are still a proposal, or a later sandbox slice

| Item | Spec | Why deferred |
|---|---|---|
| Quick draft + player generation | sandbox §6.3 L382, S3 scope L627 | Algorithm is labelled a proposal. Determinism of `draft_mode: "quick"` is not pinned here so the suite does not re-implement the shuffle. |
| Series Bo3/Bo5 draw and replay, including a `match_end` at 4:30 after the zone-time / takedown ladder | §5.8 L317–L318, S3-R5-6 L1961 | Sandbox S3 is Bo1 only (sandbox §2.1 L66): a deadlock after the ladder goes to the extra 15 s and then `coin_flip`. In a series there is no extra window — the map is a draw and a replay. §4.4 already allows `winner: "draw"` but has no reason enum for that end (`first_to_10` / `clock` / `sudden_death` / `zone_time` / `takedowns` / `coin_flip`). This pack does not invent one. If a later milestone must emit a series-map-draw result from the live sim, Game Designer should name the reason. |
| Cards, rating, manager UI | sandbox §2.2, M4–M5 | Out of sandbox S0–S5 scope for cards/manager; rating is career. |

## Intentionally not deferred (tested in this pack)

Scripted first-to-10 / clock / sudden-death / zone-time / takedowns / coin_flip; any-class deny; empty zone awards; banished unit does not deny; tick pause and no-reset; 12 s exclusive owned = +1; orb / buff timings and values; G4 / G7; no XP on dead ticks; catch-up totals (folded 138 / 1.3225, no `catchup` source); `claim_denies` and `claim_deny.deniers`; dwell `N = max(1, round(dwell×10))`; two-process digests for 20261122 and 20261123; AI-off S1 gold subsequence.
