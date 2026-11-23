import { describe, expect, it } from "vitest";
import { huntressRPacket, kerrigRPacket, maelisRPacket } from "../sim/fixture.js";
import { statsAtLevel } from "../sim/stats.js";

describe("M1-07 Huntress R mark consume", () => {
  it("marked target gets +35%; second R without remake does not", () => {
    const s = statsAtLevel("huntress", 7);
    const a = huntressRPacket(7, s.atk, 36, true);
    const b = huntressRPacket(7, s.atk, 36, false);
    expect(a.consumed_mark).toBe(true);
    expect(b.consumed_mark).toBe(false);
    expect(a.raw / b.raw).toBeCloseTo(1.35, 6);
    expect(Math.abs(a.mitigated / b.mitigated - 1.35)).toBeLessThan(1e-9);
  });
});

describe("M1-08 Maelis R and Kerrig R finishers", () => {
  it("Maelis R finisher matches 1+0.20*missing within 0.02", () => {
    const s = statsAtLevel("maelis", 7);
    const miss = 0.4;
    const p = maelisRPacket(7, s.pow, 34, miss);
    const base = maelisRPacket(7, s.pow, 34, 0);
    expect(p.raw / base.raw).toBeCloseTo(1 + 0.2 * miss, 6);
    expect(Math.abs(p.mitigated - base.mitigated * (1 + 0.2 * miss))).toBeLessThanOrEqual(0.02);
  });

  it("Kerrig R finisher matches 1+0.35*missing within 0.02; no mark fizzles", () => {
    const s = statsAtLevel("kerrig", 7);
    const miss = 0.5;
    const p = kerrigRPacket(7, s.atk, s.pow, 32, miss, true);
    const base = kerrigRPacket(7, s.atk, s.pow, 32, 0, true);
    expect(p.fizzled).toBe(false);
    expect(p.raw / base.raw).toBeCloseTo(1 + 0.35 * miss, 6);
    expect(Math.abs(p.mitigated - base.mitigated * (1 + 0.35 * miss))).toBeLessThanOrEqual(0.02);

    const fiz = kerrigRPacket(7, s.atk, s.pow, 32, miss, false);
    expect(fiz.fizzled).toBe(true);
    expect(fiz.mitigated).toBe(0);
  });
});
