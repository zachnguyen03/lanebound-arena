/**
 * Headless batch runner — same simulate(config) as Watch.
 * No renderer / canvas imports (B3).
 */
import { createHash } from "node:crypto";
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
  if (masteryValue !== undefined) {
    const m = masteryAll(masteryValue);
    for (const side of [cfg.blue, cfg.red]) {
      for (const p of side.players) p.mastery = { ...m };
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

/** Quick draft: deterministic xorshift shuffle from seed. */
export function quickDraftPicks(seed: number): { blue: string[]; red: string[] } {
  // R7 lab tooling: decorrelate consecutive seeds so seed and seed+1 do not
  // share the same low-bit shuffle trajectory (Isra 0/100 bias).
  let s = (Math.imul((seed >>> 0) || 1, 0x9e3779b1) ^ 0x85ebca6b) >>> 0 || 1;
  const next = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s >>>= 0;
    s ^= s << 5;
    s >>>= 0;
    return (s >>> 0) / 0x100000000;
  };
  const pool = [
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
  ];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  const slots = ["top", "jungle", "mid", "adc", "support"] as const;
  const defaultSlot: Record<string, string> = {
    huntress: "adc",
    maelis: "adc",
    isra: "adc",
    sedge: "jungle",
    torun: "jungle",
    tolle: "jungle",
    helvar: "mid",
    calder: "mid",
    kerrig: "mid",
    mirren: "mid",
    rhedan: "top",
    brannoch: "top",
    ysol: "support",
    saelo: "support",
  };
  const takeFor = (want: string, remaining: string[]): string => {
    const hit = remaining.findIndex((id) => defaultSlot[id] === want);
    if (hit >= 0) {
      const [id] = remaining.splice(hit, 1);
      return id!;
    }
    const [id] = remaining.splice(0, 1);
    return id!;
  };
  const rem = pool.slice();
  const blue: string[] = [];
  const red: string[] = [];
  for (const slot of slots) {
    blue.push(takeFor(slot, rem));
    red.push(takeFor(slot, rem));
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
    side_swap_pairs: batch.side_swap_pairs === true,
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
  const pairSeeds = opts.allowAnyN ? batch.n : clampBatchN(batch.n);
  if (!Number.isInteger(pairSeeds) || pairSeeds < 1) {
    throw new Error(`Batch n must be a positive integer (got ${pairSeeds})`);
  }
  const sideSwap = batch.side_swap_pairs === true;
  /** With --side-swap-pairs, n is pair-seeds → 2n games. */
  const nGames = sideSwap ? pairSeeds * 2 : pairSeeds;
  const seedStart = (batch.seed_start ?? batch.base.seed) >>> 0;
  const summaries: MatchSummary[] = [];
  let cancelled = false;
  const batch_id = `batch-${seedStart}-${pairSeeds}-${batch.scheme}${sideSwap ? "-swap" : ""}`;
  const started_at = new Date().toISOString();

  const runOne = (seed: number, gameIndex: number, swapped: boolean): MatchSummary => {
    const cfg = configForGame(batch, seed, gameIndex);
    if (swapped) {
      const bluePicks = [...cfg.red.picks];
      const redPicks = [...cfg.blue.picks];
      cfg.blue = { ...cfg.blue, picks: bluePicks };
      cfg.red = { ...cfg.red, picks: redPicks };
    }
    const result = simulate(cfg);
    const summary = summarizeMatch(seed, result);
    summary.side_swapped = swapped;
    return summary;
  };

  if (sideSwap) {
    for (let i = 0; i < pairSeeds; i++) {
      if (opts.signal?.aborted || opts.shouldCancel?.()) {
        cancelled = true;
        break;
      }
      const seed = (seedStart + i) >>> 0;
      const a = runOne(seed, i, false);
      summaries.push(a);
      opts.onProgress?.({ completed: summaries.length, total: nGames, last: a });
      if (opts.signal?.aborted || opts.shouldCancel?.()) {
        cancelled = true;
        break;
      }
      const b = runOne(seed, i, true);
      summaries.push(b);
      opts.onProgress?.({ completed: summaries.length, total: nGames, last: b });
    }
  } else {
    for (let i = 0; i < pairSeeds; i++) {
      if (opts.signal?.aborted || opts.shouldCancel?.()) {
        cancelled = true;
        break;
      }
      const seed = (seedStart + i) >>> 0;
      const summary = runOne(seed, i, false);
      summaries.push(summary);
      opts.onProgress?.({ completed: summaries.length, total: nGames, last: summary });
    }
  }

  const dashboard = buildDashboard(summaries);
  // Headline metrics for the official CLI (casts/game, flip rate, interrupts).
  const castsMean =
    summaries.length > 0
      ? summaries.reduce((s, m) => s + (m.casts ?? 0), 0) / summaries.length
      : 0;
  let flip = 0;
  let pairs = 0;
  if (sideSwap) {
    for (let i = 0; i + 1 < summaries.length; i += 2) {
      const a = summaries[i]!;
      const b = summaries[i + 1]!;
      if (a.seed !== b.seed) continue;
      pairs += 1;
      if (a.winner && b.winner && a.winner !== b.winner) flip += 1;
    }
  }
  const interruptsMean =
    summaries.length > 0
      ? summaries.reduce((s, m) => s + (m.interrupts ?? 0), 0) / summaries.length
      : 0;
  const intLow = summaries.reduce((s, m) => s + (m.interrupts_by_reflexes?.low ?? 0), 0);
  const intMid = summaries.reduce((s, m) => s + (m.interrupts_by_reflexes?.mid ?? 0), 0);
  const intHigh = summaries.reduce((s, m) => s + (m.interrupts_by_reflexes?.high ?? 0), 0);
  dashboard.aggregates.casts_per_game = Math.round(castsMean * 1000) / 1000;
  dashboard.aggregates.side_swap_pairs = pairs;
  dashboard.aggregates.side_swap_flip = flip;
  dashboard.aggregates.side_swap_flip_rate = pairs > 0 ? Math.round((flip / pairs) * 1000) / 1000 : null;
  dashboard.aggregates.interrupts_per_game = Math.round(interruptsMean * 1000) / 1000;
  dashboard.aggregates.interrupts_by_reflexes = { low: intLow, mid: intMid, high: intHigh };

  return {
    batch_id,
    started_at,
    config_hash: configHashOf({ ...batch, n: pairSeeds }),
    n_requested: nGames,
    n_finished: summaries.length,
    summaries,
    dashboard,
    cancelled,
    scheme: batch.scheme,
    seed_start: seedStart,
  };
}
