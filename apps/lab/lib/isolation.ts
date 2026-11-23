/**
 * Attribute isolation preset (§6.5 / §8.5).
 * Control + six +30 arms on Blue ADC; attrs otherwise 60, mastery 50.
 * Paired seeds. Also reports mastery 50→90 (should be smaller than raw +30).
 */
import { evenOvrConfig } from "../../../sim/match_config.js";
import { ATTRS, runBatch, type RunBatchOptions } from "./batch-runner.js";
import type { IsolationDashboardInput, IsolationDelta } from "./dashboard.js";
import type { AttrName, BatchResult, MatchSummary } from "./types.js";

function blueWinRate(summaries: MatchSummary[]): number {
  if (summaries.length === 0) return 0;
  let w = 0;
  for (const s of summaries) if (s.winner === "blue") w += 1;
  return (w / summaries.length) * 100;
}

export interface IsolationResult {
  n_per_arm: number;
  seed_start: number;
  control_blue_win_pp: number;
  deltas: IsolationDelta[];
  mastery_50_to_90: {
    control_blue_win_pp: number;
    arm_blue_win_pp: number;
    delta_pp: number;
    n: number;
  };
  dashboard: IsolationDashboardInput;
  arms: Record<string, BatchResult>;
}

export function runIsolation(opts: {
  nPerArm: number;
  seedStart?: number;
  onProgress?: RunBatchOptions["onProgress"];
  shouldCancel?: RunBatchOptions["shouldCancel"];
  signal?: AbortSignal;
}): IsolationResult {
  const nPerArm = opts.nPerArm;
  if (!Number.isInteger(nPerArm) || nPerArm < 1) {
    throw new Error("nPerArm must be a positive integer");
  }
  const seedStart = (opts.seedStart ?? 20261122) >>> 0;
  const base = evenOvrConfig(seedStart, "hold_the_pit");

  const runArm = (
    isolation: { attr: AttrName; plus: number } | null,
    mastery: number,
  ): BatchResult =>
    runBatch(
      {
        base,
        n: nPerArm,
        scheme: "isolation",
        seed_start: seedStart,
        pins: {
          attrs_all: 60,
          mastery_all: mastery,
          ...(isolation
            ? {
                isolation: {
                  attr: isolation.attr,
                  plus: isolation.plus,
                  slot: "adc",
                  side: "blue",
                },
              }
            : {}),
        },
        assert_sanctuary: true,
      },
      {
        allowAnyN: true,
        onProgress: opts.onProgress,
        shouldCancel: opts.shouldCancel,
        signal: opts.signal,
      },
    );

  const arms: Record<string, BatchResult> = {};
  const control = runArm(null, 50);
  arms.control = control;
  const controlPp = blueWinRate(control.summaries);

  const deltas: IsolationDelta[] = [];
  for (const attr of ATTRS) {
    const arm = runArm({ attr, plus: 30 }, 50);
    arms[attr] = arm;
    const armPp = blueWinRate(arm.summaries);
    deltas.push({
      attr,
      control_win_pp: controlPp,
      arm_win_pp: armPp,
      delta_pp: armPp - controlPp,
      n: arm.summaries.length,
    });
  }

  const masteryArm = runArm(null, 90);
  arms.mastery90 = masteryArm;
  const masteryPp = blueWinRate(masteryArm.summaries);
  const mastery = {
    control_blue_win_pp: controlPp,
    arm_blue_win_pp: masteryPp,
    delta_pp: masteryPp - controlPp,
    n: masteryArm.summaries.length,
  };

  const dashboard: IsolationDashboardInput = {
    deltas,
    mastery_note: `mastery 50→90 on all players: ${mastery.delta_pp >= 0 ? "+" : ""}${mastery.delta_pp.toFixed(1)}pp (n=${mastery.n}); expect smaller than raw +30 attr`,
  };

  return {
    n_per_arm: nPerArm,
    seed_start: seedStart,
    control_blue_win_pp: controlPp,
    deltas,
    mastery_50_to_90: mastery,
    dashboard,
    arms,
  };
}
