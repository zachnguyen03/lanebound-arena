import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS, defaultEvenConfig, simulate } from "../sim/index.js";
import { hitChance } from "../sim/stats.js";
import { sha256Hex } from "../sim/sha256.js";
import type { MatchConfig, UnitId } from "../sim/types.js";

const N = 2000;
const SEED = 20261122;
const TOL = 0.02; // ±2 percentage points — do not widen

function aimLab(seed: number, aim: number, reflexes: number, n = N): {
  hits: number;
  rate: number;
  replayDigest: string;
  hitChance: number;
} {
  const caster = "blue:adc" as UnitId;
  const target = "red:adc" as UnitId;
  const cfg: MatchConfig = {
    ...defaultEvenConfig(seed),
    constants: { MATCH_T: 1.0 },
    unit_overrides: {
      [caster]: {
        x: 12,
        y: 8,
        champ: "huntress",
        spawn_shield_until: 0,
        auto_next_start_t: 999,
        attrs: { aim, reflexes: 70, execution: 70, decision: 70, positioning: 70, teamwork: 70 },
      },
      [target]: {
        x: 13,
        y: 8,
        spawn_shield_until: 0,
        auto_next_start_t: 999,
        attrs: { aim: 70, reflexes, execution: 70, decision: 70, positioning: 70, teamwork: 70 },
      },
    },
    scripted_skillshots: [{ tick: 1, source_id: caster, target_id: target, count: n }],
  };
  const r = simulate(cfg);
  const rolls = r.events.filter((e) => e.type === "skillshot_roll" && e.skill_id === "lab_skillshot");
  const hits = rolls.filter((e) => e.hit === true).length;
  const bits = rolls.map((e) => (e.hit ? 1 : 0)).join("");
  const p = hitChance(
    aim,
    reflexes,
    DEFAULT_CONSTANTS.HIT_BASE,
    DEFAULT_CONSTANTS.HIT_COEF,
    DEFAULT_CONSTANTS.HIT_FLOOR,
    DEFAULT_CONSTANTS.HIT_CEIL,
  );
  return { hits, rate: hits / n, replayDigest: sha256Hex(bits), hitChance: p };
}

describe("M1-19b Aim vs Reflexes (sim skillshots + HIT_* constants)", () => {
  it("HIT constants drive the formula 55/85/25%", () => {
    const c = DEFAULT_CONSTANTS;
    expect(hitChance(60, 60, c.HIT_BASE, c.HIT_COEF, c.HIT_FLOOR, c.HIT_CEIL)).toBeCloseTo(0.55, 12);
    expect(hitChance(90, 60, c.HIT_BASE, c.HIT_COEF, c.HIT_FLOOR, c.HIT_CEIL)).toBeCloseTo(0.85, 12);
    expect(hitChance(60, 90, c.HIT_BASE, c.HIT_COEF, c.HIT_FLOOR, c.HIT_CEIL)).toBeCloseTo(0.25, 12);
  });

  it("60 vs 60 → ~55% ±2 over 2000 rolls; identical replay digest", () => {
    const a = aimLab(SEED, 60, 60);
    const b = aimLab(SEED, 60, 60);
    expect(a.hitChance).toBeCloseTo(0.55, 12);
    expect(Math.abs(a.rate - 0.55)).toBeLessThanOrEqual(TOL);
    expect(a.replayDigest).toBe(b.replayDigest);
    expect(a.hits).toBe(b.hits);
  });

  it("90 vs 60 → ~85% ±2 over 2000 rolls; identical replay digest", () => {
    const a = aimLab(SEED, 90, 60);
    const b = aimLab(SEED, 90, 60);
    expect(a.hitChance).toBeCloseTo(0.85, 12);
    expect(Math.abs(a.rate - 0.85)).toBeLessThanOrEqual(TOL);
    expect(a.replayDigest).toBe(b.replayDigest);
  });

  it("60 vs 90 → ~25% ±2 over 2000 rolls; identical replay digest", () => {
    const a = aimLab(SEED, 60, 90);
    const b = aimLab(SEED, 60, 90);
    expect(a.hitChance).toBeCloseTo(0.25, 12);
    expect(Math.abs(a.rate - 0.25)).toBeLessThanOrEqual(TOL);
    expect(a.replayDigest).toBe(b.replayDigest);
  });

  it("seed+1 differs from base seed replay digest", () => {
    const a = aimLab(SEED, 60, 60);
    const b = aimLab(SEED + 1, 60, 60);
    expect(a.replayDigest).not.toBe(b.replayDigest);
  });

  it("info: pass rate over 100 seeds at 60vs60 within ±2 of 55%", () => {
    let pass = 0;
    for (let s = 0; s < 100; s++) {
      const r = aimLab(SEED + s, 60, 60, 500); // 500 rolls/seed for speed; informational
      if (Math.abs(r.rate - 0.55) <= TOL) pass += 1;
    }
    // Informational — always log; soft assert that majority pass
    expect(pass).toBeGreaterThan(50);
  });
});
