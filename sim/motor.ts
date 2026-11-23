import type { Constants } from "./constants.js";
import { clipMove, type ClipReason } from "./map.js";
import { dist, hypot, normalize } from "./math.js";
import type { MatchState, UnitState, Vec2 } from "./types.js";

export interface SteerResult {
  unit: UnitState;
  clipped: boolean;
  reason: ClipReason;
}

/**
 * Soft ally separation (G6): within SEPARATION_RADIUS, allies only, steering only.
 * Invention INV-SEP-STRENGTH: push = strength * (1 - d/r) along away vector.
 */
export function separationSteer(
  unit: UnitState,
  allies: UnitState[],
  c: Constants,
): Vec2 {
  let sx = 0;
  let sy = 0;
  const r = c.SEPARATION_RADIUS;
  for (const a of allies) {
    if (a.id === unit.id || !a.alive) continue;
    const d = dist(unit.x, unit.y, a.x, a.y);
    if (d <= 0 || d >= r) continue;
    const n = normalize(unit.x - a.x, unit.y - a.y);
    const mag = c.SEPARATION_STRENGTH * (1 - d / r);
    sx += n.x * mag;
    sy += n.y * mag;
  }
  return { x: sx, y: sy };
}

export function desiredVelocity(unit: UnitState, c: Constants, sep: Vec2): Vec2 {
  let dx = 0;
  let dy = 0;
  if (unit.waypoint) {
    const n = normalize(unit.waypoint.x - unit.x, unit.waypoint.y - unit.y);
    dx = n.x * unit.stats.ms;
    dy = n.y * unit.stats.ms;
  }
  dx += sep.x;
  dy += sep.y;
  const speed = hypot(dx, dy);
  const maxMs = unit.stats.ms;
  if (speed > maxMs && speed > 0) {
    const s = maxMs / speed;
    dx *= s;
    dy *= s;
  }
  return { x: dx, y: dy };
}

/**
 * Integrate one unit's ordinary steering for this tick, then clip (G12 first half).
 */
export function integrateSteering(
  state: MatchState,
  unit: UnitState,
  c: Constants,
): SteerResult {
  if (!unit.alive) {
    unit.vx = 0;
    unit.vy = 0;
    return { unit, clipped: false, reason: null };
  }

  const allies = state.units.filter((u) => u.team === unit.team && u.alive);
  // Sort allies by unit index for deterministic accumulation order.
  allies.sort((a, b) => a.index - b.index);

  const sep = separationSteer(unit, allies, c);
  const vel = desiredVelocity(unit, c, sep);
  unit.vx = vel.x;
  unit.vy = vel.y;

  const nx = unit.x + vel.x * c.DT;
  const ny = unit.y + vel.y * c.DT;
  const clipped = clipMove(unit.team, unit.x, unit.y, nx, ny, c);
  unit.x = clipped.x;
  unit.y = clipped.y;
  if (clipped.clipped) {
    unit.vx = 0;
    unit.vy = 0;
  }
  return { unit, clipped: clipped.clipped, reason: clipped.reason };
}

/**
 * Apply one displacement (G12): from current pos, add (dx,dy), clip individually.
 */
export function applyDisplacement(
  unit: UnitState,
  dx: number,
  dy: number,
  c: Constants,
): SteerResult {
  if (!unit.alive) return { unit, clipped: false, reason: null };
  const nx = unit.x + dx;
  const ny = unit.y + dy;
  const clipped = clipMove(unit.team, unit.x, unit.y, nx, ny, c);
  unit.x = clipped.x;
  unit.y = clipped.y;
  return { unit, clipped: clipped.clipped, reason: clipped.reason };
}

/** Advance scripted motor waypoint if arrived. */
export function advanceScriptedWaypoint(unit: UnitState, c: Constants, arriveR: number): void {
  if (!unit.waypoint) return;
  if (dist(unit.x, unit.y, unit.waypoint.x, unit.waypoint.y) <= arriveR) {
    unit.scripted_wp_i += 1;
  }
}
