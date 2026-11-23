/**
 * S3-R5-12 (L1978): forced_clock_end must be explicit on arena presets;
 * loadMatchConfig refuses a missing field. defaultEvenConfig stays true (S1).
 */
import { describe, expect, it } from "vitest";
import { defaultEvenConfig } from "../sim/index.js";
import {
  ARENA_PRESETS,
  ConfigError,
  evenOvrConfig,
  loadMatchConfig,
} from "../sim/match_config.js";

describe("S3-R5-12 config loader (L1978)", () => {
  it("loadMatchConfig refuses a config missing forced_clock_end", () => {
    expect(() => loadMatchConfig({ seed: 1 })).toThrow(ConfigError);
    expect(() => loadMatchConfig({ seed: 1 })).toThrow(/forced_clock_end is required/);
  });

  it("loadMatchConfig accepts an explicit true or false", () => {
    expect(loadMatchConfig({ seed: 2, forced_clock_end: true }).forced_clock_end).toBe(true);
    expect(loadMatchConfig({ seed: 2, forced_clock_end: false }).forced_clock_end).toBe(false);
  });

  it("defaultEvenConfig keeps forced_clock_end: true (S1 default)", () => {
    expect(defaultEvenConfig(20261122).forced_clock_end).toBe(true);
  });

  it("every checked-in arena preset sets forced_clock_end: false", () => {
    expect(ARENA_PRESETS.length).toBeGreaterThan(0);
    for (const p of ARENA_PRESETS) {
      const cfg = p.build(20261122);
      expect(cfg.forced_clock_end, p.name).toBe(false);
      // Field must be own enumerable (explicit), not inherited undefined.
      expect(Object.prototype.hasOwnProperty.call(cfg, "forced_clock_end"), p.name).toBe(true);
    }
  });

  it("evenOvrConfig enables AI and the named tactic on both sides", () => {
    const cfg = evenOvrConfig(7, "hunt");
    expect(cfg.ai_enabled).toBe(true);
    expect(cfg.forced_clock_end).toBe(false);
    expect(cfg.blue.tactics.preset).toBe("hunt");
    expect(cfg.red.tactics.preset).toBe("hunt");
  });
});
