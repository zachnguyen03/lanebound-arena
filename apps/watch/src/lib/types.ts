export type Team = "blue" | "red";
export type Slot = "top" | "jungle" | "mid" | "adc" | "support";
export type UnitId = `${Team}:${Slot}`;

export interface SimEvent {
  t: number;
  tick: number;
  seq: number;
  type: string;
  [key: string]: unknown;
}

export type Facing = "left" | "right";

export interface UnitView {
  id: UnitId;
  team: Team;
  slot: Slot;
  champ: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  alive: boolean;
  respawnAt: number | null;
  /** Last movement / aim facing; held while idle. */
  facing: Facing;
  /** Sim t when the current one-shot hit anim started; null if none. */
  hitStartedAt: number | null;
  /** Sim t when this unit's attack anim started; null if none. */
  attackStartedAt: number | null;
  /** Sim t when a cast anim started; null if none. */
  castStartedAt: number | null;
  castDur: number;
  castSkill: string | null;
  /** Sim t when death anim started; null if living / pre-death. */
  deathStartedAt: number | null;
  /** True when champ art was missing and a labelled circle is drawn. */
  fallback: boolean;
  intent: string | null;
  targetId: string | null;
  /** Running K/D/A from death events. */
  kda: { k: number; d: number; a: number };
  /** exp cadence: sim t the flank buff expires (0 / undefined = none). */
  buffUntil?: number;
  /** HP before the current burst of hits and when the last one landed (HP bar damage chunk). */
  chipHp?: number;
  chipAt?: number;
}

export interface OrbView {
  id: string;
  x: number;
  y: number;
  up: boolean;
  /** exp cadence (buffs only): sim t of the next spawn, from buff_pickup / buff_soon. */
  nextSpawnAt?: number | null;
}

export interface FightCallView {
  commit: string;
  focusId: string | null;
  aTrue: number | null;
}

/** Wind-up telegraph interval derived from cast_start (+ cancel / end). */
export interface TelegraphFx {
  id: string;
  unitId: UnitId;
  champ: string;
  team: Team;
  skillId: string;
  skillKey: "Q" | "W" | "R" | "?";
  kind: "line" | "aoe" | "cone" | "self" | "dash" | "dotted-leash" | "double-ring";
  isUlt: boolean;
  startedAt: number;
  endsAt: number;
  aimX: number;
  aimY: number;
  targetId: string | null;
  radius: number;
  width: number;
  groundFx?: string;
}

/** Projectile travelling between spawn and land / hit. */
export interface ProjectileFx {
  projId: string;
  unitId: UnitId;
  champ: string;
  team: Team;
  skillId: string;
  isAuto: boolean;
  /** Atlas vfx key or huntress style. */
  artKey: string | null;
  trail?: "bronze-leash" | "iron-chain" | "spark";
  spawnT: number;
  landT: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Cleared early if a matching hit lands before land_t. */
  endedAt: number;
}

/** Brief skill-hit flash + impact burst on a target. */
export interface HitFlashFx {
  id: string;
  targetId: UnitId;
  sourceId: UnitId | null;
  champ: string;
  skillId: string;
  impactKeys: string[];
  startedAt: number;
  endsAt: number;
}

/** Status icon over a unit for its applied duration. */
export interface StatusIconFx {
  id: string;
  targetId: UnitId;
  /** Who applied it (status_apply.source_id) — caster ring / snap line. */
  sourceId?: UnitId | null;
  kind: string;
  startedAt: number;
  endsAt: number;
}

/** Floating Q/W/R + name tag above the caster. */
export interface SkillTagFx {
  id: string;
  unitId: UnitId;
  team: Team;
  skillKey: "Q" | "W" | "R" | "?";
  skillName: string;
  startedAt: number;
  endsAt: number;
}

/** Short R-cast screen emphasis (ring / shake), never over HUD. */
export interface UltPulseFx {
  id: string;
  unitId: UnitId;
  team: Team;
  x: number;
  y: number;
  startedAt: number;
  endsAt: number;
}

/** Brief caster ring/flash at cast_start so the origin is readable. */
export interface CasterFlashFx {
  id: string;
  unitId: UnitId;
  team: Team;
  isUlt: boolean;
  startedAt: number;
  endsAt: number;
}

/**
 * One signature ult cast (vfx-ults v1/v2 art). Positions are sim tiles.
 * `hitT` is null until cast_end / projectile_spawn makes it authoritative;
 * the renderer predicts it from the strip's cast_s + land_delay_s meanwhile.
 */
