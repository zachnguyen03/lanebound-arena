import { simulate } from "@sim/simulate";
import { SANDBOX_KIT_PATCH } from "@sim/balance";
import { CADENCE_EXPERIMENT, SANDBOX_CONSTANTS, TEAMFIGHT_EXPERIMENT, TEAMFIGHT_R3 } from "@sim/cadence";
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

function evenSide(
  picks: string[],
  preset: SideConfig["tactics"]["preset"],
): SideConfig {
  return {
    players: [0, 1, 2, 3, 4].map((i) => ({
      name: `P${i}`,
      attrs: { ...EVEN_ATTRS },
      mastery: {},
    })),
    picks: picks.slice(),
    tactics: {
      preset,
      aggression: 0,
      protect_the_carry: true,
      combo_style: "auto",
    },
  };
}

function evenMatch(
  seed: number,
  preset: SideConfig["tactics"]["preset"],
  notes: string,
): MatchConfig {
  return {
    seed,
    blue: evenSide(BLUE_PICKS, preset),
    red: evenSide(RED_PICKS, preset),
    draft_mode: "fixed",
    forced_clock_end: false,
    ai_enabled: true,
    notes,
  };
}

export function canonicalConfig(seed: number): MatchConfig {
  return evenMatch(seed, "hold_the_pit", EVEN_MATCH_NOTE);
}

/**
 * S1 even lineup with AI on and the clock end forced.
 * Melee champions land autos here. The note is Watch copy.
 */
export const CLOCK_AI_NOTE = "Clock match";

export function clockAiConfig(seed: number): MatchConfig {
  return { ...evenMatch(seed, "hold_the_pit", CLOCK_AI_NOTE), forced_clock_end: true };
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

export function withConstants(
  config: MatchConfig,
  constants?: Record<string, unknown>,
): MatchConfig {
  if (!constants || Object.keys(constants).length === 0) return config;
  return {
    ...config,
    constants: { ...(config.constants ?? {}), ...constants },
  };
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

export function runWatchMatch(
  seed: number,
  constants?: Record<string, unknown>,
) {
  return runFromConfig(withConstants(canonicalConfig(seed), constants));
}

/** exp: even match with the orb/buff cadence and the round-2 teamfight changes. */
export function runCadenceMatch(
  seed: number,
  constants?: Record<string, unknown>,
) {
  const base = {
    ...evenMatch(seed, "hold_the_pit", "Cadence + teamfight match (experimental)"),
    ...CADENCE_EXPERIMENT,
    teamfight: { ...TEAMFIGHT_EXPERIMENT },
  };
  return runFromConfig(withConstants(base, constants));
}

/** exp/objectives: three capture points (north / centre / south) on the round-3 teamfight AI. */
export function runPointsMatch(
  seed: number,
  constants?: Record<string, unknown>,
) {
  const base: MatchConfig = {
    ...evenMatch(seed, "hold_the_pit", "Three capture points (experimental)"),
    objectives: { mode: "points" },
    teamfight: { ...TEAMFIGHT_R3 },
    constants: { ...SANDBOX_CONSTANTS },
    kit_patch: SANDBOX_KIT_PATCH,
  };
  return runFromConfig(withConstants(base, constants));
}

export function runClockAiMatch(
  seed: number,
  constants?: Record<string, unknown>,
) {
  return runFromConfig(withConstants(clockAiConfig(seed), constants));
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
