/**
 * Sandbox §8.2 BatchConfig / MatchSummary / BatchResult (+ dashboard row shape).
 * Lab-only — never imported by sim/.
 */
import type { MatchConfig, PlayerAttrs, Slot, Team } from "../../../sim/types.js";

export type BatchScheme =
  | "seed_range"
  | "random_draft"
  | "archetype_matrix"
  | "isolation";

export type AttrName = keyof PlayerAttrs;

export type ArchetypeTag = "Dive" | "Peel" | "Poke" | "Balanced" | "Other";

export type DashboardMark = "pass" | "fail" | "under-powered" | "report";

export interface IsolationPin {
  attr: AttrName;
  plus: number;
  slot: Slot;
  side: Team;
}

export interface BatchConfig {
  base: MatchConfig;
  n: number;
  scheme: BatchScheme;
  seed_start?: number;
  pins?: {
    attrs_all?: number;
    /** Override teamwork after attrs_all (isolation follow-up floor). */
    teamwork_all?: number;
    mastery_all?: number;
    /**
     * §8.5 mastery isolation: set mastery for ONE player's current pick only.
     * Does not raise mastery on the other nine players.
     */
    mastery_one?: {
      side: Team;
      slot: Slot;
      value: number;
    };
    isolation?: IsolationPin;
  };
  isolation?: IsolationPin;
  save_decisions?: boolean;
  save_full_events?: boolean;
  /** Lab: emit sanctuary_violation on illegal centres (default true for batches). */
  assert_sanctuary?: boolean;
  /**
   * When true, each seed runs twice: as-rolled and with blue/red picks swapped.
   * n = total games; pair count = floor(n/2). Used to separate comp lean from side lean.
   */
  side_swap_pairs?: boolean;
}

export interface ScoreParts {
  kills: number;
  ticks: number;
  claims: number;
}

export interface KdaRow {
  k: number;
  d: number;
  a: number;
  dmg: number;
}

export interface MatchSummary {
  seed: number;
  digest: string;
  winner: "blue" | "red" | "draw" | null;
  reason: string | null;
  duration_s: number;
  score_blue: number;
  score_red: number;
  score_parts: { blue: ScoreParts; red: ScoreParts };
  archetypes: { blue: ArchetypeTag; red: ArchetypeTag };
  champ_ids: string[];
  peel_fired: number;
  peel_eligible: number;
  sanctuary_violations: number;
  claim_opened: number;
  claim_denied: number;
  claim_paid: number;
  t_first_R: number | null;
  t_L7: number | null;
  kda: KdaRow[];
  /** Lab-layer fight-quality (inventions — see fight-quality.ts). */
  fight_quality: FightQualityMetrics;
}

export interface FightQualityMetrics {
  f1_teamfights: number;
  f2_combo_chains: number;
  f3_clutch_moments: number;
  f4_close_finish: 0 | 1;
  lead_changes: number;
  /** Pit-centred fight_call fraction (0–1); stand-in for R6-5 contested owned time. */
  contested_pit_share: number;
  f4_comeback: 0 | 1;
  f4_shutout: 0 | 1;
  f4_multikills: number;
}

export interface DashboardRow {
  id: string;
  metric: string;
  target: string;
  value: string;
  sample_size: number;
  mark: DashboardMark;
  notes?: string;
}

export interface BatchResult {
  batch_id: string;
  started_at?: string;
  config_hash: string;
  n_requested: number;
  n_finished: number;
  summaries: MatchSummary[];
  dashboard: {
    rows: DashboardRow[];
    aggregates: Record<string, unknown>;
  };
  cancelled: boolean;
  scheme: BatchScheme;
  seed_start: number;
}

export interface ConstantsPreset {
  name: string;
  parent: "default" | string;
  overrides: Record<string, unknown>;
  created_note?: string;
}
