#!/usr/bin/env node
/**
 * npm run isolation -- --n 400 [--seed 20261122] [--out lab/s5-labs/isolation]
 *   [--tactic hold_the_pit|hunt|starve] [--teamwork-floor 40]
 *   [--pairing pair_swap|mirror|plain]
 *
 * Default pairing=pair_swap: each seed runs twice (picks swapped) so control
 * WR sits near 50%. Mastery arm pins blue ADC pick only (§8.5).
 *
 * Aim/Reflexes skillshot isolation is BLOCKED (chooseExecutionCast only for
 * Kerrig/Huntress in sim/ai/brain.ts) — arms still run as auto-only and are
 * labelled blocked in the JSON.
 */
import fs from "node:fs";
import path from "node:path";
import type { TacticPreset } from "../../sim/match_config.js";
import { attachIsolationToBatch } from "./lib/dashboard.js";
import { runIsolation } from "./lib/isolation.js";
import { batchResultToJson } from "./lib/csv.js";
import { buildDashboard } from "./lib/dashboard.js";

function parseArgs(argv: string[]) {
  let n = 50;
  let seed = 20261122;
  let out = "lab/s5";
  let tactic: TacticPreset = "hold_the_pit";
  let teamworkFloor: number | undefined = undefined;
  let pairing: "pair_swap" | "mirror" | "plain" = "pair_swap";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--n" && argv[i + 1]) n = Number(argv[++i]);
    else if (a === "--seed" && argv[i + 1]) seed = Number(argv[++i]);
    else if (a === "--out" && argv[i + 1]) out = argv[++i]!;
    else if (a === "--tactic" && argv[i + 1])
      tactic = argv[++i] as TacticPreset;
    else if (a === "--teamwork-floor" && argv[i + 1])
      teamworkFloor = Number(argv[++i]);
    else if (a === "--pairing" && argv[i + 1])
      pairing = argv[++i] as "pair_swap" | "mirror" | "plain";
    else if (a === "--help") {
      console.log(
        "Usage: npm run isolation -- --n <games-per-arm> [--seed N] [--out dir] [--tactic hold_the_pit|hunt|starve] [--teamwork-floor 40] [--pairing pair_swap|mirror|plain]",
      );
      process.exit(0);
    }
  }
  if (!Number.isInteger(n) || n < 1) {
    console.error("--n must be a positive integer");
    process.exit(2);
  }
  return { n, seed: seed >>> 0, out, tactic, teamworkFloor, pairing };
}

const args = parseArgs(process.argv.slice(2));
console.error(
  `isolation: ${args.n} games/arm pairing=${args.pairing} tactic=${args.tactic}` +
    (args.teamworkFloor !== undefined
      ? ` teamwork_floor=${args.teamworkFloor}`
      : ""),
);

const t0 = Date.now();
const result = runIsolation({
  nPerArm: args.n,
  seedStart: args.seed,
  tactic: args.tactic,
  teamworkFloor: args.teamworkFloor,
  pairing: args.pairing,
  includeMirrorControl: true,
  onProgress: (p) => {
    if (p.completed === 1 || p.completed % 50 === 0 || p.completed === p.total) {
      console.error(`  … ${p.completed}/${p.total}`);
    }
  },
});

fs.mkdirSync(args.out, { recursive: true });
const outPath = path.join(args.out, "isolation-results.json");
const payload = {
  n_per_arm: result.n_per_arm,
  n_pair_seeds: result.n_pair_seeds,
  seed_start: result.seed_start,
  control_blue_win_pp: result.control_blue_win_pp,
  deltas: result.deltas,
  mastery_50_to_90: result.mastery_50_to_90,
  mirror_control: result.mirror_control
    ? {
        blue_win_pp: result.mirror_control.blue_win_pp,
        n: result.mirror_control.n,
        wilson95: result.mirror_control.wilson95,
      }
    : null,
  arms: Object.fromEntries(
    Object.entries(result.arms).map(([k, v]) => [
      k,
      {
        blue_win_pp: v.blue_win_pp,
        blue_wins: v.blue_wins,
        n: v.n,
        wilson95: v.wilson95,
      },
    ]),
  ),
  setup_notes: result.setup_notes,
  blocked_arms: result.blocked_arms,
  tactic: args.tactic,
  teamwork_floor: args.teamworkFloor ?? null,
  pairing: args.pairing,
  elapsed_ms: Date.now() - t0,
};
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);

// Dashboard from control summaries + isolation row.
const controlDash = buildDashboard(result.arms.control!.summaries, {
  isolation: result.dashboard,
});
fs.writeFileSync(
  path.join(args.out, "isolation-control-dashboard.json"),
  `${JSON.stringify(
    {
      n_finished: result.arms.control!.n,
      dashboard: controlDash,
      blocked_arms: result.blocked_arms,
    },
    null,
    2,
  )}\n`,
);

console.log(JSON.stringify(payload, null, 2));
console.error(`wrote ${outPath}`);
void attachIsolationToBatch;
void batchResultToJson;
