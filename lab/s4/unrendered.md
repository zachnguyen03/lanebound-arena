# S4 Watch — unrendered event types (TODO)

The shell consumes these events in the side panel (filter + jump) but does **not** invent overlay visuals for them yet (except body anim hooks noted below).

| Event type | Planned visual | Status |
|---|---|---|
| `cast_start` / `cast_cancel` | Telegraph / cast bar | Not drawn. Even default seeds 20261122 and 20261123 emit 0 `cast_start` (772 ticks each). The plan wants a shape blit; the log has no cast to place one on. |
| `projectile_spawn` | Missile sprite | TODO — S1 combat log |
| `hit` | Floating numbers / shield plate | **Body `hit` anim plays** on damage; floaters still TODO |
| `heal` / `shield_apply` | Floating numbers / shield plate | TODO |
| `status_apply` / `status_expire` / `sleep_break` / `dispel` | Status plates from `status/` | TODO |
| `orb_spawn` / `orb_pickup` | `orb.up` / pickup burst | TODO — S3 |
| `buff_spawn` / `buff_pickup` | `buff.up` / held tint (gold only on up/spawn/pickup) | TODO — S3 |
| `zone_capture` / `zone_tick` | `zone.blue` / `zone.red` / contested | TODO — S3 |
| `claim_open` / `claim_award` / `claim_deny` | Dock claim chip | TODO — S3 |
| `takedown_score` | Kill feed banners | Log row when present; banner art TODO |
| `fight_call` / `peel_start` | Fight Call dock + overlays | TODO — S2 |
| `death` | — | **Body `death` anim plays** (last frame holds); banners TODO |

**Currently drawn from the log:** `match_start`, `match_end`, `xp_gain`, `level_up`, `pos`/`move` (when present), `death`/`respawn`/`hit` (HP + body anim), score fields on end/takedown/zone/claim.

**Always drawn from CD art:** terrain, sanctuary wash/threshold, zone neutral + centre mark, `orb.down` / `buff.down` pads, pillars with y-sort, **training-dummy body** (`idle`/`move`/`hit`/`death` × team × facing).
