import { describe, expect, it } from "vitest";
import { CHAMPION_IDS } from "../data/champions/defs.js";
import { KIT_IDS, KITS } from "../data/champions/kits.js";

describe("M1 authored kits present for all 14", () => {
  it("KIT_IDS matches CHAMPION_IDS", () => {
    expect([...KIT_IDS].sort()).toEqual([...CHAMPION_IDS].sort());
  });

  for (const id of CHAMPION_IDS) {
    it(`${id} has Q/W/R with authored CD and cast`, () => {
      const k = KITS[id];
      expect(k).toBeDefined();
      expect(k!.Q.name.length).toBeGreaterThan(0);
      expect(k!.W.name.length).toBeGreaterThan(0);
      expect(k!.R.name.length).toBeGreaterThan(0);
      expect(typeof k!.Q.CD_s).toBe("number");
      expect(typeof k!.Q.cast_s).toBe("number");
      expect(typeof k!.W.CD_s).toBe("number");
      expect(typeof k!.R.CD_s).toBe("number");
    });
  }

  it("Tolle/Mirren/Saelo W radius = 0.0 design proposal", () => {
    expect(KITS.tolle!.W.radius).toBe(0.0);
    expect(KITS.mirren!.W.radius).toBe(0.0);
    expect(KITS.saelo!.W.radius).toBe(0.0);
  });

  it("Huntress Q formula and Kerrig R cast 0.7 authored", () => {
    expect(KITS.huntress!.Q.l7_formula).toBe("110 + 80% ATK");
    expect(KITS.huntress!.Q.CD_s).toBe(8);
    expect(KITS.kerrig!.R.cast_s).toBe(0.7);
    expect(KITS.kerrig!.R.CD_s).toBe(42);
    expect(KITS.maelis!.R.l7_formula).toBe("350 + 170% POW");
    expect(KITS.huntress!.R.l7_formula).toBe("230 + 105% ATK");
    expect(KITS.kerrig!.R.l7_formula).toBe("330 + 140% ATK + 15% POW");
    expect(KITS.tolle!.W.cc![0]!.duration_s).toBe(1.8);
    expect(KITS.saelo!.R.radius).toBe(2.4);
    expect(KITS.mirren!.W.cc![0]!.notes).toMatch(/35%/);
    expect(KITS.calder!.W.radius).toBe(0.0);
  });
});
