/**
 * Attribute isolation preset (§6.5 / §8.5).
 *
 * Control + six +30 arms on Blue ADC; attrs otherwise 60, mastery 50.
 * §8.5 mastery arm: mastery 50→90 on ONE player's champion (blue ADC pick),
 * not mastery_all on all ten.
 *
 * S5 follow-up (GD): each arm runs side-swapped pairs (same seed, picks
 * swapped) and optionally a mirror-comp slice so control WR ≈ 50%, not the
 * kit-asymmetric 4.5% floor. Aim/Reflexes skillshot arms stay blocked —
 * chooseExecutionCast only returns for Kerrig/Huntress (sim/ai/brain.ts).
 */
import { evenOvrConfig, type TacticPreset } from "../../../sim/match_config.js";
import type { MatchConfig } from "../../../sim/types.js";
import { simulate } from "../../../sim/simulate.js";
import {
  ATTRS,
  applyPins,
  mirrorPicks,
  swapPicks,
  type RunBatchOptions,
} from "./batch-runner.js";
import type { IsolationDashboardInput, IsolationDelta } from "./dashboard.js";
import { summarizeMatch } from "./summary.js";
import type { AttrName, BatchConfig, MatchSummary } from "./types.js";
import { wilsonInterval } from "./fight-quality.js";

function blueWinRate(summaries: MatchSummary[]): number {
  if (summaries.length === 0) return 0;
  let w = 0;
  for (const s of summaries) if (s.winner === "blue") w += 1;
  return (w / summaries.length) * 100;
}

export interface IsolationArmResult {
  label: string;
  summaries: MatchSummary[];
  blue_win_pp: number;
  blue_wins: number;
  n: number;
  wilson95: { lo: number; hi: number; p: number };
}

export interface IsolationResult {
  n_per_arm: number;
  /** Pair seeds (each seed → normal + swapped = 2 games). */
  n_pair_seeds: number;
  seed_start: number;
  control_blue_win_pp: number;
  deltas: IsolationDelta[];
  mastery_50_to_90: {
    control_blue_win_pp: number;
    arm_blue_win_pp: number;
    delta_pp: number;
    n: number;
    wilson95_arm: { lo: number; hi: number; p: number };
  };
  dashboard: IsolationDashboardInput;
  arms: Record<string, IsolationArmResult>;
  mirror_control?: IsolationArmResult;
  setup_notes: string[];
  blocked_arms: string[];
}

function runPinnedGames(
  base: MatchConfig,
  pins: BatchConfig["pins"],
  seeds: number[],
  mode: "pair_swap" | "mirror" | "plain",
  opts: RunBatchOptions,
): MatchSummary[] {
  const summaries: MatchSummary[] = [];
  for (let i = 0; i < seeds.length; i++) {
    if (opts.signal?.aborted || opts.shouldCancel?.()) break;
    const seed = seeds[i]!;
    let cfg = structuredClone(base);
    cfg.seed = seed;
    if (mode === "mirror") cfg = mirrorPicks(cfg, "blue");
    cfg = applyPins(cfg, pins);
    const result = simulate(cfg);
    summaries.push(summarizeMatch(seed, result));
    opts.onProgress?.({
      completed: summaries.length,
      total: mode === "pair_swap" ? seeds.length * 2 : seeds.length,
      last: summaries[summaries.length - 1],
    });

    if (mode === "pair_swap") {
      let swapped = structuredClone(base);
      swapped.seed = seed;
      swapped = swapPicks(swapped);
      swapped = applyPins(swapped, pins);
      const r2 = simulate(swapped);
      // Encode swap in seed field for CSV traceability: seed + 1_000_000_000
      summaries.push(summarizeMatch((seed + 1_000_000_000) >>> 0, r2));
      opts.onProgress?.({
        completed: summaries.length,
        total: seeds.length * 2,
        last: summaries[summaries.length - 1],
      });
    }
  }
  return summaries;
}

function armResult(label: string, summaries: MatchSummary[]): IsolationArmResult {
  const blueWins = summaries.filter((s) => s.winner === "blue").length;
  const n = summaries.length;
  return {
    label,
    summaries,
    blue_win_pp: blueWinRate(summaries),
    blue_wins: blueWins,
    n,
    wilson95: wilsonInterval(blueWins, n),
  };
}

