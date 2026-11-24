/**
 * S5 T1–T4: tuning validation, presets, defaults == §15, mid-match staging.
 */
import { describe, expect, it } from "vitest";
import {
  CONSTANT_META,
  ConstantValidationError,
  defaultConstantsSnapshot,
  validateConstantOverride,
  validateOverrides,
} from "../apps/lab/lib/constants-meta.js";
import {
  createPreset,
  parsePresetJson,
  presetConstantsHash,
  serializePreset,
} from "../apps/lab/lib/presets.js";
import { DEFAULT_CONSTANTS, mergeConstants } from "../sim/constants.js";
import { constantsHash } from "../sim/canonical.js";
import { evenOvrConfig } from "../sim/match_config.js";
import { simulate } from "../sim/simulate.js";
import type { MatchConfig } from "../sim/types.js";

function withConstants(
  config: MatchConfig,
  constants?: Record<string, unknown>,
): MatchConfig {
  if (!constants || Object.keys(constants).length === 0) return config;
  return {
    ...config,
    constants: { ...(config.constants ?? {}), ...constants },
  };
}

describe("S5 tuning T1–T4", () => {
  it("T4: defaults at first launch match DEFAULT_CONSTANTS / §15", () => {
    const snap = defaultConstantsSnapshot();
    for (const m of CONSTANT_META) {
      if (!m.inSimTable) continue;
      expect(snap[m.key], m.key).toEqual(
        DEFAULT_CONSTANTS[m.key as keyof typeof DEFAULT_CONSTANTS],
      );
    }
    // Spot-check locked §15 defaults
    expect(DEFAULT_CONSTANTS.TIME_XP_PER_S).toBe(11.5);
    expect(DEFAULT_CONSTANTS.ZONE_TICK_S).toBe(12.0);
    expect(DEFAULT_CONSTANTS.CLAIM_DELAY_S).toBe(8.0);
    expect(DEFAULT_CONSTANTS.DENY_ANY_UNIT).toBe(true);
    expect(DEFAULT_CONSTANTS.LAB_GAMES).toBe(2000);
    expect(DEFAULT_CONSTANTS.LAB_SEED).toBe(20261122);
  });

  it("T2: ZONE_TICK_S=7 is rejected", () => {
    expect(() => validateConstantOverride("ZONE_TICK_S", 7)).toThrow(
      ConstantValidationError,
    );
    expect(() => validateConstantOverride("ZONE_TICK_S", 7)).toThrow(/7/);
  });

  it("T2b: legal TIME_XP_PER_S=14 is accepted", () => {
    expect(validateConstantOverride("TIME_XP_PER_S", 14)).toBe(14);
  });

  it("T3: named preset round-trips and changes constants_hash", () => {
    const preset = createPreset("xp14", { TIME_XP_PER_S: 14 }, "T3");
    const text = serializePreset(preset);
    const loaded = parsePresetJson(text);
    expect(loaded.name).toBe("xp14");
    expect(loaded.overrides.TIME_XP_PER_S).toBe(14);
    const hDefault = constantsHash(mergeConstants());
    const hPreset = presetConstantsHash(loaded);
    expect(hPreset).not.toBe(hDefault);
    // Second parse identical
    expect(parsePresetJson(text)).toEqual(loaded);
  });

  it("T1: staged mid-match edit does not change the current digest; next run applies", () => {
    const cfg = evenOvrConfig(20261122, "hold_the_pit");
    const r0 = simulate(cfg);
    // "Mid-match" staged override is held outside the running config.
    const staged = validateOverrides({ TIME_XP_PER_S: 14 });
    // Current match config unchanged → same digest
    const rStill = simulate(cfg);
    expect(rStill.digest).toBe(r0.digest);
    expect(r0.digest).toBe(
      "65fbf598b086661a6b3bbf783173928984d9ba60f151bc8185beb0cc28abef93",
    );
    // Next run with staged constants → new hash + digest
    const next = withConstants(cfg, staged);
    const r1 = simulate(next);
    expect(r1.constants_hash).not.toBe(r0.constants_hash);
    expect(r1.digest).not.toBe(r0.digest);
  });

  it("rejects fixed and retired keys", () => {
    expect(() => validateConstantOverride("DT", 0.2)).toThrow(/fixed/);
    expect(() => validateConstantOverride("CONTROL_COEF", 1)).toThrow(/retired/);
    expect(() => validateConstantOverride("HIT_BASE", 0.1)).toThrow(/fixed/);
  });
});
