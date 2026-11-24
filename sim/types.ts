/** Shared sim types for S0. */

export type Team = "blue" | "red";
export type Slot = "top" | "jungle" | "mid" | "adc" | "support";
export type UnitId = `${Team}:${Slot}`;

export type StreamId =
  | "combat"
  | "skillshot"
  | "ai"
  | "cards"
  | "draft"
  | "tiebreak"
  | "player"
  | "cosmetic";

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Coach tactics (§12 / Appendix R #3 S2-6).
 * S1 frozen API deviation — before: combo_style "auto"|"aggressive"|"conservative"
 * (no focus / secondary). After: combo_style "auto"|"hold_R"; optional focus + secondary.
 */
export interface Tactics {
  preset: "hold_the_pit" | "hunt" | "starve";
  /** Optional secondary preset (§12 L1344: planner would otherwise idle). */
  secondary?: "hold_the_pit" | "hunt" | "starve";
  aggression: -1 | 0 | 1;
  protect_the_carry: boolean;
  combo_style: "auto" | "hold_R";
  /** `auto` or an enemy slot; that slot's targeting score ×1.25 (§12 L1352). */
  focus?: "auto" | "top" | "jungle" | "mid" | "adc" | "support";
}

export interface PlayerAttrs {
  aim: number;
  reflexes: number;
  execution: number;
  decision: number;
  positioning: number;
  teamwork: number;
}

export interface PlayerConfig {
  name: string;
  attrs: PlayerAttrs;
  mastery: Record<string, number>;
}

export interface SideConfig {
  players: PlayerConfig[];
  picks: string[];
  tactics: Tactics;
}

export interface MatchConfig {
  seed: number;
  constants?: Partial<Record<string, unknown>>;
  blue: SideConfig;
  red: SideConfig;
  draft_mode: "quick" | "full" | "fixed";
  notes?: string;
  /** S0: end at MATCH_T with reason clock; ignore first-to-10. */
  forced_clock_end?: boolean;
  /** Optional per-unit scripted motor waypoints (lab / tests). */
  scripted_motor?: Partial<Record<UnitId, ScriptedMotor>>;
  /** Emit debug `pos` events (excluded from digest). */
  debug_pos?: boolean;
  /** Lab-only: assert sanctuary each tick; emit sanctuary_violation on failure. */
  assert_sanctuary?: boolean;
  /** Lab/test: override initial unit pose / vitals after spawn. */
  unit_overrides?: Partial<
    Record<
      UnitId,
      {
        x?: number;
        y?: number;
        hp?: number;
        xp?: number;
        level?: number;
        champ?: string;
        attrs?: Partial<PlayerAttrs>;
        spawn_shield_until?: number;
        /** Lab: block autos until this sim t (windup may not start). */
        auto_next_start_t?: number;
        /** Lab: override attack range (e.g. force melee ≤ 2). */
        range?: number;
        /** Lab: move-speed override (tiles/s). */
        ms?: number;
        as?: number;
        /** Lab/test: seed AI focus target (e.g. Torun W taunt diver). */
        ai_target_id?: UnitId | null;
      }
    >
  >;
  /** Lab/test: inject raw damage packets on a given tick (phase 4). */
  scripted_damage?: Array<{
    tick: number;
    source_id: UnitId;
    target_id: UnitId;
    raw: number;
  }>;
  /** Lab/test: scripted ability casts (S1; no AI). */
  scripted_casts?: ScriptedCast[];
  /** Lab: on a tick, fire N Aim skillshot rolls through the sim RNG (M1-19b). */
  scripted_skillshots?: Array<{
    tick: number;
    source_id: UnitId;
    target_id: UnitId;
    count: number;
  }>;
  /** Lab: force attack_reset_pending on a unit at a tick. */
  scripted_attack_reset?: Array<{ tick: number; unit_id: UnitId; pending: boolean }>;
  /** Lab: inject a heal (for assist credit tests). */
  scripted_heals?: Array<{
    tick: number;
    source_id: UnitId;
    target_id: UnitId;
    amount: number;
  }>;
  /** Lab: apply a CC kind directly (Blind / Break inject for fixtures). */
  scripted_cc?: Array<{
    tick: number;
    target_id: UnitId;
    kind: import("./status.js").CcKind;
    duration: number;
    source_id?: UnitId;
  }>;
  /**
   * S2: enable fight-layer AI. Opt-in — defaultEvenConfig leaves false so the
   * unedited S1 suite stays correct. S2 `configOf` sets true.
   */
  ai_enabled?: boolean;
  /** Lab: skip Decision perception delay for peel geometry tests. */
  ai_ignore_perception?: boolean;
  /**
   * S3 lab: treat a net +1 fight win as occurring on this tick (§5.6 / _contract.md).
   */
  scripted_claim_open?: Array<{
    tick: number;
    team: Team;
    fight_id?: string;
  }>;
  /**
   * Lab: stop the sim at this time (seconds). Harness sets it from scenario T so
   * short fixtures can observe MATCH_T without running the full Bo1 ladder.
   */
  sim_until?: number;
}

export interface ScriptedCast {
  tick: number;
  source_id: UnitId;
  skill: "Q" | "W" | "R";
  target_id?: UnitId;
  aim_x?: number;
  aim_y?: number;
  /** Skip Aim roll (lab fixtures that pin damage/CC). */
  force_hit?: boolean;
  /**
   * Lab-only §9.4.1.4 rule 12 tier. Additive. Stripped in digestEvents
   * (same exclusion class as `pos`).
   */
  tier?: "P1a" | "P1b" | "P1c" | "P1d" | "P2" | "P2c" | "P3" | "P4" | "P4s";
}

export interface ScriptedMotor {
  /** Waypoints in order; unit steers toward current until within arrive_r, then advances. */
  waypoints: Vec2[];
  arrive_r?: number;
  /** Hold still after last waypoint. Default true. */
  hold_at_end?: boolean;
}

export interface DummyStats {
  hp: number;
  regen: number;
  atk: number;
  pow: number;
  pres: number;
  mres: number;
  as: number;
  crit: number;
  range: number;
  ms: number;
}

export interface UnitState {
  id: UnitId;
  team: Team;
  slot: Slot;
  index: number;
  champ: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  max_hp: number;
  xp: number;
  level: number;
  alive: boolean;
  /** Sim t at which a dead unit respawns at its own slot (Infinity while alive). */
  respawn_at: number;
  spawn_shield_until: number;
  auto_cd: number;
  /** Remaining windup time (s); 0 = not winding up. */
  auto_windup_left: number;
  /** Target locked at windup start. */
  auto_windup_target: UnitId | null;
  /** Earliest t at which the next auto windup may start. */
  auto_next_start_t: number;
  stats: DummyStats;
  attrs: PlayerAttrs;
  /** Flank buff expiry sim t (0 if none). +12% dmg / +10% MS while active. */
  flank_buff_until: number;
  /** Mastery 0–100 for the current champion (default 50 when unset). */
  mastery: number;
  intent: string;
  waypoint: Vec2 | null;
  scripted_wp_i: number;
  /** Recent damage contributors for assist credit: { source_id, t }. */
  damage_log: Array<{ source_id: UnitId; t: number }>;
  /** CC / heal / shield assist contributions (§6.10). */
  assist_log: Array<{ source_id: UnitId; t: number; kind: "damage" | "cc" | "heal" | "shield" }>;
  last_hit_by: UnitId | null;
  /** Soft CC / status bookkeeping (S1). */
  status: import("./status.js").StatusState;
  /** Attack-reset pending: blocks new auto windup until cleared (§6.8). */
  attack_reset_pending: boolean;
  /** Last sim t damage received / dealt (combat-heal window). */
  last_damage_t: number;
  last_dealt_t: number;
  marks: import("./marks.js").MarkInstance[];
  cd_q: number;
  cd_w: number;
  cd_r: number;
  cast_left: number;
  cast_skill: "Q" | "W" | "R" | null;
  cast_target: UnitId | null;
  cast_aim_x: number;
  cast_aim_y: number;
  cast_force_hit: boolean;
  cast_seq: number;
  /** Instant circle AoE: unit ids in radius at cast_start (Still Hour / Mire). */
  cast_snapshot_ids: UnitId[] | null;
  break_until: number;
  commit_until: number;
  /** Saelo Rewound Moment: once per fight. */
  rewind_used: boolean;
  /** After fear, ignore scripted motor and re-enter AA range if autos are on. */
  abandon_scripted_motor: boolean;
  /** S2: Unit Brain current target (autos prefer this when in range). */
  ai_target_id: UnitId | null;
  /** Set by AI when Teamwork forbids freelance autos (focus dead / awaiting call). */
  ai_no_freelance?: boolean;
  /**
   * S2-R4-5: sim t until which a mobile Retreat/Regroup suppresses new autos and
   * damage-only casts (0 = inactive). Cleared when the disengage call flips;
   * expires at regroup_s.
   */
  ai_retreat_suppress_until: number;
  /**
   * §9.6 L1164: sim t until which WalkFromPad applies after a respawn.
   * Match-start spawn does not set this — only post-death respawn does.
   */
  walk_from_pad_until: number;
  /**
   * Planner arrival hysteresis: once inside arrive_r, stay "at waypoint" until
   * leave_r so HoldZone ↔ Idle does not flicker every tick.
   */
  ai_at_planner_wp: boolean;
  /**
   * §9.2 "do not trickle back in 1s": sim t until which a Retreat↔HoldZone
   * (planner re-entry) flip is blocked after Retreat begins.
   */
  ai_no_trickle_until: number;
  /** True after this life has fired at least one auto (first-auto pose hold). */
  ai_first_auto_done: boolean;
  /** S3-R5-7: +ZONE_AURA_RES while previous-tick exclusive owner occupant. */
  zone_aura_res: number;
  /**
   * HP lost after shields over recent ticks (§9.4.1 incoming_1s / Doomed).
   * Not an event field; omitted from the digest.
   */
  recent_taken?: Array<{ t: number; hp: number }>;
}

export interface Displacement {
  unit_id: UnitId;
  dx: number;
  dy: number;
  land_tick: number;
  spawn_seq: number;
  source_id: string;
  skill_id: string;
  /** If set, queue a follow-up hop this many ticks after THIS hop lands. */
  return_dx?: number;
  return_dy?: number;
  return_delay_ticks?: number;
}

export interface PendingDamage {
  seq: number;
  source_id: UnitId;
  target_id: UnitId;
  skill_id: string;
  raw: number;
  physical: boolean;
  crit: boolean;
  /** If set, apply this HP loss path directly (already skill_scale/amps/mit). */
  pre_mitigated?: number;
}

export interface PendingSkillLand {
  land_t: number;
  spawn_seq: number;
  source_id: UnitId;
  skill: "Q" | "W" | "R";
  skill_id: string;
  aim_x: number;
  aim_y: number;
  radius: number;
  target_id: UnitId | null;
  champ: string;
}

/** Queued CC / slow / mark-side status for phase 9. */
export interface PendingStatus {
  seq: number;
  source_id: UnitId;
  target_id: UnitId;
  kind: import("./status.js").CcKind;
  category: import("./status.js").CcCategory;
  raw_duration: number;
  school: "physical" | "magic";
  slow?: number;
  petrify?: boolean;
  hex_from?: string;
  /** Well-Fed / assist bookkeeping: skill that caused this CC. */
  skill_id?: string;
}

export interface PendingHeal {
  seq: number;
  source_id: UnitId;
  target_id: UnitId;
  skill_id: string;
  raw: number;
  /** If true, skip skill_scale (already baked or passive). */
  skip_skill_scale?: boolean;
  /** Override combat scale (e.g. Well-Fed uses combat_heal_multiplier from passive). */
  combat_mult?: number;
}

export interface PendingShield {
  seq: number;
  source_id: UnitId;
  target_id: UnitId;
  skill_id: string;
  raw: number;
  duration_s: number;
  skip_skill_scale?: boolean;
}

export interface MatchState {
  tick: number;
  t: number;
  seed: number;
  constants_hash: string;
  data_hash: string;
  score_blue: number;
  score_red: number;
  /** Kill counts for the §5.8 takedowns ladder (not assists, not claims/ticks). */
  takedowns_blue: number;
  takedowns_red: number;
  ended: boolean;
  end_reason: string | null;
  winner: "blue" | "red" | "draw" | null;
  units: UnitState[];
  displacements: Displacement[];
  pending_damage: PendingDamage[];
  pending_status: PendingStatus[];
  pending_heals: PendingHeal[];
  pending_shields: PendingShield[];
  event_seq: number;
  config: MatchConfig;
  forced_clock_end: boolean;
  /** S3 — public zone view (seconds). */
  zone?: {
    owner: Team | null;
    progress_blue: number;
    progress_red: number;
    tick_timer: number;
    occupied: UnitId[];
    control_time: { blue: number; red: number };
  };
  claim?: { team: Team; resolve_at: number; fight_id?: string } | null;
  orbs?: Array<{ orb_id: string; x: number; y: number; up: boolean; respawn_at?: number }>;
  buffs?: Array<{
    buff_id: string;
    x: number;
    y: number;
    up: boolean;
    respawn_at?: number;
    holders?: UnitId[];
  }>;
  phase?: "play" | "sudden_death" | "extra_15" | "ended";
  rng_counters?: Record<string, number>;
}

export type EventPayload = Record<string, unknown>;

export interface SimEvent {
  t: number;
  tick: number;
  seq: number;
  type: string;
  [key: string]: unknown;
}

export interface SimulateResult {
  state: MatchState;
  events: SimEvent[];
  digest: string;
  constants_hash: string;
  data_hash: string;
  tick_count: number;
  /** S2 peel lab counters (present when ai_enabled). */
  ai_stats?: { dive_geom: number; peel_fired: number; peel_rate: number | null };
  /** S3 career stats (S3-R5-8 / S3-R5-9). */
  player_stats?: Array<{
    unit_id: UnitId;
    claim_denies: number;
    zone_seconds: number;
  }>;
}
