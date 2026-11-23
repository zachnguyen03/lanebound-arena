# C3 series flow

No engine code changed. The three headless gaps in the C3 brief were already implemented on `career-engine` @ `854acc4`.

| Gap | Where it already lived | Proof |
|---|---|---|
| Series flow | `playSeries` builds `SeriesContext` and `MatchConfig`, consumes each fake `MatchResult`, and returns a validated `SeriesResult` | `packages/career/src/c3.test.ts` regular Bo3 |
| Refuse mixed runners | `validateSeriesResult` throws `series mixes sim and fake` when a series source and its maps disagree. `playSeries` always validates before return | same file, mutated map `source: "sim"` |
| Fearless reset at game 3 | `runner.ts` keeps `used_picks` for games 1–2 and passes empty lists from game 3 | Bo5 semi: game 2 shares no champions with game 1 on either side, and game 3's `champ_ids` equal game 1 |

Awards, Signature grants, and keep-new were already covered by the C2 tests (`seasonAwards`, `keepSignature`). They are not repeated here.
