import { simulate } from "@sim/simulate";
import type { MatchConfig, PlayerAttrs, SideConfig } from "@sim/types";

/**
 * View tape uses debug_pos so the map can follow units. That flag shifts
 * event_seq inside projectile ids, so the digest is always taken from a
 * second run of the same config with debug_pos off (the CLI path).
 * Final poses match; overlays never enter the sim.
 *
 * The even lineup is owned here. The sim preset's note is an internal
 * label, so the file the Watch exports uses the sentence below instead.
 * Clock-end mistakes throw ConfigError with the sentences the shell shows.
 * The sim loader is not on this module's import graph.
 */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export const EVEN_MATCH_NOTE = "Even match";

const CLOCK_END_REQUIRED =
  "This match file needs a clock-end setting, true or false.";
const CLOCK_END_BOOLEAN = "The clock-end setting must be true or false.";

const EVEN_ATTRS: PlayerAttrs = {
  aim: 70,
  reflexes: 70,
  execution: 70,
  decision: 70,
  positioning: 70,
  teamwork: 70,
};

const BLUE_PICKS = ["brannoch", "sedge", "kerrig", "huntress", "ysol"];
const RED_PICKS = ["rhedan", "tolle", "helvar", "maelis", "saelo"];

function evenSide(picks: string[]): SideConfig {
  return {
    players: [0, 1, 2, 3, 4].map((i) => ({
      name: `P${i}`,
      attrs: { ...EVEN_ATTRS },
      mastery: {},
    })),
    picks: picks.slice(),
    tactics: {
      preset: "hold_the_pit",
      aggression: 0,
      protect_the_carry: true,
      combo_style: "auto",
    },
  };
}

export function canonicalConfig(seed: number): MatchConfig {
  return {
    seed,
    blue: evenSide(BLUE_PICKS),
    red: evenSide(RED_PICKS),
    draft_mode: "fixed",
    forced_clock_end: false,
    ai_enabled: true,
    notes: EVEN_MATCH_NOTE,
  };
}

function requireClockEnd(raw: unknown): MatchConfig {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ConfigError(CLOCK_END_REQUIRED);
  }
  const rec = raw as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(rec, "forced_clock_end")) {
    throw new ConfigError(CLOCK_END_REQUIRED);
  }
  if (typeof rec.forced_clock_end !== "boolean") {
    throw new ConfigError(CLOCK_END_BOOLEAN);
  }
  return { ...(rec as unknown as MatchConfig) };
}

export function runFromConfig(config: MatchConfig) {
  const canonical = requireClockEnd({
    ...config,
    debug_pos: false,
  });
  const view = requireClockEnd({
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
  const raw = JSON.parse(text) as unknown;
  return requireClockEnd(raw);
}
