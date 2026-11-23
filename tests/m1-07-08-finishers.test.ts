import { describe, expect, it } from "vitest";
import { huntressRPacket, kerrigRPacket, maelisRPacket, kitBase } from "../sim/fixture.js";
import { statsAtLevel, mit } from "../sim/stats.js";
import { KITS } from "../data/champions/kits.js";

describe("M1-07 Huntress R absolute packets (kits.ts)", () => {
  it("marked +35% absolute L7 values from kits formula", () => {
    const s = statsAtLevel("huntress", 7);
    const base = kitBase("huntress", "R", s.atk, s.pow);
    expect(KITS.huntress!.R.l7_formula).toBe("230 + 105% ATK");
    expect(base).toBeCloseTo(230 + 1.05 * 100, 10);
    const a = huntressRPacket(7, s.atk, 36, true);
    const b = huntressRPacket(7, s.atk, 36, false);
    expect(a.base_raw).toBeCloseTo(base, 10);
    expect(b.base_raw).toBeCloseTo(base, 10);
    expect(a.raw).toBeCloseTo(base * 1.35, 6);
    expect(b.raw).toBeCloseTo(base, 6);
    expect(a.mitigated).toBeCloseTo(base * 1.35 * mit(36), 6);
    expect(b.mitigated).toBeCloseTo(base * mit(36), 6);
  });
});

describe("M1-08 Maelis R and Kerrig R absolute finishers", () => {
  it("Maelis R absolute L7 within 0.02", () => {
    const s = statsAtLevel("maelis", 7);
    expect(KITS.maelis!.R.l7_formula).toBe("350 + 170% POW");
    const base = kitBase("maelis", "R", s.atk, s.pow);
    expect(base).toBeCloseTo(350 + 1.7 * s.pow, 10);
    const miss = 0.4;
    const p = maelisRPacket(7, s.pow, 34, miss);
    expect(p.base_raw).toBeCloseTo(base, 10);
    expect(p.raw).toBeCloseTo(base * (1 + 0.2 * miss), 6);
    expect(Math.abs(p.mitigated - p.raw * mit(34))).toBeLessThanOrEqual(0.02);
  });

  it("Kerrig R absolute L7 within 0.02; no mark fizzles", () => {
    const s = statsAtLevel("kerrig", 7);
    expect(KITS.kerrig!.R.l7_formula).toBe("330 + 140% ATK + 15% POW");
    const base = kitBase("kerrig", "R", s.atk, s.pow);
    expect(base).toBeCloseTo(330 + 1.4 * s.atk + 0.15 * s.pow, 10);
    const miss = 0.5;
    const p = kerrigRPacket(7, s.atk, s.pow, 32, miss, true);
    expect(p.base_raw).toBeCloseTo(base, 10);
    expect(p.raw).toBeCloseTo(base * (1 + 0.35 * miss), 6);
    expect(Math.abs(p.mitigated - p.raw * mit(32))).toBeLessThanOrEqual(0.02);
    const fiz = kerrigRPacket(7, s.atk, s.pow, 32, miss, false);
    expect(fiz.fizzled).toBe(true);
    expect(fiz.mitigated).toBe(0);
  });
});
