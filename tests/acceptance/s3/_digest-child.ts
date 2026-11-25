/**
 * Two-process digest helper for the S3 suite. Unpack at the repo root.
 * Usage:
 *   tsx tests/acceptance/s3/_digest-child.ts --seed 20261122 [--full]
 *   tsx tests/acceptance/s3/_digest-child.ts --config /tmp/cfg.json
 *
 * --full sets forced_clock_end = false on defaultEvenConfig so the §5.8
 * win conditions (including the Bo1 coin flip) run to match_end.
 */
import fs from "node:fs";
import { defaultEvenConfig, simulate } from "../../../sim/index.js";
import type { MatchConfig } from "../../../sim/index.js";

function parse(): MatchConfig {
  const argv = process.argv.slice(2);
  let seed = 20261122;
  let full = false;
  let configPath: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--seed") seed = Number(argv[++i]);
    else if (a === "--full") full = true;
    else if (a === "--config") configPath = argv[++i];
  }
  if (configPath) {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as MatchConfig;
  }
  const cfg = defaultEvenConfig(seed);
  if (full) cfg.forced_clock_end = false;
  return cfg;
}

const r = simulate(parse());
process.stdout.write(
  `digest=${r.digest}\n` +
    `constants_hash=${r.constants_hash}\n` +
    `end_reason=${r.state.end_reason ?? ""}\n` +
    `winner=${r.state.winner ?? ""}\n` +
    `tick_count=${r.tick_count}\n`,
);
