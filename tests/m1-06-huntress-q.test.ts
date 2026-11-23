import { describe, expect, it } from "vitest";
import { huntressQPacket } from "../sim/fixture.js";
import { statsAtLevel } from "../sim/stats.js";

describe("M1-06 Huntress Q packet", () => {
  it("L7 vs 36 PRes = 139.706 ± 0.02", () => {
    const s = statsAtLevel("huntress", 7);
    expect(s.atk).toBeCloseTo(100, 6);
    const p = huntressQPacket(7, s.atk, 36);
    // raw = 110 + 0.80*100 = 190; mit = 100/136; mitigated = 139.70588…
    expect(p.raw).toBeCloseTo(190, 6);
    expect(p.mitigated).toBeCloseTo(139.706, 2);
    expect(Math.abs(p.mitigated - 139.706)).toBeLessThanOrEqual(0.02);
  });

  it("L1 Q uses skill_scale 0.70", () => {
    const s = statsAtLevel("huntress", 1);
    const p = huntressQPacket(1, s.atk, 36);
    // raw = (110 + 0.80*72)*0.70 = 117.32
    expect(p.raw).toBeCloseTo(117.32, 2);
  });
});