export function runIsolation(opts: {
  nPerArm: number;
  seedStart?: number;
  tactic?: TacticPreset;
  attrsAll?: number;
  teamworkFloor?: number;
  /**
   * pair_swap (default): each seed runs twice (normal + picks swapped).
   * nPerArm is total games; pair seeds = floor(nPerArm/2).
   * mirror: both sides identical blue picks (no swap).
   * plain: legacy single lineup per seed.
   */
  pairing?: "pair_swap" | "mirror" | "plain";
  /** Also run a mirror control slice (same n) for the ~50% base check. */
  includeMirrorControl?: boolean;
  onProgress?: RunBatchOptions["onProgress"];
  shouldCancel?: RunBatchOptions["shouldCancel"];
  signal?: AbortSignal;
}): IsolationResult {
  const nPerArm = opts.nPerArm;
  if (!Number.isInteger(nPerArm) || nPerArm < 1) {
    throw new Error("nPerArm must be a positive integer");
  }
  const seedStart = (opts.seedStart ?? 20261122) >>> 0;
  const tactic = opts.tactic ?? "hold_the_pit";
  const attrsAll = opts.attrsAll ?? 60;
  const teamworkFloor = opts.teamworkFloor;
  const pairing = opts.pairing ?? "pair_swap";
  const base = evenOvrConfig(seedStart, tactic);

  const nPairSeeds =
    pairing === "pair_swap" ? Math.floor(nPerArm / 2) : nPerArm;
  const seeds: number[] = [];
  for (let i = 0; i < nPairSeeds; i++) seeds.push((seedStart + i) >>> 0);

  const setup_notes: string[] = [
    `tactic=${tactic}`,
    `attrs_all=${attrsAll}`,
    teamworkFloor !== undefined
      ? `teamwork_floor=${teamworkFloor} (callFollowSlack=1+0.01*max(0,50−T); inert at T≥50)`
      : "teamwork_floor=unset",
    `pairing=${pairing} (n_games≈${nPerArm}, n_pair_seeds=${nPairSeeds})`,
    "mastery arm: mastery_one on blue ADC pick only (§8.5) — not mastery_all",
    "BLOCKED: aim/reflexes skillshot isolation — chooseExecutionCast in sim/ai/brain.ts returns null unless champ is kerrig|huntress, and even then only gated R (never Q/W). No arena preset emits cast_start/skillshot_roll without sim edits or scripted_* hooks. Arms still run (auto-only) and are marked blocked.",
  ];

  const runOpts: RunBatchOptions = {
    allowAnyN: true,
    onProgress: opts.onProgress,
    shouldCancel: opts.shouldCancel,
    signal: opts.signal,
  };

  const basePins = (extra?: BatchConfig["pins"]): BatchConfig["pins"] => ({
    attrs_all: attrsAll,
    mastery_all: 50,
    ...(teamworkFloor !== undefined ? { teamwork_all: teamworkFloor } : {}),
    ...extra,
  });

  const arms: Record<string, IsolationArmResult> = {};

  const controlSummaries = runPinnedGames(
    base,
    basePins(),
    seeds,
    pairing,
    runOpts,
  );
  arms.control = armResult("control", controlSummaries);
  const controlPp = arms.control.blue_win_pp;

  const deltas: IsolationDelta[] = [];
  for (const attr of ATTRS) {
    const summaries = runPinnedGames(
      base,
      basePins({
        isolation: {
          attr,
          plus: 30,
          slot: "adc",
          side: "blue",
        },
      }),
      seeds,
      pairing,
      runOpts,
    );
    const arm = armResult(attr, summaries);
    arms[attr] = arm;
    deltas.push({
      attr,
      control_win_pp: controlPp,
      arm_win_pp: arm.blue_win_pp,
      delta_pp: arm.blue_win_pp - controlPp,
      n: arm.n,
    });
  }

  // §8.5 mastery: one player (blue ADC) mastery[pick] = 90; others stay 50.
  const masterySummaries = runPinnedGames(
    base,
    basePins({
      mastery_one: { side: "blue", slot: "adc", value: 90 },
    }),
    seeds,
    pairing,
    runOpts,
  );
  arms.mastery90 = armResult("mastery90", masterySummaries);
  const mastery = {
    control_blue_win_pp: controlPp,
    arm_blue_win_pp: arms.mastery90.blue_win_pp,
    delta_pp: arms.mastery90.blue_win_pp - controlPp,
    n: arms.mastery90.n,
    wilson95_arm: arms.mastery90.wilson95,
  };

  let mirror_control: IsolationArmResult | undefined;
  if (opts.includeMirrorControl !== false) {
    const mirrorSummaries = runPinnedGames(
      base,
      basePins(),
      seeds.slice(0, Math.min(seeds.length, Math.floor(nPerArm / (pairing === "pair_swap" ? 1 : 1)))),
      "mirror",
      runOpts,
    );
    // Mirror uses nPairSeeds games (one per seed), not pairs.
    mirror_control = armResult("mirror_control", mirrorSummaries);
  }

  const dashboard: IsolationDashboardInput = {
    deltas,
    mastery_note: `mastery 50→90 on blue ADC pick only (§8.5): ${mastery.delta_pp >= 0 ? "+" : ""}${mastery.delta_pp.toFixed(1)}pp (n=${mastery.n}); expect smaller than raw +30 attr`,
  };

  return {
    n_per_arm: nPerArm,
    n_pair_seeds: nPairSeeds,
    seed_start: seedStart,
    control_blue_win_pp: controlPp,
    deltas,
    mastery_50_to_90: mastery,
    dashboard,
    arms,
    mirror_control,
    setup_notes,
    blocked_arms: ["aim", "reflexes"],
  };
}
