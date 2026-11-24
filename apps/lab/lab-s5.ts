#!/usr/bin/env node
/**
 * Milestone bundle helper — does not replace PM re-runs of individual gates.
 * Writes digests + purity capture stubs; heavy labs are separate npm scripts.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { evenOvrConfig } from "../../sim/match_config.js";
import { defaultEvenConfig, simulate } from "../../sim/index.js";

const out = path.resolve("lab/s5");
fs.mkdirSync(out, { recursive: true });

function writeDigest(label: string, seed: number, ai: boolean) {
  const cfg = ai
    ? evenOvrConfig(seed, "hold_the_pit")
    : defaultEvenConfig(seed);
  const r = simulate(cfg);
  const text = [
    `label=${label}`,
    `seed=${seed}`,
    `ai=${ai}`,
    `digest=${r.digest}`,
    `constants_hash=${r.constants_hash}`,
    `winner=${r.state.winner}`,
    `reason=${r.state.end_reason}`,
    `duration_s=${r.state.t}`,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(out, `digest-${label}.txt`), text);
  return r.digest;
}

writeDigest("20261122-ai-off", 20261122, false);
writeDigest("20261123-ai-off", 20261123, false);
writeDigest("20261122-even-hold", 20261122, true);
writeDigest("20261123-even-hold", 20261123, true);

const purity = execSync("npm run purity", { encoding: "utf8" });
fs.writeFileSync(path.join(out, "purity.txt"), purity);

console.log("lab:s5 digests + purity written to lab/s5/");
