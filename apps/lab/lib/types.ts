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
    mastery_all?: number;
    isolation?: IsolationPin;
  };
  isolation?: IsolationPin;
  save_decisions?: boolean;
  save_full_events?: boolean;
  /** Lab: emit sanctuary_violation on illegal centres (default true for batches). */
  assert_sanctuary?: boolean;
  /**
   * When true, each of the `n` seeds runs twice (original + kit side-swap),
   * producing 2n games. Flip rate is computed across pairs.
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
  /** Total cast_start events this game. */
  casts?: number;
  /** True when this row is the kit-swapped twin of `seed`. */
  side_swapped?: boolean;
  /**
   * AI interrupts: cast_cancel reason lock|silence following a P1a cast_start
   * (M2-33 / R7-6b, report-only). Split by the interrupter's Reflexes band.
   */
  interrupts?: number;
  interrupts_by_reflexes?: { low: number; mid: number; high: number };
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
