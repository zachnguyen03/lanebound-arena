#!/usr/bin/env node
/**
 * Generate the bundled Watch sample log for seed 20261122.
 * Canonical S0 format (no debug_pos) so digest matches gold.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultEvenConfig, simulate } from "../../sim/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "apps/watch/public/samples");
fs.mkdirSync(outDir, { recursive: true });

const SEED = 20261122;
const result = simulate(defaultEvenConfig(SEED));
const text = result.events.map((e) => JSON.stringify(e)).join("\n") + "\n";

fs.writeFileSync(path.join(outDir, "seed-20261122.jsonl"), text);
fs.writeFileSync(
  path.join(outDir, "seed-20261122.meta.json"),
  JSON.stringify(
    {
      seed: SEED,
      digest: result.digest,
      constants_hash: result.constants_hash,
      tick_count: result.tick_count,
      event_count: result.events.length,
      note: "Canonical S0 log (no pos). Watch places units at S0 spawn + SPAWN_JITTER_Y until pos/move events appear.",
    },
    null,
    2,
  ) + "\n",
);

console.log(`wrote ${outDir}/seed-20261122.jsonl`);
console.log(`digest=${result.digest}`);
console.log(`events=${result.events.length} ticks=${result.tick_count}`);
