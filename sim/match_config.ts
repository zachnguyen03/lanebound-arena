/**
 * Shared MatchConfig loader (S3-R5-12 L1978).
 * Watch/Batch (S4/S5) will refuse configs that omit `forced_clock_end`.
 * The sim default (`defaultEvenConfig`) still sets `forced_clock_end: true`
 * for S1 gold; every checked-in arena preset must set it to `false` explicitly.
 */
import { defaultEvenConfig } from "./simulate.js";
import type { MatchConfig, Tactics } from "./types.js";

export type TacticPreset = Tactics["preset"];

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Load a MatchConfig. Requires `forced_clock_end` to be present (boolean).
 * Missing field → refuse (S3-R5-12). Does not invent a default.
 */
export function loadMatchConfig(
  raw: Partial<MatchConfig> & Pick<MatchConfig, "seed">,
): MatchConfig {
  if (!Object.prototype.hasOwnProperty.call(raw, "forced_clock_end")) {
    throw new ConfigError(
      "forced_clock_end is required on MatchConfig (S3-R5-12); set true for S1 clock labs or false for arena §5.8",
    );
  }
  if (typeof raw.forced_clock_end !== "boolean") {
    throw new ConfigError("forced_clock_end must be a boolean (S3-R5-12)");
  }
  const base = defaultEvenConfig(raw.seed);
  return {
    ...base,
    ...raw,
    blue: raw.blue ?? base.blue,
    red: raw.red ?? base.red,
    forced_clock_end: raw.forced_clock_end,
  };
}

/**
 * Checked-in even-OVR arena preset (M2-23 / S3-R5-12).
 * Explicitly forces `forced_clock_end: false` and AI on so the zone/orbs run.
 */
export function evenOvrConfig(
  seed: number,
  preset: TacticPreset = "hold_the_pit",
): MatchConfig {
  const base = defaultEvenConfig(seed);
  const tactics: Tactics = { ...base.blue.tactics, preset };
  return loadMatchConfig({
    ...base,
    seed,
    ai_enabled: true,
    forced_clock_end: false,
    blue: { ...base.blue, tactics: { ...tactics } },
    red: { ...base.red, tactics: { ...tactics } },
  });
}

/** All checked-in arena presets that must set forced_clock_end: false. */
export const ARENA_PRESETS: ReadonlyArray<{
  name: string;
  build: (seed?: number) => MatchConfig;
}> = [
  { name: "evenOvrConfig/hold_the_pit", build: (s = 20261122) => evenOvrConfig(s, "hold_the_pit") },
  { name: "evenOvrConfig/hunt", build: (s = 20261122) => evenOvrConfig(s, "hunt") },
  { name: "evenOvrConfig/starve", build: (s = 20261122) => evenOvrConfig(s, "starve") },
];
