# S4 Watch — unrendered event types (TODO)

The shell consumes these events in the side panel (filter + jump) but does **not** invent visuals for them yet. Do not draw fake casts, hits, CC plates, zone ownership changes, orbs-up, buffs-up, or score pops until the matching sim events and CD art hooks are wired.

| Event type | Planned visual | Blocked on |
|---|---|---|
| `cast_start` / `cast_cancel` | Telegraph / cast bar | S1 kits + telegraphs hook |
| `projectile_spawn` | Missile sprite | S1 combat log |
| `hit` / `heal` / `shield_apply` | Floating numbers / shield plate | S1 combat log |
| `status_apply` / `status_expire` / `sleep_break` / `dispel` | Status plates from `status/` | Status duration stream |
| `orb_spawn` / `orb_pickup` | `orb.up` / pickup burst | S3 orb events |
| `buff_spawn` / `buff_pickup` | `buff.up` / held tint (gold only on up/spawn/pickup) | S3 buff events |
| `zone_capture` / `zone_tick` | `zone.blue` / `zone.red` / contested | S3 zone events |
| `claim_open` / `claim_award` / `claim_deny` | Dock claim chip | S3 claims |
| `takedown_score` | Kill feed / banners | Death + score events |
| `fight_call` / `peel_start` | Fight Call dock + overlays | S2 AI stream |

**Currently drawn from the log:** `match_start`, `match_end`, `xp_gain`, `level_up`, `pos`/`move` (when present), `death`/`respawn`/`hit` HP fields (when present), score fields on end/takedown/zone/claim.

**Always drawn from CD art (static / empty states):** terrain, sanctuary wash/threshold, zone neutral + centre mark, `orb.down` pads, `buff.down` pads, pillars with y-sort.
