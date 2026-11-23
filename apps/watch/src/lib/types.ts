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

export interface UnitView {
  id: UnitId;
  team: Team;
  slot: Slot;
  champ: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  alive: boolean;
  respawnAt: number | null;
  /** True when champ art was missing and a labelled placeholder is drawn. */
  fallback: boolean;
}

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
  "cast_start",
  "cast_cancel",
  "projectile_spawn",
  "hit",
  "heal",
  "shield_apply",
  "status_apply",
  "status_expire",
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
