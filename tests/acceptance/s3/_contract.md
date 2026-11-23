# S3 public API contract (minimal) — v3

Verifier-owned. The S3 build agent implements **exactly** these additions on top of the S1 public API at tip `2cdcf26` (`simulate`, `defaultEvenConfig`, `MatchConfig` lab hooks, `SimulateResult`, the §4.4 event log, `digestEvents`). Do not invent further public fields to make a test pass. Lab hooks below are the only new `MatchConfig` keys this suite uses.

Sources: build spec §4.3–4.4, §5.3–5.8, §14.7–14.8, §15, M3 tests 25–31, Appendix R G2–G4 / G7–G8 / G11, the tile-centre rule, and **Appendix R #5 (S3-R5-1..10, L1932–L1972)**; sandbox §2.1, §8.2, §11 S3; plan §8.4 S3; career GDD v1.1.2 C-R-5.

v2 additive fields (new in this contract, all 1.x / non-breaking): `claim_deny.deniers`, required `player_stats.zone_seconds`, `MatchState.rng_counters` (already in §14.7, now read by tests), and lab `unit_overrides.ms`.

## `defaultEvenConfig` compatibility

Keep `forced_clock_end: true` on `defaultEvenConfig` (S1 behaviour: a default even match ends at `MATCH_T` with `match_end.reason === "clock"`, scores 0–0). This suite sets `forced_clock_end: false` whenever it exercises the real §5.8 win conditions. Do not change default constants without a report.

`XP_TO_LEVEL` is the written table (L5 = 820). **Confirmed by Anh.** Do not substitute 966.

## New `MatchConfig` lab hook

```
scripted_claim_open?: Array<{
  tick: number;          // the tick a qualifying net +1 win is treated as occurring
  team: "blue" | "red";
  fight_id?: string;     // optional; echoed on claim_open if supplied
}>
```

On that tick, apply the §5.6 claim-window rules as if that team just scored a net +1 fight win: open a pending claim with `resolve_at = t + CLAIM_DELAY_S` (default 8.0 s, §15), emit `claim_open`, refresh `resolve_at` if the same team already has the pending claim, or cancel the pending claim and open this one if the other team holds it (G11: deaths never clear a claim). Resolve at `resolve_at` in phase 11 as specified (S3-R5-1 order: occupancy → bars → capture → timer / zone ticks → `zone_tick` → claim resolve). This hook exists so deny / award / refresh fixtures do not depend on fight-layer AI (plan §10).

A separate test also opens a claim from a real net +1 fight win (scripted kills, no hook), which is the production path.

Existing S1 lab hooks (`unit_overrides`, `scripted_motor`, `scripted_damage`, `scripted_cc`, `scripted_casts`, `constants`, `debug_pos`, `assert_sanctuary`, `forced_clock_end`) are unchanged. **v2 lab addition:** `unit_overrides[id].ms` (tiles/s) is allowed, the same way `range` and `as` already are, so a no-sweep pickup fixture can cross a pad in one tick.

**v3 lab addition:** `sim_until?: number` — the run cap, set by the harness from the scenario's `T`. It is not a game rule. When a test also passes `constants.MATCH_T` / `SUDDEN_DEATH_T`, those knobs are the §5.8 clocks and `T` is only how long to simulate (e.g. `T: 8` with `MATCH_T: 5`). If `sim_until` is omitted, short lab fixtures that set `MATCH_T` to `T` still end at `MATCH_T` when `SUDDEN_DEATH_T` is left at the default.

`scripted_damage` **does not** pierce the 1.5 s spawn shield (L220). Fixtures that must re-kill a just-respawned unit set `constants.SPAWN_SHIELD_S: 0` (or wait the shield out). Do not invent a silent pierce.

`scripted_cc` is applied so it is visible to phase-11 occupancy on the apply tick (G8, S3-R5-1) and so that a newly applied CC is not ticked down on that tick (L144 "Tick existing durations"). Occupancy, bars, and pickup then see the new status the same tick.

The production claim path (a net +1 fight win, no `scripted_claim_open`) still uses G9 / §5.6 when `ai_enabled` is false: scripted kills inside a legal fight must open a claim the same way an AI-on fight would. That is the scoring rule, not a new hook.

## `MatchState` additions (build spec §14.7 L1546–1549, S3-R5-1, S3-R5-9)

Expose on `simulate().state` (public, after the match or when it ended):

```
zone: {
  owner: "blue" | "red" | null;
  progress_blue: number;     // public unit: seconds (ticks/10, 4 dp). Internal bars are 0..30 ticks (S3-R5-1 L1936).
  progress_red: number;
  tick_timer: number;        // seconds (ticks/10, 4 dp); pauses, resets only on ownership change
  occupied: UnitId[];        // living, not banished, dist ≤ ZONE_RADIUS, unit order (S3-R5-4)
  control_time: [number, number] | { blue: number; red: number };
                             // seconds of owned + exclusive occupation (ticks/10)
}
claim: { team: "blue" | "red"; resolve_at: number; fight_id?: string } | null;
orbs: Array<{ orb_id?: string | number; x: number; y: number; up: boolean; respawn_at?: number }>; // length 8
buffs: Array<{ buff_id?: string | number; x: number; y: number; up: boolean; respawn_at?: number; holders?: UnitId[] }>; // length 2
phase: "play" | "sudden_death" | "extra_15" | "ended";
rng_counters: Record<string, number>;  // §14.7; tests read `tiebreak` (S3-R5-6)
```

