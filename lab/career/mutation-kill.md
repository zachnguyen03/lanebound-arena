# Career mutation kill log

The request named 18 mutations. `career-PM-PACKAGE.md` lists 16, and this probe runs those 16. There is no 17th or 18th row in that table.

Each edit was written over the working file only after a byte copy in `/tmp/career-mutation-ux3uZg`, then restored from that copy.

| # | Mutation | Turned red? | Note |
|---|---|---|---|
| 1 | Flip last two standing keys (maps won before map diff) | YES | killed |
| 2 | No-op assertAcceptableSimReplay (drop fake: check) | YES | killed |
| 3 | GLICKO_TAU 0.5 → 1.0 | YES | killed |
| 4 | Swap sides parity | YES | killed |
| 5 | Drop the award minimum of 4 series | YES | killed |
| 6 | Zonekeeper coefficient 20 → 21 | YES | killed |
| 7 | STRENGTH_K 0.1 → 0.2 | YES | killed |
| 8 | Reverse every last-key opening_index comparison | YES | killed |
| 9 | Flip one tactic entry (Iron Lotus Hold → Hunt) | YES | killed |
| 10 | Sudden death is a fair coin again | YES | killed |
| 11 | Mastery projection 60 → 61 | YES | killed |
| 12 | Change one world field (pid 1 wage 138 → 139) | YES | killed |
| 13 | Reorder the signature grant | YES | killed |
| 14 | seriesMvp: swap mean rating ↔ maps | YES | killed |
| 15 | seriesMvp: swap maps ↔ mean z | YES | killed |
| 16 | seriesMvp: swap mean z ↔ lower player_id | YES | killed |

mutation_probe_pass=true
listed=16
claimed=18
