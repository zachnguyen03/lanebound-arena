# S2 behaviour pins

## `tests/s2-mutation-survivors.test.ts`

| Test | Behaviour |
|---|---|
| `chase stops for sanctuary when the target is in their own pad` | Chase stops with reason `sanctuary` when the target is in their own pad |
| `L1 does not run at t=0 (sim loop starts at DT)` | L1 does not run at t=0 |
| `hysteresis at Decision 5 sits on the 0.4 floor` | Decision 5 hysteresis sits on the 0.4 floor |
| `level-4 dummy 5s damage is auto-only (R is not included below level 5)` | Below level 5, dummy 5s damage is auto-only |
| `reachFactor uses the rational far-eta curve 1/(1+0.4·dd+0.08·dd²)` | Far-eta reach uses the rational curve |

## `tests/s2-r25-follow-focus.test.ts`

| Test | Behaviour |
|---|---|
| `follows when local is strictly worse; freelances when local is strictly better (TW≥50 → slack=1)` | At Teamwork ≥ 50, follow only when local score is strictly below call score |
| `at Teamwork 60, slack is 1.0, so a 5% greener local freelances` | Teamwork 60 uses slack 1.0; low Teamwork opens slack so a modestly greener call still wins |
| `at Teamwork 90, equal-rest call 1.30 beats local 1.00` | Equal-rest call factor 1.30 beats local 1.00 at high Teamwork |
| `disengage returns the focus even when a much greener local is in range` | Disengage hard-follows the called focus |

## `tests/s2-survivor-behaviour.test.ts`

| Test | Behaviour |
|---|---|
| `follows a much greener local shot, not the far called target (engage, Teamwork 90)` | Engage call names far Red ADC; Blue ADC (TW90) attacks adjacent low-HP Red Mid |
| `a dead called target does not stay the attack target` | After the called Red ADC dies, Blue ADC switches to live Red Mid and never keeps the corpse |
| `a no-damage chaser still treats a 1-HP target as killable (chase continues)` | Level-1 `as=0` chaser keeps chasing a 1-HP target (chase does not stop as unkillable) |
