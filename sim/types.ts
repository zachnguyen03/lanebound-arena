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

export interface Tactics {
  preset: "hold_the_pit" | "hunt" | "starve";
  aggression: -1 | 0 | 1;
  protect_the_carry: boolean;
  combo_style: "auto" | "aggressive" | "conservative";
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
        as?: number;
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
  break_until: number;
  commit_until: number;
}

export interface Displacement {
  unit_id: UnitId;
  dx: number;
  dy: number;
  land_tick: number;
  spawn_seq: number;
  source_id: string;
  skill_id: string;
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

export interface MatchState {
  tick: number;
  t: number;
  seed: number;
  constants_hash: string;
  data_hash: string;
  score_blue: number;
  score_red: number;
  ended: boolean;
  end_reason: string | null;
  winner: "blue" | "red" | "draw" | null;
  units: UnitState[];
  displacements: Displacement[];
  pending_damage: PendingDamage[];
  event_seq: number;
  config: MatchConfig;
  forced_clock_end: boolean;
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
}
