#!/usr/bin/env node
/**
 * npm run digest -- --seed <N>
 * Prints event-log digest and constants_hash for the S0 even default config.
 */
import { defaultEvenConfig, simulate } from "../../sim/index.js";

function parseArgs(argv: string[]): { seed: number } {
  let seed = 20261122;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--seed" && argv[i + 1] !== undefined) {
      seed = Number(argv[++i]);
    }
  }
  if (!Number.isFinite(seed)) {
    console.error("invalid --seed");
    process.exit(2);
  }
  return { seed: seed >>> 0 };
}

const { seed } = parseArgs(process.argv.slice(2));
const cfg = defaultEvenConfig(seed);
const result = simulate(cfg);

console.log(`seed=${seed}`);
console.log(`constants_hash=${result.constants_hash}`);
console.log(`data_hash=${result.data_hash}`);
console.log(`digest=${result.digest}`);
console.log(`tick_count=${result.tick_count}`);
console.log(`match_end=${result.state.end_reason ?? "none"}`);
console.log(`winner=${result.state.winner ?? "none"}`);
