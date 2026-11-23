#!/usr/bin/env node
/**
 * npm run lab:s0 — write proof into lab/s0/: logs, digests, test output,
 * and a same-seed-twice byte-identical digest check.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultEvenConfig, simulate } from "../../sim/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "lab", "s0");
fs.mkdirSync(outDir, { recursive: true });

const SEED = 20261122;
const SEED2 = SEED + 1;

function runDigest(seed: number): { digest: string; constants_hash: string; tick_count: number } {
  const r = simulate(defaultEvenConfig(seed));
  return {
    digest: r.digest,
    constants_hash: r.constants_hash,
    tick_count: r.tick_count,
  };
}

// Same seed twice
const a = runDigest(SEED);
const b = runDigest(SEED);
const c = runDigest(SEED2);

const twinOk = a.digest === b.digest;
const differOk = a.digest !== c.digest;

const digest22 = [
  `seed=${SEED}`,
  `constants_hash=${a.constants_hash}`,
  `digest=${a.digest}`,
  `tick_count=${a.tick_count}`,
  `twin_run_digest=${b.digest}`,
  `twin_identical=${twinOk}`,
  "",
].join("\n");

const digest23 = [
  `seed=${SEED2}`,
  `constants_hash=${c.constants_hash}`,
  `digest=${c.digest}`,
  `tick_count=${c.tick_count}`,
  `differs_from_${SEED}=${differOk}`,
  "",
].join("\n");

fs.writeFileSync(path.join(outDir, `digest-${SEED}.txt`), digest22);
fs.writeFileSync(path.join(outDir, `digest-${SEED2}.txt`), digest23);

// Event log sample (first/last events only to keep size sane) + full digest inputs meta
const full = simulate(defaultEvenConfig(SEED));
const logLines = full.events
  .filter((e) => e.type !== "xp_gain")
  .map((e) => JSON.stringify(e));
fs.writeFileSync(
  path.join(outDir, "events-no-xp-sample.jsonl"),
  logLines.join("\n") + "\n",
);

// Purity
let purityOut = "";
let purityCode = 0;
try {
  purityOut = execSync("npm run purity", { cwd: root, encoding: "utf8" });
} catch (e: unknown) {
  const err = e as { stdout?: string; stderr?: string; status?: number };
  purityOut = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  purityCode = err.status ?? 1;
}
fs.writeFileSync(path.join(outDir, "purity.txt"), purityOut);

// Tests
let testsOut = "";
let testsCode = 0;
try {
  testsOut = execSync("npm test", { cwd: root, encoding: "utf8" });
} catch (e: unknown) {
  const err = e as { stdout?: string; stderr?: string; status?: number };
  testsOut = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  testsCode = err.status ?? 1;
}
fs.writeFileSync(path.join(outDir, "tests.log"), testsOut);

const twinPath = path.join(outDir, "twin-digest-check.txt");
fs.writeFileSync(
  twinPath,
  [
    `seed=${SEED}`,
    `run_a=${a.digest}`,
    `run_b=${b.digest}`,
    `identical=${twinOk}`,
    `seed_plus_1=${c.digest}`,
    `differs=${differOk}`,
    "",
  ].join("\n"),
);

console.log(`lab:s0 wrote ${outDir}`);
console.log(`twin_identical=${twinOk} seed+1_differs=${differOk}`);
console.log(`purity_exit=${purityCode} tests_exit=${testsCode}`);

if (!twinOk || !differOk || purityCode !== 0 || testsCode !== 0) {
  process.exit(1);
}
