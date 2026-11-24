#!/usr/bin/env node
/**
 * npm run isolation -- --n 50 [--seed 20261122] [--out lab/s5]
 *
 * Runs control + six +30 attribute arms on Blue ADC (attrs 60, mastery 50)
 * and a mastery 50→90 arm. Writes isolation-results.json with six deltas.
 *
 * Official claim band needs --n 400 (min 400 games/arm). Preview N is fine
 * for smoke and for producing the six delta numbers under-powered.
 */
import fs from "node:fs";
import path from "node:path";
import { attachIsolationToBatch } from "./lib/dashboard.js";
import { runIsolation } from "./lib/isolation.js";
import { batchResultToJson } from "./lib/csv.js";

function parseArgs(argv: string[]) {
  let n = 50;
  let seed = 20261122;
  let out = "lab/s5";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--n" && argv[i + 1]) n = Number(argv[++i]);
    else if (a === "--seed" && argv[i + 1]) seed = Number(argv[++i]);
    else if (a === "--out" && argv[i + 1]) out = argv[++i]!;
    else if (a === "--help") {
      console.log(
        "Usage: npm run isolation -- --n <games-per-arm> [--seed N] [--out dir]",
      );
      process.exit(0);
    }
  }
  if (!Number.isInteger(n) || n < 1) {
    console.error("--n must be a positive integer");
    process.exit(2);
  }
  return { n, seed: seed >>> 0, out };
}

const args = parseArgs(process.argv.slice(2));
console.error(
  `isolation: ${args.n} games/arm × (1 control + 6 attrs + 1 mastery) from seed ${args.seed}`,
);

const t0 = Date.now();
let armLabel = "…";
const result = runIsolation({
  nPerArm: args.n,
  seedStart: args.seed,
  onProgress: (p) => {
    if (p.completed === 1 || p.completed === p.total) {
      console.error(`  ${armLabel} ${p.completed}/${p.total}`);
    }
  },
});

// Re-run with labeled progress is awkward; print summary instead.
void armLabel;
void t0;

fs.mkdirSync(args.out, { recursive: true });
const outPath = path.join(args.out, "isolation-results.json");
const payload = {
  n_per_arm: result.n_per_arm,
  seed_start: result.seed_start,
  control_blue_win_pp: result.control_blue_win_pp,
  deltas: result.deltas,
  mastery_50_to_90: result.mastery_50_to_90,
  elapsed_ms: Date.now() - t0,
};
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);

// Attach isolation row onto the control arm dashboard for convenience.
const controlWithIso = attachIsolationToBatch(
  result.arms.control!,
  result.dashboard,
);
fs.writeFileSync(
  path.join(args.out, "isolation-control-dashboard.json"),
  batchResultToJson(controlWithIso),
);

console.log(JSON.stringify(payload, null, 2));
console.error(`wrote ${outPath}`);
