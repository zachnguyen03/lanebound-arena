# S3 behaviour pins

## `tests/s3-zone-pickup-pins.test.ts`

| Test | Behaviour |
|---|---|
| `seed 20261122 deadlock coin_flip winner is red` | Known-seed Bo1 deadlock coin_flip is red |
| `end pose outside the pad does not pick up even when velocity back-projects onto the pad` | Orb pickup uses end-of-tick pose only |
| `when a team is ahead at the 4:45 boundary, reason is sudden_death not clock` | Ahead finish at SUDDEN_DEATH_T+BO1_EXTRA_S is `sudden_death` |
| `HP at the capture tick equals start + base regen only (no aura yet)` | No zone aura regen on the capture tick |
| `a unit that leaves the zone mid-window must re-earn N continuous ticks to deny` | Claim deny dwell is continuous occupation, reset on leave |
