import type { Slot, Team, UnitId } from "./types";
import { SLOTS } from "./types";

/** S0 spawn constants — mirror sim/constants.ts (viewer-side, no sim writeback). */
export const BLUE_SPAWN: [number, number] = [1, 7];
export const RED_SPAWN: [number, number] = [22, 7];
export const SPAWN_JITTER_Y = 0.3;
export const DUMMY_MAX_HP = 900;

export function spawnPose(team: Team, slot: Slot): { x: number; y: number } {
  const spawn = team === "blue" ? BLUE_SPAWN : RED_SPAWN;
  const slotOrd = SLOTS.indexOf(slot);
  const yOff = (slotOrd - 2) * SPAWN_JITTER_Y;
  return { x: spawn[0], y: spawn[1] + yOff };
}

export function unitId(team: Team, slot: Slot): UnitId {
  return `${team}:${slot}`;
}
