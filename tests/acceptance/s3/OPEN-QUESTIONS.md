# S3 open questions — resolved by Appendix R #5

Game Designer ruled OQ-S3-1..12 as Appendix R #5 (build spec L1932–L1972, 23 Nov 2026). Binding. This file lives at `lab/s3-acceptance/OPEN-QUESTIONS.md` (the path cited at L1934) and is copied into the official pack at `tests/acceptance/s3/OPEN-QUESTIONS.md`.

The v2 suite tests each ruling; see `10-gd-rulings-r5.test.ts` and the tightened asserts in `01`–`06`. Edited spec lines: §4.3 phase 11 (L146), §5.7 pickup (L303), §5.8 first-to-10 / sudden death (L311, L313). Edit note at L1972.

## OQ-S3-1. Zone progress decay when the other team has exclusive occupation

**Resolved: S3-R5-1 L1936–L1945.** §5.5 is canonical; the plan's "decay only when empty" is superseded. Two independent bars (0..30 ticks), not a signed bar. Exclusive X: X +1, the other −1 (floor 0). Contested: both frozen. Empty: both −1 (floor 0). Owner's bar is held at 0; only a non-owner accumulates. Capture at 30 ticks sets both bars and `tick_timer` to 0; the capture tick is the new owner's first tick-timer tick. Flip tick: no partial credit (Blue 20 then one Red exclusive tick → Blue 19, Red 1). Ownership change resets `tick_timer`.

## OQ-S3-2. Two score events on the same sudden-death tick

**Resolved: S3-R5-2 L1947–L1951.** All score events of the tick are applied; the result is decided once in phase 14 on the end-of-tick score. Sudden death (and Bo1 `extra_15`) ends on the first tick that ends with unequal scores. Opposite events cancel; same-team events just give a lead. Precedence: (1) `first_to_10` (S3-R5-10), (2) the 4:00 clock and the 4:30 ladder, (3) `sudden_death`. Log order: `takedown_score` (death order, Blue 0..4 then Red 0..4 victims), then `zone_capture`, `zone_tick`, `claim_award`.

## OQ-S3-3. Catch-up `highest_enemy_level` — living only, or also dead / respawning?

**Resolved: S3-R5-3 L1953–L1954.** Maximum level of all five enemy units, alive, dead or respawning. Dead units keep their level. Eligibility uses a level snapshot taken at the start of the tick (before phase 2) for every award that tick, and is not changed by this tick's level-ups.

## OQ-S3-4. Catch-up event shape

**Resolved: S3-R5-3 L1955.** The bonus is folded into one `xp_gain` per award. Orb with catch-up: `source:"orb"`, `amount:138`, and `orb_pickup.xp = 138`. Time with catch-up: `source:"time"`, `amount:1.3225`. The `catchup` source is reserved and never emitted in v1. No catch-up on kill, assist or card.

## OQ-S3-5. Do time-stopped (or feared / hexed) units occupy the zone?

**Resolved: S3-R5-4 L1957.** Occupation stays §5.5: living, not banished, `dist ≤ ZONE_RADIUS`. Time-stopped, feared, hexed, stunned, rooted, slept and knocked-up units **are** occupants. Banished and dead are not. A time-stop on a defender must not hand the zone to the attacker.

## OQ-S3-6. Flank-buff pickup under Lock / Bind

**Resolved: S3-R5-5 L1959.** G7 is the single rule for orbs **and** flank buffs.

## OQ-S3-7. Orb pickup under fear, hex, leash, disarm, or silence

**Resolved: S3-R5-5 L1959.** A unit can pick up unless it is dead, banished or time-stopped. Every other status (including fear, hex, leash, silence, disarm, taunt, slow, break, blind, mute, spawn shield) allows pickup. Evaluated once per tick in phase 11, at end-of-tick positions only (no swept path). A unit that died this tick cannot pick up.

## OQ-S3-8. `match_end.reason` for a score during the Bo1 extra 15 s (4:30–4:45)

**Resolved: S3-R5-6 L1961.** A score in the extra window (270.0 < t ≤ 285.0, phase `extra_15`) ends with reason `sudden_death`. No new enum value. The 4:30 ladder is evaluated once, at the 270.0 tick, and is not re-run at 285.0. If nobody leads at the end of the 285.0 tick: `coin_flip`, one draw on `tiebreak`. The `tiebreak` stream counter is unchanged when a score ends the extra window.

Series (Bo3/Bo5) have no extra window: a tie after the ladder is a draw and a replay (§5.8). Sandbox S3 is Bo1, so a series-map-draw `match_end` is deferred (see `DEFERRED.md`).

## OQ-S3-9. Aura heal snapshot vs phase 11 occupancy

**Resolved: S3-R5-7 L1963.** The aura uses the zone state committed in phase 11 of the **previous** tick. It starts one tick after ownership plus exclusivity is established (first aura tick is the tick after `zone_capture`) and ends one tick after it fails. +10/+10 resists in phase 8; +15 HP/s = 1.5 HP per tick in phase 9. A time-stopped occupant keeps the resists but gets no regen.

## OQ-S3-10. `CLAIM_DENY_DWELL_S > 0`

**Resolved: S3-R5-8 L1965–L1966.** Dwell is continuous occupation by one single enemy unit ending on the resolve tick. A unit denies if its consecutive-occupation counter ≥ `N = max(1, round(CLAIM_DENY_DWELL_S × 10))`. Default 0 → N = 1 (M3-26 unchanged). Additive field: `claim_deny.deniers: unit_id[]` in unit order; `denier_id` remains the closest among them; `claim_denies` is +1 for each id in `deniers`.

## OQ-S3-11. Per-player `zone_seconds`

**Resolved: S3-R5-9 L1968.** `zone_seconds` = (ticks the unit is an occupant, per S3-R5-4) ÷ 10, raw presence (owned, contested, or empty-of-enemies). 4 dp. Invariants: per unit `zone_seconds ≤ match seconds`; per team Σ `zone_seconds ≥ control_time[team]`.

## OQ-S3-12. Both teams reach `SCORE_TO_WIN` on the same tick

**Resolved: S3-R5-10 L1970.** A team wins when score ≥ `SCORE_TO_WIN` **and** strictly higher than the other team at the end of the tick (phase 14). 9–9 plus a mutual kill → 10–10, no `match_end`; the next lone score is `first_to_10`. A team may finish a tick above 10 (e.g. 11); the reason is still `first_to_10`.

## Remaining notes (not a new OQ)

- §4.4 still has no `match_end.reason` for a series map-draw after the 4:30 ladder. Sandbox S3 is Bo1 only; this is deferred, not invented. See `DEFERRED.md`.
- `XP_TO_LEVEL` (L5 = 820, the written table) is **confirmed by Anh**. The "pending confirmation" flag in v1 is dropped.
