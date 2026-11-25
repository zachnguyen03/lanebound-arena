#!/usr/bin/env node
/**
 * npm run batch -- --n 100 --seed 20261122 [--scheme seed_range] [--out lab/s5]
 *                [--side-swap-pairs]   # n pair-seeds → 2n games; reports flip rate
 *
 * Progress on stderr; JSON + CSV under --out. Ctrl-C / SIGINT cancels cleanly
 * and writes a partial export of finished matches.
 *
 * Headline (stdout JSON) always includes casts_per_game. With --side-swap-pairs
 * it also includes side_swap_flip_rate. Interrupts per game (R7-6b / M2-33,
 * report-only) are split by Reflexes band.
 */
import fs from "node:fs";
import path from "node:path";
import {
  clampBatchN,
  defaultEvenBatchConfig,
  runBatch,
} from "./lib/batch-runner.js";
import {
  batchResultToJson,
  dashboardToCsv,
  summariesToCsv,
} from "./lib/csv.js";
import type { BatchScheme } from "./lib/types.js";
import { SANDBOX_CONSTANTS, TEAMFIGHT_R3 } from "../../sim/cadence.js";

function parseArgs(argv: string[]) {
  let n = 100;
  let seed = 20261122;
  let scheme: BatchScheme = "seed_range";
  let out = "lab/s5";
  let cancelAfter: number | null = null;
  let sideSwapPairs = false;
  let sandbox = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--n" && argv[i + 1]) n = Number(argv[++i]);
    else if (a === "--seed" && argv[i + 1]) seed = Number(argv[++i]);
    else if (a === "--scheme" && argv[i + 1]) scheme = argv[++i] as BatchScheme;
    else if (a === "--out" && argv[i + 1]) out = argv[++i]!;
    else if (a === "--cancel-after" && argv[i + 1])
      cancelAfter = Number(argv[++i]);
    else if (a === "--side-swap-pairs") sideSwapPairs = true;
    // exp: the Watch sandbox setup (three capture points + round-3 teamfight AI).
    else if (a === "--sandbox") sandbox = true;
    else if (a === "--help") {
      console.log(
        "Usage: npm run batch -- --n 100..5000 --seed N [--scheme seed_range|random_draft|archetype_matrix] [--side-swap-pairs] [--out dir] [--cancel-after K]",
      );
      console.log(
        "  --side-swap-pairs  n = pair-seeds; each seed runs original + kit swap (2n games).",
      );
      process.exit(0);
    }
  }
  return {
    n: clampBatchN(n),
    seed: seed >>> 0,
    scheme,
    out,
    sideSwapPairs,
    sandbox,
    cancelAfter:
      cancelAfter !== null && Number.isFinite(cancelAfter)
        ? cancelAfter
        : null,
  };
}

function writeResult(outDir: string, result: ReturnType<typeof runBatch>) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "batch-results.json");
  const csvPath = path.join(outDir, "batch-summaries.csv");
  const dashPath = path.join(outDir, "batch-dashboard.csv");
  fs.writeFileSync(jsonPath, batchResultToJson(result));
  fs.writeFileSync(csvPath, summariesToCsv(result.summaries));
  fs.writeFileSync(dashPath, dashboardToCsv(result.dashboard.rows));
  return { jsonPath, csvPath, dashPath };
}

const args = parseArgs(process.argv.slice(2));
const batch = defaultEvenBatchConfig(args.n, args.seed, args.scheme);
batch.side_swap_pairs = args.sideSwapPairs;
if (args.sandbox) {
  batch.base = {
    ...batch.base,
    objectives: { mode: "points" },
    teamfight: { ...TEAMFIGHT_R3 },
    constants: { ...(batch.base.constants ?? {}), ...SANDBOX_CONSTANTS },
  };
}

let cancelRequested = false;
let completed = 0;
const onSignal = () => {
  cancelRequested = true;
  console.error(
    "cancel requested — finishing current match, then writing partial…",
  );
};
process.on("SIGINT", onSignal);
process.on("SIGTERM", onSignal);

const t0 = Date.now();
let lastLog = 0;
const result = runBatch(batch, {
  shouldCancel: () => {
    if (cancelRequested) return true;
    if (args.cancelAfter !== null && completed >= args.cancelAfter) {
      cancelRequested = true;
      return true;
    }
    return false;
  },
  onProgress: (p) => {
    completed = p.completed;
    const now = Date.now();
    if (now - lastLog > 500 || p.completed === p.total || cancelRequested) {
      lastLog = now;
      const elapsed = (now - t0) / 1000;
      const rate = p.completed / Math.max(elapsed, 0.001);
      const eta =
        rate > 0 ? ((p.total - p.completed) / rate).toFixed(0) : "?";
      console.error(
        `batch ${p.completed}/${p.total}  ${rate.toFixed(2)} games/s  ETA ${eta}s` +
          (cancelRequested ? "  [cancelling]" : ""),
      );
    }
  },
});

const paths = writeResult(args.out, result);
const agg = result.dashboard.aggregates;
console.log(
  JSON.stringify(
    {
      cancelled: result.cancelled,
      n_requested: result.n_requested,
      n_finished: result.n_finished,
      config_hash: result.config_hash,
      out: paths,
      length_median_s: agg.length_median_s,
      peel_rate: agg.peel_rate,
      sanctuary: agg.sanctuary_violations,
      casts_per_game: agg.casts_per_game,
      side_swap_pairs: agg.side_swap_pairs,
      side_swap_flip: agg.side_swap_flip,
      side_swap_flip_rate: agg.side_swap_flip_rate,
      interrupts_per_game: agg.interrupts_per_game,
      interrupts_by_reflexes: agg.interrupts_by_reflexes,
    },
    null,
    2,
  ),
);