export interface UltFx {
  id: string;
  unitId: UnitId;
  champ: string;
  team: Team;
  startedAt: number;
  endsAt: number;
  hitT: number | null;
  /** Floor anchor in tiles (aim, target foot or caster foot, per champion). */
  anchorX: number;
  anchorY: number;
  /** Cast vector in tiles (dash start → target, caster → aim). */
  dirX: number;
  dirY: number;
  /** Strips face right; mirror when the cast goes left. */
  facingLeft: boolean;
  targetId: string | null;
}

/** Floating damage number over a skill hit's target (ults larger). */
export interface DamageNumFx {
  id: string;
  targetId: UnitId;
  amount: number;
  ult: boolean;
  startedAt: number;
  endsAt: number;
}

export interface KillBurstFx {
  id: string;
  victimId: UnitId;
  /** Killer's team — the burst core colour. */
  team: Team;
  shutdown: boolean;
  x: number;
  y: number;
  startedAt: number;
  endsAt: number;
}

export interface MatchEffects {
  telegraphs: TelegraphFx[];
  projectiles: ProjectileFx[];
  hitFlashes: HitFlashFx[];
  statuses: StatusIconFx[];
  skillTags: SkillTagFx[];
  ultPulses: UltPulseFx[];
  casterFlashes: CasterFlashFx[];
  ults: UltFx[];
  killBursts: KillBurstFx[];
  damageNums: DamageNumFx[];
}

/** Champ ids with a body sheet shipped under arena-sandbox/. */
export const CHAMP_ART: ReadonlySet<string> = new Set(["dummy"]);

export interface PointView {
  id: string;
  x: number;
  y: number;
  r: number;
  owner: "blue" | "red" | null;
  /** objective_state feed (points mode): who is capturing and how far, 0–1. */
  by?: "blue" | "red" | null;
  progress?: number;
  contested?: boolean;
}

export interface TacticView {
  preset: string;
  aggression: number;
}

/** Per-team score split: kill points vs objective points. */
export interface ScoreSplit {
  kills: number;
  obj: number;
  /** Match time of the last objective point (−1 = none); drives the +1 pop. */
  objAt: number;
}

export interface MatchViewState {
  tick: number;
  t: number;
  seed: number | null;
  constantsHash: string | null;
  /** First-to target; 10 unless the match says otherwise (points mode). */
  scoreToWin: number;
  /** Points mode: seconds between majority ticks (objectives_init). */
  majorityTickS: number;
  scoreBlue: number;
  scoreRed: number;
  ended: boolean;
  endReason: string | null;
  winner: "blue" | "red" | "draw" | null;
  units: Record<UnitId, UnitView>;
  blueLineup: string[];
  redLineup: string[];
  fallbackChamps: string[];
  zoneOwner: "blue" | "red" | null;
  /** exp/objectives capture points (empty for the single-pit match). */
  points: PointView[];
  /** Points mode majority: holder and seconds to next tick at time `at`. */
  majority: { team: Team; leftS: number; at: number } | null;
  tactics: { blue: TacticView | null; red: TacticView | null };
  split: { blue: ScoreSplit; red: ScoreSplit };
  orbs: OrbView[];
  buffs: OrbView[];
  fightBlue: FightCallView | null;
  fightRed: FightCallView | null;
  /** Deterministic VFX intervals derived from the event log. */
  effects: MatchEffects;
  /** Kills since last death, per unit (kill-burst shutdown read). */
  streaks: Record<string, number>;
  /** Last kill time per killer (multi-kill read). */
  lastKillT: Record<string, number>;
}

export type Speed = 0.5 | 1 | 2 | 4 | 8;

export const SLOTS: Slot[] = ["top", "jungle", "mid", "adc", "support"];
export const SLOT_LABEL: Record<Slot, string> = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  adc: "Carry",
  support: "Support",
};

/** Events the shell cannot render yet — listed in lab/s4/unrendered.md. */
export const UNRENDERED_EVENT_TYPES = new Set([
  "heal",
  "sleep_break",
  "dispel",
  "orb_spawn",
  "orb_pickup",
  "buff_spawn",
  "buff_pickup",
  "buff_soon",
  "buff_share",
  "zone_capture",
  "zone_tick",
  "claim_open",
  "claim_award",
  "claim_deny",
  "takedown_score",
  "fight_call",
  "peel_start",
  "spree",
  "shutdown",
  "anchor_start",
  "anchor_end",
  "sweep",
  "execute",
]);
