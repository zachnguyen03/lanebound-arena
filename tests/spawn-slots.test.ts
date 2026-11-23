/**
 * L214 spawn spacing: pad centre + slot × SPAWN_SLOT_SPACING;
 * Top−2 … Support+2 → y 5.5…9.5 at default 1.0; red mirrors blue (24−x).
 * Respawn always uses the unit's own slot (no occupancy check).
 */
import { describe, expect, it } from "vitest";
import {
  constantsHash,
  DEFAULT_CONSTANTS,
  defaultEvenConfig,
  mergeConstants,
  simulate,
  spawnPose,
} from "../sim/index.js";
import type { Slot, Team, UnitId } from "../sim/types.js";

const SLOTS: Slot[] = ["top", "jungle", "mid", "adc", "support"];
const MULT: Record<Slot, number> = {
  top: -2,
  jungle: -1,
  mid: 0,
  adc: 1,
  support: 2,
};

describe("L214 spawn-slot spacing", () => {
  it("SPAWN_SLOT_SPACING default 1.0 (tunable 0.8–1.2); SPAWN_JITTER_Y removed", () => {
    expect(DEFAULT_CONSTANTS.SPAWN_SLOT_SPACING).toBe(1.0);
    expect(DEFAULT_CONSTANTS.SPAWN_SLOT_SPACING).toBeGreaterThanOrEqual(0.8);
    expect(DEFAULT_CONSTANTS.SPAWN_SLOT_SPACING).toBeLessThanOrEqual(1.2);
    expect("SPAWN_JITTER_Y" in DEFAULT_CONSTANTS).toBe(false);
  });

  it("changing SPAWN_SLOT_SPACING changes constants_hash", () => {
    const base = constantsHash(DEFAULT_CONSTANTS);
    const low = constantsHash(mergeConstants({ SPAWN_SLOT_SPACING: 0.8 }));
    const high = constantsHash(mergeConstants({ SPAWN_SLOT_SPACING: 1.2 }));
    expect(low).not.toBe(base);
    expect(high).not.toBe(base);
    expect(low).not.toBe(high);
  });

  it("t=0: all 10 units sit on pad centre ± slot spacing (y 5.5…9.5)", () => {
    const r = simulate({
      ...defaultEvenConfig(20261122),
      ai_enabled: false,
      constants: { MATCH_T: 0.5 },
    });
    const spacing = DEFAULT_CONSTANTS.SPAWN_SLOT_SPACING;
    for (const team of ["blue", "red"] as Team[]) {
      const pad = team === "blue" ? DEFAULT_CONSTANTS.BLUE_SPAWN : DEFAULT_CONSTANTS.RED_SPAWN;
      for (const slot of SLOTS) {
        const u = r.state.units.find((x) => x.id === (`${team}:${slot}` as UnitId))!;
        expect(u.x, `${u.id} x`).toBeCloseTo(pad[0]!, 10);
        expect(u.y, `${u.id} y`).toBeCloseTo(pad[1]! + MULT[slot] * spacing, 10);
        // Explicit band at default spacing
        expect(u.y).toBeGreaterThanOrEqual(5.5 - 1e-9);
        expect(u.y).toBeLessThanOrEqual(9.5 + 1e-9);
      }
    }
  });

  it("red mirrors blue exactly (x ↦ 24−x, same y per slot)", () => {
    for (const slot of SLOTS) {
      const b = spawnPose("blue", slot, DEFAULT_CONSTANTS);
      const r = spawnPose("red", slot, DEFAULT_CONSTANTS);
      expect(r.x).toBeCloseTo(DEFAULT_CONSTANTS.MAP_W - b.x, 12);
      expect(r.y).toBeCloseTo(b.y, 12);
    }
  });

  it("respawn returns the unit to its own slot (no occupancy shift)", () => {
    const mid = "blue:mid" as UnitId;
    const top = "blue:top" as UnitId;
    const foe = "red:adc" as UnitId;
    // Mid dies at t=0.5; L1 respawn = 6 + 1.5×1 = 7.5 → tick 75.
    // Top stays alive on their slot the whole time (occupancy must not matter).
    const r = simulate({
      ...defaultEvenConfig(20261122),
      ai_enabled: false,
      constants: { MATCH_T: 8.0 },
      unit_overrides: {
        [mid]: { x: 12, y: 8, level: 1, spawn_shield_until: 0, auto_next_start_t: 999, hp: 30 },
        [top]: { spawn_shield_until: 0, auto_next_start_t: 999 },
        [foe]: { x: 12.5, y: 8, spawn_shield_until: 0, auto_next_start_t: 999 },
      },
      scripted_damage: [{ tick: 5, source_id: foe, target_id: mid, raw: 10_000 }],
    });
    const death = r.events.find((e) => e.type === "death" && e.unit_id === mid)!;
    expect(death).toBeDefined();
    expect(death.respawn_at as number).toBeCloseTo(0.5 + 6 + 1.5, 6);

    const respawn = r.events.find((e) => e.type === "respawn" && e.unit_id === mid)!;
    expect(respawn).toBeDefined();
    expect(respawn.t as number).toBeCloseTo(death.respawn_at as number, 6);

    const want = spawnPose("blue", "mid", DEFAULT_CONSTANTS);
    expect(respawn.x as number).toBeCloseTo(want.x, 10);
    expect(respawn.y as number).toBeCloseTo(want.y, 10);
    expect(respawn.slot).toBe("mid");

    const u = r.state.units.find((x) => x.id === mid)!;
    expect(u.alive).toBe(true);
    expect(u.x).toBeCloseTo(want.x, 5);
    expect(u.y).toBeCloseTo(want.y, 5);

    // Top never moved off their slot — mid still respawned on mid's y, not shifted.
    const topU = r.state.units.find((x) => x.id === top)!;
    const topWant = spawnPose("blue", "top", DEFAULT_CONSTANTS);
    expect(topU.y).toBeCloseTo(topWant.y, 5);
    expect(u.y).not.toBeCloseTo(topU.y, 5);
  });
});
