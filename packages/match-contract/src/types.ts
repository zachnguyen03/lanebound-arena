/**
 * career-match/1. Field names from career GDD §14.
 * Additive 1.x: PlayerMatchStats.claim_denies (missing means 0).
 */

export const CAREER_MATCH_VERSION = "career-match/1" as const;

export type ContractVersion = typeof CAREER_MATCH_VERSION;

export type Stage = "regular" | "semi" | "final";
export type SeriesFormat = "bo1" | "bo3" | "bo5";
export type RunnerSource = "sim" | "fake";
export type Side = "blue" | "red";
export type Slot = "top" | "jungle" | "mid" | "adc" | "support";
export type DraftMode = "quick" | "full" | "fixed";
export type EndReason =
  | "first_to_10"
  | "clock"
  | "sudden_death"
  | "zone_time"
  | "takedowns"
  | "coin_flip";
export type TacticPreset = "hold" | "hunt" | "starve";
/** Sandbox §6.5.1 composition tags. Not tactic presets. */
export const COMP_ARCHETYPES = ["Dive", "Peel", "Poke", "Balanced"] as const;
export type CompArchetype = (typeof COMP_ARCHETYPES)[number];
export type CardOutcome = "fired" | "expired_unmet";

export const SLOTS: readonly Slot[] = ["top", "jungle", "mid", "adc", "support"];

export interface PlayerAttrs {
  aim: number;
  reflexes: number;
  execution: number;
  decision: number;
  positioning: number;
  teamwork: number;
}

export interface ContractPlayer {
  id: string;
  name: string;
  club_id: string;
  primary_slot: Slot;
  attrs: PlayerAttrs;
  ovr: number;
  mastery: Record<string, number>;
  signature_archive: string[];
  last_stack_ovr: number;
  age: number;
}

export interface Tactics {
  primary: TacticPreset;
  secondary?: TacticPreset;
  aggression: -1 | 0 | 1;
  focus?: string;
  protect?: string;
  combo_style: "auto" | "hold_R";
}

export interface CardInstance {
  id: string;
  holder_id: string;
}

export interface SideConfig {
  players: ContractPlayer[];
  picks: string[];
  tactics: Tactics;
  card_loadout: CardInstance[];
  club_id?: string;
}

export interface MatchConfig {
  seed: number;
  constants: Record<string, unknown>;
  blue: SideConfig;
  red: SideConfig;
  draft_mode: DraftMode;
  notes?: string;
}

export interface SeriesContext {
  contract_version: ContractVersion;
  competition_id: string;
  season_id: string;
  series_id: string;
  fixture_id?: string;
  stage: Stage;
  format: SeriesFormat;
  game_index: number;
  series_score: [number, number];
  team_ids: [string, string];
  used_picks: [string[], string[]];
  source: RunnerSource;
}

export interface ScoreParts {
  kills: number;
  ticks: number;
  claims: number;
}

export interface Kda {
  k: number;
  d: number;
  a: number;
  dmg: number;
}

export interface PlayerMatchStats {
  player_id: string;
  slot: Slot;
  champ_id: string;
  side: Side;
  k: number;
  d: number;
  a: number;
  dmg: number;
  heals: number;
  zone_seconds: number;
  orbs: number;
  peels: number;
  /** career-match/1.x. Missing is 0. */
  claim_denies?: number;
  rating: number;
  z: number;
}

export interface CardMatchLog {
  card_id: string;
  holder_id: string;
  side: Side;
  outcome: CardOutcome;
  t_fired?: number;
}

export interface MatchResult {
  contract_version: ContractVersion;
  source: RunnerSource;
  competition_id: string;
  season_id: string;
  series_id: string;
  game_index: number;
  seed: number;
  digest: string;
  winner: Side;
  reason: EndReason;
  duration_s: number;
  score_blue: number;
  score_red: number;
  score_parts: [ScoreParts, ScoreParts];
  archetypes: { blue: CompArchetype; red: CompArchetype };
  /** career-match/1.x additive. Tactic preset for each side. */
  tactics: { blue: TacticPreset; red: TacticPreset };
  champ_ids: string[];
  peel_fired: number;
  peel_eligible: number;
  sanctuary_violations: number;
  claim_opened: number;
  claim_denied: number;
  claim_paid: number;
  t_first_R: number;
  t_L7: number;
  kda: Kda[];
  constants_hash: string;
  players: PlayerMatchStats[];
  cards: CardMatchLog[];
  mvp_player_id: string;
}

export interface SeriesResult {
  contract_version: ContractVersion;
  competition_id: string;
  season_id: string;
  series_id: string;
  fixture_id?: string;
  stage: Stage;
  format: SeriesFormat;
  team_ids: [string, string];
  winner_team_id: string;
  series_score: [number, number];
  games: MatchResult[];
  mvp_player_id: string;
  duration_s: number;
  source: RunnerSource;
  placement_note?: string;
}
