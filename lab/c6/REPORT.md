# C6 awards, season end, onboarding

Awards use the five names from the plan: Split MVP, Deadeye, Shepherd, Zonekeeper, Finals MVP. Before the final the screen is the empty state. After it, the table is the engine’s award list. Advance ticks contracts once and leaves the silent ranking off the league table. Points stay on `club_state`.

## Content differences

- `07-awards` in the mockup is champions, All-Pro, and a Spring Split. This screen is the five award rows plus the final score. There is no All-Pro team and no gold tape.
- `state-empty-awards` keeps “Not announced yet”. The line is “Awards come after the final.” The mockup’s MVP race is not an engine output, so it is not shown.
- 1280×800 has no reference PNG. Those rows sit beside the 1280-wide reference.

## Engineering-composed

These have no mockup. They use the existing card, button, and type tokens. The review pack is `lab/c6/review/`.

- Coach marks, `data-composed="coach-mark"`. Maps 1–5, then the mark goes away. Copy follows career GDD §8.2 and does not name Ossel. Map 4 says the plan stays locked until the series ends. The engine has no mid-map tactic swap.
- Signature keep or replace, `data-composed="signature-choice"`. Only the human club is asked. Iron Lotus keeps Convergence Crown instead of taking Finals Poise, and that choice is still there after reload.
- Training focus, `data-composed="split-stub"`. The line is “Opens after the first Split”.

## Inventions

- Coach marks are derived from maps played, not a separate flag.
- Map 4 does not offer a mid-map tactic change, because a series locks the preset.
- The signature prompt is human-only. Other clubs keep the new card.
- Placement points are not a column on the league table.

## Proof

| Check | Exit |
|---|---:|
| `npx tsc --noEmit` | 0 |
| `npx vitest run` | 0 |
| `npm run purity` | 0 |
| `npx playwright test` in `apps/career` | 0 |
| `node lab/c6/tokens.mjs` | 0 |
| `node lab/c6/strings.mjs` | 0 |

Playwright walks coach marks through map 5, skips a season for Iron Lotus, keeps the held signature, advances, and checks the contract years and the reload. It also checks `elementFromPoint` with the signature overlay open. Side-by-side PNGs are in `lab/c6/side-by-side/`.

Season sha after C-R2-8 is `23c624715c25b3229a687de70b078eee2a9b69599ae668c8f8f21b952ca9a1f9`. C6 does not move it.
