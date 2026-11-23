import { describe, expect, it } from "vitest";
import { CHAMPION_IDS, SNAPSHOT_TABLE } from "../data/champions/defs.js";
import { roundSnapshot, statsAtLevel, skillScale } from "../sim/stats.js";

describe("M1-05 L1/L7/L10 stat snapshots", () => {
  it("skill_scale worked values", () => {
    expect(skillScale(1)).toBeCloseTo(0.7, 12);
    expect(skillScale(5)).toBeCloseTo(0.9, 12);
    expect(skillScale(7)).toBeCloseTo(1.0, 12);
    expect(skillScale(10)).toBeCloseTo(1.15, 12);
  });

  for (const id of CHAMPION_IDS) {
    for (const lv of [1, 7, 10] as const) {
      it(`${id} L${lv} matches §7 after display rounding`, () => {
        const want = SNAPSHOT_TABLE[id]![lv];
        const got = roundSnapshot(statsAtLevel(id, lv));
        expect(got.hp).toBe(want.hp);
        expect(got.atk).toBe(want.atk);
        expect(got.pow).toBe(want.pow);
        expect(got.pres).toBe(want.pres);
        expect(got.mres).toBe(want.mres);
        expect(got.as).toBeCloseTo(want.as, 3);
        expect(got.crit_pct).toBeCloseTo(want.crit_pct, 1);
        expect(got.range).toBe(want.range);
        expect(got.ms).toBe(want.ms);
        expect(got.ehp_avg).toBeCloseTo(want.ehp_avg, 1);
        // Regen: printed precision varies; allow 2 dp
        expect(got.regen).toBeCloseTo(want.regen, 2);
      });
    }
  }
});
