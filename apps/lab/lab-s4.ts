#!/usr/bin/env node
/**
 * npm run lab:s4 — write Watch shell proof into lab/s4/.
 * Assumes screenshots / bbox-check may already exist from the proof pass.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultEvenConfig, simulate } from "../../sim/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "lab", "s4");
fs.mkdirSync(outDir, { recursive: true });

const SEED = 20261122;
const r = simulate(defaultEvenConfig(SEED));
fs.writeFileSync(
  path.join(outDir, `digest-${SEED}.txt`),
  [
    `seed=${SEED}`,
    `constants_hash=${r.constants_hash}`,
    `digest=${r.digest}`,
    `tick_count=${r.tick_count}`,
    "",
  ].join("\n"),
);

let testsOut = "";
try {
  testsOut = execSync("npm test", { cwd: root, encoding: "utf8" });
} catch (e: unknown) {
  const err = e as { stdout?: string; stderr?: string };
  testsOut = `${err.stdout ?? ""}${err.stderr ?? ""}`;
}
fs.writeFileSync(path.join(outDir, "vitest.log"), testsOut);

console.log("lab/s4 digests + vitest.log written");
console.log(`digest=${r.digest}`);
