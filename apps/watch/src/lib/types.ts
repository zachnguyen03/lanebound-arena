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
}

export interface OrbView {
  id: string;
  x: number;
  y: number;
  up: boolean;
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

export interface MatchEffects {
  telegraphs: TelegraphFx[];
  projectiles: ProjectileFx[];
  hitFlashes: HitFlashFx[];
  statuses: StatusIconFx[];
  skillTags: SkillTagFx[];
  ultPulses: UltPulseFx[];
  casterFlashes: CasterFlashFx[];
}

/** Champ ids with a body sheet shipped under arena-sandbox/. */
export const CHAMP_ART: ReadonlySet<string> = new Set(["dummy"]);

export interface MatchViewState {
  tick: number;
  t: number;
  seed: number | null;
  constantsHash: string | null;
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
  orbs: OrbView[];
  buffs: OrbView[];
  fightBlue: FightCallView | null;
  fightRed: FightCallView | null;
  /** Deterministic VFX intervals derived from the event log. */
  effects: MatchEffects;
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
  "zone_capture",
  "zone_tick",
  "claim_open",
  "claim_award",
  "claim_deny",
  "takedown_score",
  "fight_call",
  "peel_start",
]);