Internal counters are integer ticks (S3-R5-1 L1934). Public `progress_*`, `tick_timer` and `control_time` are **seconds** (`ticks / 10`, 4 dp, G10). The harness also accepts raw ticks if a field exceeds its second-scale max (3 for bars, 12 for the tick timer, 400 for control time), but implementers should ship seconds.

Owner's bar is held at 0 once they own the zone; only a non-owner accumulates (S3-R5-1). Capture at 30 exclusive ticks: `owner = X`, emit `zone_capture`, both bars 0, `tick_timer` 0, then the capture tick counts as the new owner's first timer / control-time tick.

`score_blue`, `score_red`, `ended`, `end_reason`, `winner`, `tick`, `t`, `units` already exist. `end_reason` and `match_end.reason` use the §4.4 enum: `first_to_10` | `clock` | `sudden_death` | `zone_time` | `takedowns` | `coin_flip`. Sandbox matches are **Bo1** (sandbox §2.1 L66); this suite never requests a series replay. A series map-draw reason is deferred (see `DEFERRED.md`).

`match_end.score_blue/red` are the end-of-tick totals including every event of that tick; those events are logged before `match_end` (S3-R5-2 L1950).

Orb pads: the eight §5.7 tile indices, placed at tile centres (Appendix R #2). Buff pads already sit at `(7.5, 7.5)` and `(16.5, 7.5)`.

## `SimulateResult` additions (career-match/1.x, S3-R5-8, S3-R5-9)

```
player_stats: Array<{
  unit_id: UnitId;           // slot order, blue then red
  claim_denies: number;      // i32; +1 for each appearance in claim_deny.deniers (S3-R5-8 L1966, C-R-5)
  zone_seconds: number;      // f64, 4 dp; occupant ticks / 10 (S3-R5-9 L1968)
}>
```

`player_stats` may alternatively be `summary.players` with the same fields. `zone_seconds` is required in v2 (raw presence, including contested). Invariants: per unit `zone_seconds ≤ match seconds`; per team Σ `zone_seconds ≥ control_time[team]`.

Team totals `claim_opened` / `claim_denied` / `claim_paid` and `score_parts: { kills, ticks, claims }` (sandbox §8.2) may be placed on `summary`; this suite also accepts those counts derived from the event log. `score_parts.kills` is takedown **team points**, not personal KDA.

## Events

Emit the §4.4 payloads for `orb_spawn`, `orb_pickup`, `buff_spawn`, `buff_pickup`, `zone_capture`, `zone_tick`, `claim_open`, `claim_award`, `claim_deny`, `takedown_score`, `xp_gain` (sources `time` | `kill` | `assist` | `orb`; **`catchup` is never emitted in v1**, S3-R5-3 L1955), `level_up`, `match_end`.

**v2 additive on `claim_deny` (S3-R5-8 L1966):** `deniers: unit_id[]` — every unit that meets the dwell, in unit order. `denier_id` stays the closest to centre among them (tie: unit order). Tests read `deniers`; they do not assert the exact key set of the event. A `claim_award` has no `deniers`. Digest recipe is unchanged (G10).

Catch-up is folded into the award: orb `xp_gain` + `orb_pickup.xp` are 138 when eligible; time XP is 1.3225 with `source:"time"`.

## Win condition (L311, S3-R5-10, S3-R5-2)

A team wins when their score is **≥ `SCORE_TO_WIN` and strictly higher than the other team** at the end of the tick, decided in phase 14. Both at 10+ and level: no winner that tick. Phase 14 precedence: (1) `first_to_10`, (2) the 4:00 clock and the 4:30 ladder, (3) `sudden_death`. A score on the 240.0, 270.0 or 285.0 tick counts (G4). Sudden-death trades on one tick cancel.

Bo1 extra window: 270.0 < t ≤ 285.0, phase `extra_15`, a score ends with reason `sudden_death` (S3-R5-6). The 4:30 ladder runs once at 270.0 and is not re-run at 285.0. Deadlock at 285.0: `coin_flip`.

## Tick / clock (already ruled, restated)

- Tick 0 is setup only (G3). Tick `n` has `t = n/10`. Tick 2400 (`t = 240.0`) is simulated when the match lasts that long.
- Orb and buff spawns apply in phase 11 of the tick that reaches their clock, **before** the pickup check; a unit already on the pad picks up on the **next** tick (G4). Pickup is once per tick, end-of-tick positions only, no swept path (S3-R5-5).
- Time-limit and sudden-death ends evaluate in phase 14 after scoring; a point scored on the `MATCH_T` tick counts (G4).
- Time XP is phase 10, after death checks: living at end of phase 10 get `TIME_XP_PER_S * DT` (×1.15 when catch-up eligible from the tick-start snapshot); a unit that dies this tick gets none; a unit that respawns this tick gets it (G2). Kill / assist XP same phase, before time XP; then level-ups.
- Aura uses the previous tick's committed zone state (S3-R5-7). First aura tick is the tick after `zone_capture`.

## Out of this contract

Quick draft, player generation, cards, series Bo3/Bo5 replay / map-draw reason, and the 400 / 2,000-game sanctuary lab are not required public API for this pack (see `DEFERRED.md`).
