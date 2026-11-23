# S2R25 / S2R25b / S2R25c / S2R26 — held-out kill proof

Official `10-gd-rulings-r4.test.ts` L192 used to kill these. §9.2 dwell now forces
mobile disengage Retreat with a null target before `pickUnitTarget`, so that assert
is vacuous. Killers live in `tests/s2-r25-follow-focus.test.ts` and pin
`shouldFollowFocus` + the `commitDisengage` caller in `sim/ai/target.ts`.

`pickAutoTarget` export on `sim/combat.ts` was reverted (not needed).

## Needles (tip `sim/ai/target.ts` find-strings)

| Id | Find → replace |
|---|---|
| **S2R25** | `return localScore < callScore * slack;` → `return localScore > callScore * slack;` |
| **S2R25b** | `Math.max(0, 50 - teamwork)` → `Math.max(0, 100 - teamwork)` |
| **S2R25c** | `Math.max(0, 50 - teamwork)` → `(50 - teamwork)` (drop floor) |
| **S2R26** | `if (opts.commitDisengage && opts.focusId)` → `if (false && opts.commitDisengage && opts.focusId)` |

## GREEN (unmutated)

```
npx vitest run tests/s2-r25-follow-focus.test.ts
✓ tests/s2-r25-follow-focus.test.ts (4 tests)
Tests  4 passed (4)
```

## RED under each needle (`-t <id>`)

**S2R25** — invert comparison:
```
FAIL  S2R25 — shouldFollowFocus comparison …
AssertionError: expected false to be true  // shouldFollowFocus(10, 9, 90)
exit 1 KILLED
```

**S2R25b** — threshold 50 → 100:
```
FAIL  S2R25b — Teamwork 50 threshold inside slack …
AssertionError: expected true to be false  // shouldFollowFocus(10, 10.5, 60)
exit 1 KILLED
```

**S2R25c** — drop Math.max:
```
FAIL  S2R25c — Math.max keeps slack ≥ 1 at high Teamwork …
AssertionError: expected false to be true  // shouldFollowFocus(1.3, 1.0, 90)
exit 1 KILLED
```

**S2R26** — disable commitDisengage hard-follow:
```
FAIL  S2R26 — commitDisengage hard-follows focus in pickUnitTarget …
AssertionError: expected 'red:mid' to be 'red:adc'
exit 1 KILLED
```

All four **KILLED**. None treated as equivalent.
