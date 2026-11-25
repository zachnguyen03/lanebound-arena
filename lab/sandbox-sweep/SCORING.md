# Sandbox scoring grid

400 games per setting (sweep seeds 0–199 × side swap, diverse settings, sandbox rules).
Objective share = (majority ticks + claims) / winner's score. Targets: median 210–270 s,
objective share 30–40%. MATCH_T stays 240 s, so long settings end on the clock.

| SCORE_TO_WIN | points per kill | majority tick | median length (p10–p90) | not first-to-N | objective share | kills | lead changes | comebacks | Hunt vs others |
|---|---|---|---|---|---|---|---|---|---|
| 10 (old) | 1 | 18 s | 81 s (66–97) | 0% | 29% | 12.1 | 1.13 | 63% | 34% |
| 15 | 1 | 12 s | 104 s (86–125) | 0% | 39% | 16.0 | 1.24 | 64% | 33% |
| 15 | 1 | 18 s | 116 s (96–138) | 0% | 32% | 17.7 | 1.35 | 63% | 35% |
| 15 | ½ | 12 s | 146 s (118–173) | 0% | 60% | 22.3 | 1.04 | 57% | 21% |
| 15 | ½ | 18 s | 170 s (137–204) | 0% | 53% | 25.9 | 1.12 | 60% | 29% |
| 20 | 1 | 12 s | 139 s (115–163) | 0% | 41% | 21.0 | 1.46 | 67% | 29% |
| 20 | 1 | 18 s | 152 s (125–184) | 0% | 33% | 23.4 | 1.57 | 66% | 37% |
| 20 | ½ | 12 s | 189 s (158–225) | 3% | 61% | 29.1 | 1.21 | 60% | 24% |
| 20 | ½ | 18 s | 223 s (187–240) | 32% | 53% | 33.1 | 1.22 | 60% | 29% |
| 25 | 1 | 12 s | 170 s (141–202) | 0% | 42% | 26.0 | 1.62 | 69% | 31% |
| 25 | 1 | 18 s | 190 s (158–224) | 2% | 34% | 29.0 | 1.75 | 68% | 33% |
| 25 | ½ | 12 s | 234 s (196–240) | 42% | 62% | 34.1 | 1.24 | 60% | 25% |
| 25 | ½ | 18 s | 240 s (229–240) | 83% | 54% | 35.9 | 1.22 | 60% | 29% |
| **28** | **1** | **15 s** | **202 s (170–234)** | **7%** | **38%** | 30.6 | 1.69 | 69% | 31% |
| 28 | 1 | 18 s | 212 s (178–240) | 17% | 35% | 31.9 | 1.80 | 68% | 34% |
| 30 | 1 | 15 s | 217 s (182–240) | 21% | 38% | 32.5 | 1.71 | 69% | 30% |
| 30 | 1 | 18 s | 227 s (190–240) | 34% | 35% | 33.4 | 1.82 | 68% | 34% |

Chosen (`SANDBOX_CONSTANTS` in sim/cadence.ts): first to 28, every takedown 1 point,
majority tick 15 s. Half-point kills push the objective share over target and make
Hunt weaker. Reaching a 240 s median without clock endings needs MATCH_T above 240.
