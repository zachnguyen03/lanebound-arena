import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { israRSanctuaryFixture } from "../sim/sanctuary_clip.js";

describe("M1-09 Isra R sanctuary clip", () => {
  it("aimed at enemy pad deals 0 to unit in that sanctuary; sanctuary_clip logged", () => {
    const c = DEFAULT_CONSTANTS;
    // Blue Isra aims Starfall at red pad (x=22.5, y=8); red unit stands in pad.
    const r = israRSanctuaryFixture("blue", 22.5, 8, 22.5, 8, "red", c);
    expect(r.in_sanctuary).toBe(true);
    expect(r.damage).toBe(0);
    expect(r.clipped).toBe(true);
    expect(r.reason).toBe("aoe");
  });

  it("land outside sanctuary can still deal (non-pad target)", () => {
    const c = DEFAULT_CONSTANTS;
    const r = israRSanctuaryFixture("blue", 12, 8, 12, 8, "red", c);
    expect(r.in_sanctuary).toBe(false);
    expect(r.damage).toBe(1);
    expect(r.clipped).toBe(false);
  });
});
