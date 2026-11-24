/**
 * Headless batch runner — same simulate(config) as Watch.
 * No renderer / canvas imports (B3).
 */
import { createHash } from "node:crypto";
import { CHAMPIONS, type Slot } from "../../../data/champions/defs.js";
import { evenOvrConfig } from "../../../sim/match_config.js";
import { simulate } from "../../../sim/simulate.js";
import type { MatchConfig, PlayerAttrs } from "../../../sim/types.js";
import { ARCHETYPE_LINEUPS } from "./archetypes.js";
import { buildDashboard } from "./dashboard.js";
import { summarizeMatch } from "./summary.js";
import type {
  AttrName,
  BatchConfig,
  BatchResult,
  BatchScheme,
  IsolationPin,
  MatchSummary,
} from "./types.js";

/** §7 / R7-11 slot order — picks[i] must match Position i. */
export const DRAFT_SLOTS: readonly Slot[] = [
  "top",
  "jungle",
  "mid",
  "adc",
  "support",
] as const;

export const ATTRS: AttrName[] = [
  "aim",
  "reflexes",
  "execution",
  "decision",
  "positioning",
  "teamwork",
];

/** Official batch gate: 100..5000. Isolation preview may use smaller N via runBatchRaw. */
export function clampBatchN(n: number): number {
  if (!Number.isInteger(n) || n < 100 || n > 5000) {
    throw new Error(`Batch n must be an integer in 100..5000 (got ${n})`);
  }
  return n;
}

function attrsAll(value: number): PlayerAttrs {
  return {
    aim: value,
    reflexes: value,
    execution: value,
    decision: value,
    positioning: value,
    teamwork: value,
  };
}

function masteryAll(value: number): Record<string, number> {
  const m: Record<string, number> = {};
  for (const id of [
    "huntress",
    "maelis",
    "isra",
    "sedge",
    "torun",
    "tolle",
    "helvar",
    "calder",
    "kerrig",
    "mirren",
    "rhedan",
    "brannoch",
    "ysol",
    "saelo",
  ]) {
    m[id] = value;
  }
  return m;
}

function slotIndex(slot: string): number {
  return ["top", "jungle", "mid", "adc", "support"].indexOf(slot);
}

export function applyPins(
  base: MatchConfig,
  pins?: BatchConfig["pins"],
  isolation?: IsolationPin,
): MatchConfig {
  const cfg: MatchConfig = structuredClone(base);
  const attrsValue = pins?.attrs_all;
  const masteryValue = pins?.mastery_all;
  if (attrsValue !== undefined) {
    for (const side of [cfg.blue, cfg.red]) {
      for (const p of side.players) p.attrs = attrsAll(attrsValue);
    }
  }
  const teamworkValue = pins?.teamwork_all;
  if (teamworkValue !== undefined) {
    for (const side of [cfg.blue, cfg.red]) {
      for (const p of side.players) {
        p.attrs = { ...p.attrs, teamwork: teamworkValue };
      }
    }
  }
  if (masteryValue !== undefined) {
    const m = masteryAll(masteryValue);
    for (const side of [cfg.blue, cfg.red]) {
      for (const p of side.players) p.mastery = { ...m };
    }
  }
  const masteryOne = pins?.mastery_one;
  if (masteryOne) {
    const side = masteryOne.side === "red" ? cfg.red : cfg.blue;
    const idx = slotIndex(masteryOne.slot);
    const player = side.players[idx];
    const champ = side.picks[idx];
    if (player && champ) {
      const base = player.mastery ?? masteryAll(masteryValue ?? 50);
      player.mastery = {
        ...base,
        [champ]: Math.min(100, Math.max(0, masteryOne.value)),
      };
    }
  }
  const iso = isolation ?? pins?.isolation;
  if (iso) {
    const side = iso.side === "red" ? cfg.red : cfg.blue;
    const idx = slotIndex(iso.slot);
    const player = side.players[idx];
    if (player) {
      const next = { ...player.attrs };
      next[iso.attr] = Math.min(99, Math.max(1, next[iso.attr] + iso.plus));
      player.attrs = next;
    }
  }
  return cfg;
}

