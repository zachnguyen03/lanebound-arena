import { describe, expect, it } from "vitest";
import { blendStates } from "./interp";
import type { MatchViewState } from "./types";

const st = (t: number, x: number, hp: number, alive = true) =>
  ({ t, units: { "blue:top": { x, y: 5, hp, alive } } }) as unknown as MatchViewState;

describe("blendStates", () => {
  it("glides position and hp, advances t", () => {
    const r = blendStates(st(1, 2, 100), st(1.1, 3, 80), 0.5);
    expect(r.t).toBeCloseTo(1.05);
    expect(r.units["blue:top"]!.x).toBeCloseTo(2.5);
    expect(r.units["blue:top"]!.hp).toBeCloseTo(90);
  });
  it("snaps blinks and deaths", () => {
    expect(blendStates(st(1, 2, 100), st(1.1, 6, 100), 0.5).units["blue:top"]!.x).toBe(2);
    expect(blendStates(st(1, 2, 100), st(1.1, 3, 0, false), 0.5).units["blue:top"]!.x).toBe(2);
  });
});
