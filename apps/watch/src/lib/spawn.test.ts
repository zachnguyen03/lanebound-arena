import { describe, expect, it } from "vitest";
import { padGroundPx, spawnPose, tileCentre } from "./spawn";

describe("tile-centre placement (GD ruling)", () => {
  it("places tile indices at centres", () => {
    expect(tileCentre(1, 7)).toEqual({ x: 1.5, y: 7.5 });
    expect(tileCentre(22, 7)).toEqual({ x: 22.5, y: 7.5 });
  });

  it("spawnPose uses centres + jitter, not integer S0 spawns", () => {
    expect(spawnPose("blue", "mid")).toEqual({ x: 1.5, y: 7.5 });
    expect(spawnPose("red", "support").x).toBe(22.5);
    expect(spawnPose("blue", "top").y).toBeCloseTo(6.9, 5);
  });

  it("padGroundPx matches atlas tile-centre formula", () => {
    // ((tx+0.5)*44, (ty+0.5)*32)
    expect(padGroundPx(2, 4)).toEqual({ px: 110, py: 144 });
    expect(padGroundPx(7, 7)).toEqual({ px: 330, py: 240 });
  });
});
