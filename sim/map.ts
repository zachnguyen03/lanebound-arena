/**
 * Layout B geometry and collision.
 * Source of truth for pillars / pads / sanctuary tile indices: data/layout-b.json
 * (derived from layoutB-tiles.json). Named centres and body/bounds rules: build-spec §5.1.
 * Axis: G1 — y=0 is top/north, x=0 west.
 */

import type { Constants } from "./constants.js";
import type { Team } from "./types.js";
import { clamp, floor, hypot } from "./math.js";

export function tileOf(x: number, y: number): { tx: number; ty: number } {
  return { tx: floor(x), ty: floor(y) };
}

export function enemySanctuaryXs(team: Team, c: Constants): number[] {
  return team === "blue" ? c.SANCTUARY_RED_X : c.SANCTUARY_BLUE_X;
}

export function ownSanctuaryXs(team: Team, c: Constants): number[] {
  return team === "blue" ? c.SANCTUARY_BLUE_X : c.SANCTUARY_RED_X;
}

export function inEnemySanctuary(team: Team, x: number, y: number, c: Constants): boolean {
  void y;
  const xs = enemySanctuaryXs(team, c);
  const tx = floor(x);
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] === tx) return true;
  }
  return false;
}

export function inOwnSanctuary(team: Team, x: number, y: number, c: Constants): boolean {
  void y;
  const xs = ownSanctuaryXs(team, c);
  const tx = floor(x);
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] === tx) return true;
  }
  return false;
}

/** Circle (cx,cy,r) vs axis-aligned rect [minX,maxX]×[minY,maxY]. */
export function circleHitsAabb(
  cx: number,
  cy: number,
  r: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): boolean {
  const qx = clamp(cx, minX, maxX);
  const qy = clamp(cy, minY, maxY);
  const dx = cx - qx;
  const dy = cy - qy;
  return dx * dx + dy * dy < r * r;
}

export function hitsPillar(x: number, y: number, c: Constants): boolean {
  const r = c.BODY_RADIUS;
  for (const p of c.PILLARS) {
    // Tile inclusive [x0,x1] × [y0,y1] → continuous AABB [x0, x1+1] × [y0, y1+1]
    const minX = p.x0;
    const maxX = p.x1 + 1;
    const minY = p.y0;
    const maxY = p.y1 + 1;
    if (circleHitsAabb(x, y, r, minX, maxX, minY, maxY)) return true;
  }
  return false;
}

export function outOfBounds(x: number, y: number, c: Constants): boolean {
  const r = c.BODY_RADIUS;
  return x < r || x > c.MAP_W - r || y < r || y > c.MAP_H - r;
}

export function clampToBounds(x: number, y: number, c: Constants): { x: number; y: number } {
  const r = c.BODY_RADIUS;
  return {
    x: clamp(x, r, c.MAP_W - r),
    y: clamp(y, r, c.MAP_H - r),
  };
}

export type ClipReason = "bounds" | "pillar" | "sanctuary" | null;

export interface ClipResult {
  x: number;
  y: number;
  clipped: boolean;
  reason: ClipReason;
}

function isIllegal(team: Team, x: number, y: number, c: Constants): ClipReason {
  if (outOfBounds(x, y, c)) return "bounds";
  if (hitsPillar(x, y, c)) return "pillar";
  if (inEnemySanctuary(team, x, y, c)) return "sanctuary";
  return null;
}

/**
 * G12: move from (x0,y0) toward (x1,y1); stop at first blocking boundary, no slide.
 * Binary-search the segment for the last legal point.
 */
export function clipMove(
  team: Team,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  c: Constants,
): ClipResult {
  const startIllegal = isIllegal(team, x0, y0, c);
  if (startIllegal) {
    // Already illegal (should not happen); push to nearest legal via clamp + reject sanctuary.
    const b = clampToBounds(x0, y0, c);
    if (!isIllegal(team, b.x, b.y, c)) {
      return { x: b.x, y: b.y, clipped: true, reason: startIllegal };
    }
    // Nudge away from enemy sanctuary threshold.
    const xs = enemySanctuaryXs(team, c);
    let nx = b.x;
    if (xs.length > 0) {
      const left = Math.min(...xs);
      const right = Math.max(...xs) + 1;
      if (floor(nx) >= left && floor(nx) < right) {
        nx = team === "blue" ? left - 1e-9 : right + 1e-9;
      }
    }
    const nb = clampToBounds(nx, b.y, c);
    return { x: nb.x, y: nb.y, clipped: true, reason: startIllegal };
  }

  if (!isIllegal(team, x1, y1, c)) {
    return { x: x1, y: y1, clipped: false, reason: null };
  }

  // Binary search along segment for last legal.
  let lo = 0;
  let hi = 1;
  let bestX = x0;
  let bestY = y0;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const mx = x0 + (x1 - x0) * mid;
    const my = y0 + (y1 - y0) * mid;
    if (isIllegal(team, mx, my, c)) {
      hi = mid;
    } else {
      bestX = mx;
      bestY = my;
      lo = mid;
    }
  }

  const reason = isIllegal(team, x1, y1, c);
  // If we barely moved, still report clip.
  const moved = hypot(bestX - x0, bestY - y0);
  void moved;
  return { x: bestX, y: bestY, clipped: true, reason };
}
