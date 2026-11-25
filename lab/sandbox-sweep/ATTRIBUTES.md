# Attribute isolation (sandbox rules)

One attribute raised 60 → 90 for every blue player; every other attribute 60 on both
teams. Sweep settings otherwise (draft, tactics, coach settings), seeds 0–499 × side
swap = 1000 games per cell. Baseline (no change) 49.6%. Target +3 to +6 pp.

| HIT_COEF | Aim | Reflexes |
|---|---|---|
| 0.01 (spec) | +26.7 pp | +29.0 pp |
| 0.005 | +14.5 | +16.8 |
| 0.0035 | +8.4 | +13.9 |
| **0.002 (sandbox)** | **+5.2** | **+6.1** |
| 0 | +3.9 | +2.3 |

At HIT_COEF 0 what remains is aim's disabled-target hit chance / cast choice and
reflexes' reaction delay. Each cell is ±3 pp (95%).

Earlier 600-game runs (spec 0.01, sandbox rules): execution +5, decision +1,
positioning 0, teamwork +1 — still near inert; separate fix.
