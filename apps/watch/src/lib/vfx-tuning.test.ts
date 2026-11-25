import { afterEach, describe, expect, it } from "vitest";
import { tuneFor, tuneKey, VFX_TUNING } from "./vfx-tuning";

afterEach(() => {
  for (const k of Object.keys(VFX_TUNING)) delete VFX_TUNING[k];
});

describe("vfx tuning", () => {
  it("keys by kit slot, autos and ults", () => {
    expect(tuneKey("huntress", "Keen Bolt")).toBe("huntress:Q");
    expect(tuneKey("huntress", "auto", true)).toBe("huntress:auto");
    expect(tuneKey("saelo", "R")).toBe("saelo:R");
  });

  it("merges * < champ < champ:key over defaults", () => {
    VFX_TUNING["*"] = { scale: 0.5, alpha: 0.8 };
    VFX_TUNING.huntress = { scale: 0.75, dx: 2 };
    VFX_TUNING["huntress:Q"] = { dx: 5 };
    expect(tuneFor("huntress", "Keen Bolt")).toEqual({ scale: 0.75, dx: 5, dy: 0, alpha: 0.8, timeMul: 1, leadS: 0 });
    expect(tuneFor("saelo", "R").scale).toBe(0.5);
  });
});
