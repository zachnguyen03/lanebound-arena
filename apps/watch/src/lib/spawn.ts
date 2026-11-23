import type { Slot, Team, UnitId } from "./types";
import { SLOTS } from "./types";

/**
 * GD ruling: tile-index positions place at tile centres (x+0.5, y+0.5).
 * Spawn pads are tile indices (1,7) / (22,7) → centres (1.5, 7.5) / (22.5, 7.5).
 * Zone centre stays the geometric point (12.0, 8.0) — not a tile-index pad.
 * Viewer fallback only; units still render at sim poses from the log when present.
 */
export const BLUE_SPAWN_TILE: [number, number] = [1, 7];
export const RED_SPAWN_TILE: [number, number] = [22, 7];
export const SPAWN_JITTER_Y = 0.3;
export const DUMMY_MAX_HP = 900;

/** Tile index → continuous centre. */
export function tileCentre(tx: number, ty: number): { x: number; y: number } {
  return { x: tx + 0.5, y: ty + 0.5 };
}

/** Terrain px for a continuous sim point (y-down). */
export function simToTerrainPx(x: number, y: number): { px: number; py: number } {
  return { px: x * 44, py: y * 32 };
}

/** Terrain px for a pad at tile index (tx, ty) — always the tile centre. */
export function padGroundPx(tx: number, ty: number): { px: number; py: number } {
  const c = tileCentre(tx, ty);
  return simToTerrainPx(c.x, c.y);
}

export function spawnPose(team: Team, slot: Slot): { x: number; y: number } {
  const tile = team === "blue" ? BLUE_SPAWN_TILE : RED_SPAWN_TILE;
  const centre = tileCentre(tile[0], tile[1]);
  const slotOrd = SLOTS.indexOf(slot);
  const yOff = (slotOrd - 2) * SPAWN_JITTER_Y;
  return { x: centre.x, y: centre.y + yOff };
}

export function unitId(team: Team, slot: Slot): UnitId {
  return `${team}:${slot}`;
}
