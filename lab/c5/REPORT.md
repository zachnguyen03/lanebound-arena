# C5 play, cards, tactics, draft, recap

Play and skip run on the fake runner, one map at a time. The screen shows what the engine returns. It does not recompute ratings, standings, or card outcomes. `runSeason` still plays the season on the fake runner. C-R2-8 moved the season sha to `23c624715c25b3229a687de70b078eee2a9b69599ae668c8f8f21b952ca9a1f9` because `archetypes` is now the composition tag.

## Content differences against the mockups

- Tactics (`09-tactics`) in the mockup is a lane board and phase plans (Pressure mid, Teamfight). The engine has three presets, so the screen is Hold the Pit, Hunt, and Starve on the existing card. There is no lane board.
- Cards (`09c-tactics-cards`) keep the v2 faces. The budget on screen is 3 cards and 6 points. The mockup’s 6 slots and 10 points are not shown. Holders are the first three starters. There is no level pip and no separate holder picker.
- Draft (`04-draft-fearless`) lists the five picks the engine already chose. Game 2 says it cannot repeat game 1. There is no ban phase.
- Recap (`15-match-report`) shows the score, a rating for each player, and Fired or Expired for each card. It is labelled `source: fake`. There is no gold graph and no Replay button.
- `05b-live-postgame` has no matching screen. Fake results do not open Watch. The side-by-side puts the fake recap next to that reference and says so.
- 1280×800 has no reference PNG. Those rows sit beside the 1280-wide reference.
- Coach marks through map 5 are on the page, composed from the career text, with no mockup. The scripted pass is C6.

## Inventions

- A career session plays map by map. `playSeries` still uses the stand-in loadout. In the session, the human club uses the chosen preset and the three chosen v2 cards. Every other club uses the first three Commons, so a recap never shows a stand-in card id. Holders are starters 0, 1, and 2.
- The preset and the loadout lock once a series has a map. The engine has no mid-map tactic swap. Game 3 drops the fearless lock, same as `playSeries`.
- The Settings control was a 36px icon button with the word Settings in it, so the word covered the date. It now sizes to the word. The C4 screenshots were recaptured because that control sits on every screen.

## Proof

| Check | Exit |
|---|---:|
| `npx tsc --noEmit` | 0 |
| `npx vitest run` | 0 |
| `npm run purity` | 0 |
| `npx playwright test` in `apps/career` | 0 |
| `node lab/c5/tokens.mjs` | 0 |
| `node lab/c5/strings.mjs` | 0 |

Playwright plays a full Bo3, checks game 2 fearless and the locked cards, checks the recap for ratings, Fired or Expired, `source: fake`, and no Replay button, writes the three widths, and runs `elementFromPoint` with Settings open and with the save-error overlay open. The date’s midpoint also hits the date, not the Settings control. Side-by-side PNGs are in `lab/c5/side-by-side/`.
