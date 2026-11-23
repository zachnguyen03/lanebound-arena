# C4 shell

Career UI in `apps/career` (Vite, React, Tailwind, a shadcn-shaped button skinned with the Chief Designer button classes). It reads `packages/career` and does not recompute standings, OVR, or ratings. Autosave is IndexedDB. Export and import are JSON. `loadSave` validates every `SeriesResult` and rebuilds the table, Glicko, points, awards, and contracts from those series. A file that does not replay, including a tampered standing or a mixed sim/fake series, is rejected and the state-error-save screen offers Try again, Download save file, and Keep playing unsaved.

## What already existed

Series flow, mixed-runner rejection, and the game-3 fearless reset were already in the engine. C3 pinned them. This milestone adds the save replay.

## Content differences against the mockups

- Trimmed nav is engineering-composed. The shell keeps Home, Squad (Players, Lineup, Contracts), and Competitions (League, Bracket, Fixtures). Training, Transfers, Stats, Club, and Inbox are not in this slice. Screenshots are flagged `data-composed="trimmed-nav"`.
- Club pick is one screen for all eight clubs, with difficulty labels. Juniper Rush is highlighted. There is no region step.
- The league is one 8-club table with a dashed line under 4th. It is not the 10-team pyramid.
- Fixtures are the seven Bo3 matchdays, then a line that playoff days open after matchday 7. The bracket is 1 vs 4, 2 vs 3, and the final. Club names fill in after matchday 7.
- Home drops the gold tape. Condition and form are not engine outputs, so the lineup shows overall from the player record.
- Contracts show years left and expiry. Wage stays in the save and is not on screen.
- Crests are neutral (`--c-panel-2`, `--c-line-2`, `--c-text`). Blue and red are used only when a club is on a side in a match. Red-side letters use `--c-field` because the token file has `--c-on-blue` and no on-red colour.
- The fixture list has no weekday, so the home line under VS is “Matchday N · Blue side” or “Red side”.
- 1280×800 has no reference PNG. Those rows sit beside the 1280-wide reference.

## Chief Designer polish

Sub-tabs use `.subtabs`: 44px, a bottom rule, and a 2px `--c-action` underline. Difficulty reads Favourite / Mid / Underdog. Our club uses `tr.me` in the table and on our fixtures. The top-four line is 2px `--c-line-2`. Settings is the gear icon with `aria-label` Settings, and Playwright checks that header labels do not overflow or overlap at 1440 and 1280. Club promises are the eight C-R2-7 lines, verbatim, in one table. A missing id would hide the line. The menu save summary sits under Continue and is hidden when there is no save.

## Proof

| Check | Exit |
|---|---:|
| `npx tsc --noEmit` | 0 |
| `npx vitest run` | 0 |
| `npm run purity` | 0 |
| `npx playwright test` in `apps/career` | 0 |
| `node lab/c4/tokens.mjs` | 0 |
| `node lab/c4/strings.mjs` | 0 |

Playwright covers a new career for each of the eight clubs, the Juniper highlight, the 8-row table, the fixture list, save and reload, a rejected import, screenshots at 1440×900, 1280×900, and 1280×800, and an `elementFromPoint` check with Settings open and with the save-error overlay open. Side-by-side PNGs are in `lab/c4/side-by-side/`.

Season sha is unchanged: `b9493793a066bf72748f60e363b9e1318990ed4725401efd8611a468308a8b7c`.
