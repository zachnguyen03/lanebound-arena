/**
 * Hex steer target (Appendix R #2 L1899):
 * centroid of all living same-team units excluding self; no radius;
 * phase-start poses recomputed every tick; own pad when alone.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { hexSteerTarget, type PhasePose } from "../sim/motor.js";
import type { UnitId } from "../sim/types.js";

const c = DEFAULT_CONSTANTS;
const A = "blue:mid" as UnitId;

function pose(id: UnitId, x: number, y: number, alive = true): PhasePose {
  const team = id.startsWith("red:") ? "red" : "blue";
  return { id, x, y, alive, team };
}

describe("hexSteerTarget (L1899)", () => {
  it("excludes the hexed unit itself from the centroid", () => {
    const phase: PhasePose[] = [
      pose(A, 8, 6),
      pose("blue:adc" as UnitId, 10, 12),
      pose("blue:support" as UnitId, 6, 12),
    ];
    const dest = hexSteerTarget({ id: A, team: "blue" }, phase, c);
    // Centroid of adc+support only — not pulled toward self at (8,6)
    expect(dest.x).toBeCloseTo(8, 10);
    expect(dest.y).toBeCloseTo(12, 10);
  });

  it("ignores dead allies (and enemies)", () => {
    const phase: PhasePose[] = [
      pose(A, 8, 8),
      pose("blue:adc" as UnitId, 20, 8, false), // dead — excluded
      pose("blue:top" as UnitId, 4, 4, true),
      pose("red:mid" as UnitId, 22, 8, true), // enemy — excluded
    ];
    const dest = hexSteerTarget({ id: A, team: "blue" }, phase, c);
    expect(dest.x).toBeCloseTo(4, 10);
    expect(dest.y).toBeCloseTo(4, 10);
  });

  it("recomputes from the phase-start snapshot each call (per-tick)", () => {
    const tick1: PhasePose[] = [
      pose(A, 8, 6),
      pose("blue:adc" as UnitId, 8, 12),
      pose("blue:support" as UnitId, 8, 12),
    ];
    const tick2: PhasePose[] = [
      pose(A, 8, 7), // self moved
      pose("blue:adc" as UnitId, 14, 10), // allies moved since last tick
      pose("blue:support" as UnitId, 10, 10),
    ];
    const d1 = hexSteerTarget({ id: A, team: "blue" }, tick1, c);
    const d2 = hexSteerTarget({ id: A, team: "blue" }, tick2, c);
    expect(d1.x).toBeCloseTo(8, 10);
    expect(d1.y).toBeCloseTo(12, 10);
    expect(d2.x).toBeCloseTo(12, 10);
    expect(d2.y).toBeCloseTo(10, 10);
    expect(d1.y).not.toBeCloseTo(d2.y, 5);
  });

  it("with no other living allies, targets own spawn pad centre", () => {
    const alone: PhasePose[] = [
      pose(A, 8, 10),
      pose("blue:adc" as UnitId, 8, 4, false),
      pose("red:mid" as UnitId, 11, 10, true),
    ];
    const dest = hexSteerTarget({ id: A, team: "blue" }, alone, c);
    expect(dest.x).toBeCloseTo(c.BLUE_SPAWN[0]!, 10);
    expect(dest.y).toBeCloseTo(c.BLUE_SPAWN[1]!, 10);

    const redAlone: PhasePose[] = [pose("red:adc" as UnitId, 16, 8)];
    const redDest = hexSteerTarget({ id: "red:adc" as UnitId, team: "red" }, redAlone, c);
    expect(redDest.x).toBeCloseTo(c.RED_SPAWN[0]!, 10);
    expect(redDest.y).toBeCloseTo(c.RED_SPAWN[1]!, 10);
  });
});
