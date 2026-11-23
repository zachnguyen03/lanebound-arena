import { ConfigError, evenOvrConfig, loadMatchConfig } from "@sim/match_config";
import { simulate } from "@sim/simulate";
import type { MatchConfig } from "@sim/types";

/**
 * View tape uses debug_pos so the map can follow units. That flag shifts
 * event_seq inside projectile ids, so the digest is always taken from a
 * second run of the same config with debug_pos off (the CLI path).
 * Final poses match; overlays never enter the sim.
 */
export function canonicalConfig(seed: number): MatchConfig {
  return evenOvrConfig(seed, "hold_the_pit");
}

export function runFromConfig(config: MatchConfig) {
  const canonical = loadMatchConfig({
    ...config,
    debug_pos: false,
    forced_clock_end: config.forced_clock_end,
  });
  const view = loadMatchConfig({
    ...canonical,
    debug_pos: true,
  });
  const auth = simulate(canonical);
  const tape = simulate(view);
  return { config: canonical, result: tape, digest: auth.digest };
}

export function runWatchMatch(seed: number) {
  return runFromConfig(canonicalConfig(seed));
}

export function cliDigest(seed: number): string {
  return simulate(canonicalConfig(seed)).digest;
}

export function exportConfigJson(config: MatchConfig): string {
  return JSON.stringify(config);
}

export function importConfigJson(text: string): MatchConfig {
  const raw = JSON.parse(text) as MatchConfig;
  return loadMatchConfig(raw);
}

export { ConfigError };