/** Swap blue/red picks (and draft_mode fixed). Same seed → side-swapped pair. */
export function swapPicks(cfg: MatchConfig): MatchConfig {
  const out = structuredClone(cfg);
  const bluePicks = out.blue.picks.slice();
  const redPicks = out.red.picks.slice();
  out.blue = { ...out.blue, picks: redPicks };
  out.red = { ...out.red, picks: bluePicks };
  out.draft_mode = "fixed";
  return out;
}

/** Mirror: both sides play the same five picks (blue's by default). */
export function mirrorPicks(cfg: MatchConfig, from: "blue" | "red" = "blue"): MatchConfig {
  const out = structuredClone(cfg);
  const picks = (from === "red" ? out.red.picks : out.blue.picks).slice();
  out.blue = { ...out.blue, picks: picks.slice() };
  out.red = { ...out.red, picks: picks.slice() };
  out.draft_mode = "fixed";
  return out;
}

/**
 * Lab-local Mulberry32 stream mixed from `seed` + domain tag.
 * INVENTION: not sim RNG stream `draft` (or any sim stream). Deterministic per seed.
 */
export function labDraftUnit(seed: number): () => number {
  let state =
    (Math.imul((seed >>> 0) ^ 0xd4a71c35, 0x9e3779b9) + 0x6d2b79f5) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Position pools from champion data (`default_slot`), sorted for stable indexing.
 * R7-11 sizes: Top 2, Jungle 3, Mid 4, ADC 3, Support 2.
 */
export function positionPoolsFromData(): Record<Slot, string[]> {
  const pools: Record<Slot, string[]> = {
    top: [],
    jungle: [],
    mid: [],
    adc: [],
    support: [],
  };
  for (const def of Object.values(CHAMPIONS)) {
    pools[def.default_slot].push(def.id);
  }
  for (const slot of DRAFT_SLOTS) {
    pools[slot].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  }
  return pools;
}

/** Count of Positions where blue and red field the same champion (0–5). */
export function mirroredPositionCount(
  blue: readonly string[],
  red: readonly string[],
): number {
  let n = 0;
  for (let i = 0; i < DRAFT_SLOTS.length; i++) {
    if (blue[i] === red[i]) n += 1;
  }
  return n;
}

/**
 * Role-random draft (R7-11 / M6 Scope): each team fields exactly one champion
 * per Position in its matching slot; each slot drawn independently and
 * uniformly from that Position's pool (from champion data). Cross-team
 * duplicates allowed (lab only). Not a uniform 14-champion deal.
 */
export function quickDraftPicks(seed: number): { blue: string[]; red: string[] } {
  const next = labDraftUnit(seed);
  const pools = positionPoolsFromData();
  const draw = (slot: Slot): string => {
    const pool = pools[slot];
    const j = Math.floor(next() * pool.length);
    return pool[j]!;
  };
  const blue: string[] = [];
  const red: string[] = [];
  for (const slot of DRAFT_SLOTS) {
    blue.push(draw(slot));
    red.push(draw(slot));
  }
  return { blue, red };
}

function configForGame(
  batch: BatchConfig,
  seed: number,
  gameIndex: number,
): MatchConfig {
  let base = structuredClone(batch.base);
  base.seed = seed;
  base.assert_sanctuary =
    batch.assert_sanctuary !== undefined ? batch.assert_sanctuary : true;

  if (batch.scheme === "random_draft") {
    const picks = quickDraftPicks(seed);
    base.blue = { ...base.blue, picks: picks.blue };
    base.red = { ...base.red, picks: picks.red };
    base.draft_mode = "quick";
  } else if (batch.scheme === "archetype_matrix") {
    const tags = ["Dive", "Peel", "Poke", "Balanced"] as const;
    const blueTag = tags[gameIndex % 4]!;
    const redTag = tags[Math.floor(gameIndex / 4) % 4]!;
    base.blue = {
      ...base.blue,
      picks: ARCHETYPE_LINEUPS[blueTag].slice(),
    };
    base.red = {
      ...base.red,
      picks: ARCHETYPE_LINEUPS[redTag].slice(),
    };
    base.draft_mode = "fixed";
  }

  return applyPins(base, batch.pins, batch.isolation);
}

export function configHashOf(batch: BatchConfig): string {
  const payload = {
    n: batch.n,
    scheme: batch.scheme,
    seed_start: batch.seed_start ?? batch.base.seed,
    pins: batch.pins ?? null,
    isolation: batch.isolation ?? null,
    constants: batch.base.constants ?? null,
    blue_picks: batch.base.blue.picks,
    red_picks: batch.base.red.picks,
    tactics: {
      blue: batch.base.blue.tactics.preset,
      red: batch.base.red.tactics.preset,
    },
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export interface BatchProgress {
  completed: number;
  total: number;
  last?: MatchSummary;
}

export interface RunBatchOptions {
  onProgress?: (p: BatchProgress) => void;
  shouldCancel?: () => boolean;
  signal?: AbortSignal;
  /** When true, skip the 100..5000 clamp (isolation preview / unit tests). */
  allowAnyN?: boolean;
}

export function defaultEvenBatchConfig(
  n: number,
  seedStart = 20261122,
  scheme: BatchScheme = "seed_range",
): BatchConfig {
  return {
    base: evenOvrConfig(seedStart, "hold_the_pit"),
    n: clampBatchN(n),
    scheme,
    seed_start: seedStart,
    assert_sanctuary: true,
  };
}

export function runBatch(
  batch: BatchConfig,
  opts: RunBatchOptions = {},
): BatchResult {
  const n = opts.allowAnyN ? batch.n : clampBatchN(batch.n);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Batch n must be a positive integer (got ${n})`);
  }
  const seedStart = (batch.seed_start ?? batch.base.seed) >>> 0;
  const summaries: MatchSummary[] = [];
  let cancelled = false;
  const batch_id = `batch-${seedStart}-${n}-${batch.scheme}`;
  const started_at = new Date().toISOString();

  const pairMode = batch.side_swap_pairs === true;
  const pairSeeds = pairMode ? Math.floor(n / 2) : n;
  const totalGames = pairMode ? pairSeeds * 2 : n;

  for (let i = 0; i < pairSeeds; i++) {
    if (opts.signal?.aborted || opts.shouldCancel?.()) {
      cancelled = true;
      break;
    }
    const seed = (seedStart + i) >>> 0;
    const cfg = configForGame(batch, seed, i);
    const result = simulate(cfg);
    const summary = summarizeMatch(seed, result);
    summaries.push(summary);
    opts.onProgress?.({
      completed: summaries.length,
      total: totalGames,
      last: summary,
    });

    if (pairMode) {
      if (opts.signal?.aborted || opts.shouldCancel?.()) {
        cancelled = true;
        break;
      }
      const swapped = applyPins(swapPicks(cfg), batch.pins, batch.isolation);
      const r2 = simulate(swapped);
      // Traceability: swapped twin encoded as seed + 1e9
      const summary2 = summarizeMatch((seed + 1_000_000_000) >>> 0, r2);
      summaries.push(summary2);
      opts.onProgress?.({
        completed: summaries.length,
        total: totalGames,
        last: summary2,
      });
    }
  }

  const dashboard = buildDashboard(summaries);
  return {
    batch_id,
    started_at,
    config_hash: configHashOf({ ...batch, n }),
    n_requested: n,
    n_finished: summaries.length,
    summaries,
    dashboard,
    cancelled,
    scheme: batch.scheme,
    seed_start: seedStart,
  };
}
