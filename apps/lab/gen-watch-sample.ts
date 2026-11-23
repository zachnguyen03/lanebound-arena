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

export const WATCH_SAMPLE_SEED = 20261122;
export const WATCH_SAMPLE_NOTE =
  "Seed 20261122 event log with no position stream. Pads are integer tiles; the viewer places units and props at tile centres.";

/** Same bytes `npm run gen:watch-sample` writes. */
export function buildWatchSample(): {
  jsonl: string;
  meta: string;
  digest: string;
} {
  const result = simulate(defaultEvenConfig(WATCH_SAMPLE_SEED));
  const jsonl = result.events.map((e) => JSON.stringify(e)).join("\n") + "\n";
  const meta =
    JSON.stringify(
      {
        seed: WATCH_SAMPLE_SEED,
        digest: result.digest,
        constants_hash: result.constants_hash,
        tick_count: result.tick_count,
        event_count: result.events.length,
        note: WATCH_SAMPLE_NOTE,
      },
      null,
      2,
    ) + "\n";
  return { jsonl, meta, digest: result.digest };
}

const isCli = process.argv[1]?.includes("gen-watch-sample");
if (isCli) {
  fs.mkdirSync(outDir, { recursive: true });
  const { jsonl, meta, digest } = buildWatchSample();
  fs.writeFileSync(path.join(outDir, "seed-20261122.jsonl"), jsonl);
  fs.writeFileSync(path.join(outDir, "seed-20261122.meta.json"), meta);
  const events = jsonl.trim().split("\n").length;
  console.log(`wrote ${outDir}/seed-20261122.jsonl`);
  console.log(`digest=${digest}`);
  console.log(`events=${events}`);
}
