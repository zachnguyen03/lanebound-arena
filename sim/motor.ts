import { LEASH_RADIUS } from "./config.js";
import type { Constants } from "./constants.js";
import { clipMove, type ClipReason } from "./map.js";
import { dist, hypot, normalize } from "./math.js";
import { isMovementFrozen } from "./passives.js";
import {
  hasKind,
  isBanished,
  isLeashed,
  isRooted,
  isTimeStopped,
  leashSourceId,
  strongestSlow,
} from "./status.js";
import type { MatchState, Team, UnitId, UnitState, Vec2 } from "./types.js";
import { isBackliner } from "./ai/formation.js";

/** Pose snapshot at the start of the motor phase (L1899). */
export interface PhasePose {
  id: UnitId;
  x: number;
  y: number;
  alive: boolean;
  team: Team;
}

export interface SteerResult {
  unit: UnitState;
  clipped: boolean;
  reason: ClipReason;
}

/**
 * Soft ally separation (G6): within SEPARATION_RADIUS, allies only, steering only.
 */
export function separationSteer(
  unit: UnitState,
  allies: UnitState[],
  c: Constants,
  spread: { r: number; k: number } | null = null,
): Vec2 {
  let sx = 0;
  let sy = 0;
  const r = spread?.r ?? c.SEPARATION_RADIUS;
  const strength = c.SEPARATION_STRENGTH * (spread?.k ?? 1);
  for (const a of allies) {
    if (a.id === unit.id || !a.alive) continue;
    const d = dist(unit.x, unit.y, a.x, a.y);
    if (d <= 0 || d >= r) continue;
    const n = normalize(unit.x - a.x, unit.y - a.y);
    const mag = strength * (1 - d / r);
    sx += n.x * mag;
    sy += n.y * mag;
  }
  return { x: sx, y: sy };
}

const SPREAD_INTENTS = new Set(["Chase", "Approach", "Engage", "Kite", "Peel"]);

/** exp teamfight round 3 `spread`: wider separation while fighting. */
function fightSpread(state: MatchState, unit: UnitState): { r: number; k: number } | null {
  if (!state.config?.teamfight?.spread || !SPREAD_INTENTS.has(unit.intent)) return null;
  return { r: 1.2, k: isBackliner(unit) ? 1.5 : 1 };
}

function flankMsMult(unit: UnitState, t: number, c: Constants): number {
  return (unit.flank_buff_until > t + 1e-12 ? 1 + c.BUFF_MS : 1) * (unit.card?.ms ?? 1);
}

export function desiredVelocity(
  unit: UnitState,
  c: Constants,
  sep: Vec2,
  now = 0,
): Vec2 {
  const ms = unit.stats.ms * flankMsMult(unit, now, c);
  let dx = 0;
  let dy = 0;
  if (unit.waypoint) {
    const n = normalize(unit.waypoint.x - unit.x, unit.waypoint.y - unit.y);
    dx = n.x * ms;
    dy = n.y * ms;
  }
  dx += sep.x;
  dy += sep.y;
  const slow = strongestSlow(unit.status);
  const maxMs = ms * (1 - slow);
  const speed = hypot(dx, dy);
  if (speed > maxMs && speed > 0) {
    const s = maxMs / speed;
    dx *= s;
    dy *= s;
  }
  return { x: dx, y: dy };
}

function isMovementLocked(unit: UnitState): boolean {
  if (isTimeStopped(unit.status)) return true;
  if (isBanished(unit.status)) return true;
  if (isRooted(unit.status)) return true;
  if (isMovementFrozen(unit.status)) return true;
  return false;
}

/** Apply a desired delta with clip; on block, slide along the face (axis + perpendicular). */
function moveWithSlide(
  unit: UnitState,
  dx: number,
  dy: number,
  c: Constants,
): SteerResult {
  const direct = clipMove(unit.team, unit.x, unit.y, unit.x + dx, unit.y + dy, c);
  if (!direct.clipped) {
    unit.x = direct.x;
    unit.y = direct.y;
    return { unit, clipped: false, reason: null };
  }
  // Commit partial progress onto the contact face, then slide tangentially from there
  // so the unit stays pressed against the obstacle while y/x changes (OQ-3).
  const cx = direct.x;
  const cy = direct.y;
  const remain = Math.max(0, hypot(dx, dy) - hypot(cx - unit.x, cy - unit.y));

  const len = hypot(dx, dy);
  const px = len > 1e-12 ? (-dy / len) * remain : 0;
  const py = len > 1e-12 ? (dx / len) * remain : 0;

  type Cand = { x: number; y: number; clipped: boolean; reason: ClipReason; score: number };
  const cands: Cand[] = [];
  const pushCand = (x0: number, y0: number, x1: number, y1: number) => {
    const r = clipMove(unit.team, x0, y0, x1, y1, c);
    cands.push({
      x: r.x,
      y: r.y,
      clipped: true,
      reason: r.reason ?? direct.reason,
      score: hypot(r.x - unit.x, r.y - unit.y),
    });
  };
  // From contact: full remaining step along ±tangent, and axis-aligned slides
  pushCand(cx, cy, cx + px, cy + py);
  pushCand(cx, cy, cx - px, cy - py);
  pushCand(cx, cy, cx + remain * Math.sign(dx || 0), cy);
  pushCand(cx, cy, cx, cy + remain * Math.sign(dy || 0));
  // Also try pure axis slides from the pre-clip origin (covers glancing hits)
  pushCand(unit.x, unit.y, unit.x + dx, unit.y);
  pushCand(unit.x, unit.y, unit.x, unit.y + dy);
  cands.push({
    x: cx,
    y: cy,
    clipped: true,
    reason: direct.reason,
    score: hypot(cx - unit.x, cy - unit.y),
  });

  cands.sort((a, b) => b.score - a.score);
  const best = cands[0]!;
  unit.x = best.x;
  unit.y = best.y;
  if (best.score < 1e-9) {
    unit.vx = 0;
    unit.vy = 0;
  }
  return { unit, clipped: true, reason: best.reason };
}

function fearSource(state: MatchState, unit: UnitState): UnitState | null {
  const e = unit.status.effects.find((x) => x.kind === "fear" && x.remaining > 0);
  if (!e) return null;
  return state.units.find((u) => u.id === e.source_id) ?? null;
}

/**
 * Hex steer target (Appendix R #2 L1899):
 * centroid of ALL living same-team units excluding the hexed unit itself,
 * from phase-start positions (recomputed every tick). No radius filter.
 * If no other living allies → own spawn pad centre (BLUE_SPAWN / RED_SPAWN).
 */
export function hexSteerTarget(
  unit: { id: UnitId; team: Team },
  phaseStart: readonly PhasePose[],
  c: Constants,
): Vec2 {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const p of phaseStart) {
    if (!p.alive || p.team !== unit.team || p.id === unit.id) continue;
    sx += p.x;
    sy += p.y;
    n += 1;
  }
  if (n === 0) {
    const pad = unit.team === "blue" ? c.BLUE_SPAWN : c.RED_SPAWN;
    return { x: pad[0]!, y: pad[1]! };
  }
  return { x: sx / n, y: sy / n };
}

/**
 * Integrate one unit's ordinary steering for this tick, then clip (G12 first half).
 * Fear / hex override the Unit Brain (Appendix R #2 OQ-3).
 */
export function integrateSteering(
  state: MatchState,
  unit: UnitState,
  c: Constants,
  /** Motor-phase start poses; required for hex (L1899). Defaults to live state (tests). */
  phaseStart?: readonly PhasePose[],
): SteerResult {
  if (!unit.alive) {
    unit.vx = 0;
    unit.vy = 0;
    return { unit, clipped: false, reason: null };
  }

  if (isTimeStopped(unit.status) || isBanished(unit.status) || isMovementFrozen(unit.status)) {
    unit.vx = 0;
    unit.vy = 0;
    return { unit, clipped: false, reason: null };
  }

  if (isRooted(unit.status)) {
    unit.vx = 0;
    unit.vy = 0;
    return { unit, clipped: false, reason: null };
  }

  // Fear: flee directly away from source at current MS (fear adds no slow)
  if (hasKind(unit.status, "fear")) {
    const src = fearSource(state, unit);
    if (!src) {
      unit.vx = 0;
      unit.vy = 0;
      return { unit, clipped: false, reason: null };
    }
    const n = normalize(unit.x - src.x, unit.y - src.y);
    const ms =
      unit.stats.ms * flankMsMult(unit, state.t, c) * (1 - strongestSlow(unit.status));
    const dx = n.x * ms * c.DT;
    const dy = n.y * ms * c.DT;
    unit.vx = n.x * ms;
    unit.vy = n.y * ms;
    return moveWithSlide(unit, dx, dy, c);
  }

  // Hex: walk to living-ally centroid (or own pad) at MS after slows (35% hex).
  // Skips the Unit Brain. Destination from phase-start poses (L1899).
  if (hasKind(unit.status, "hex")) {
    const poses =
      phaseStart ??
      state.units.map((u) => ({
        id: u.id,
        x: u.x,
        y: u.y,
        alive: u.alive,
        team: u.team,
      }));
    const dest = hexSteerTarget(unit, poses, c);
    const n = normalize(dest.x - unit.x, dest.y - unit.y);
    const ms =
      unit.stats.ms * flankMsMult(unit, state.t, c) * (1 - strongestSlow(unit.status));
    const dx = n.x * ms * c.DT;
    const dy = n.y * ms * c.DT;
    unit.vx = n.x * ms;
    unit.vy = n.y * ms;
    return moveWithSlide(unit, dx, dy, c);
  }

  // Hard-lock in place during an active cast windup (skillshots originate from cast pose).
  if (unit.cast_left > 1e-12 || unit.cast_skill) {
    unit.vx = 0;
    unit.vy = 0;
    return { unit, clipped: false, reason: null };
  }

  if (isMovementLocked(unit)) {
    unit.vx = 0;
    unit.vy = 0;
    return { unit, clipped: false, reason: null };
  }

  const allies = state.units.filter((u) => u.team === unit.team && u.alive);
  allies.sort((a, b) => a.index - b.index);

  const sep = separationSteer(unit, allies, c, fightSpread(state, unit));
  // Idle separation (no waypoint) starts after 1.0 s so early geometry casts
  // (OQ-4/5 at t≈0.8) keep authored poses; L1905 still separates by t=1.9.
  const idleSepOn = state.t >= 1.0 - 1e-12;
  const vel = unit.waypoint
    ? desiredVelocity(unit, c, sep, state.t)
    : idleSepOn
      ? (() => {
          const slow = strongestSlow(unit.status);
          const maxMs =
            unit.stats.ms * flankMsMult(unit, state.t, c) * (1 - slow);
          const speed = hypot(sep.x, sep.y);
          if (speed <= 1e-12) return { x: 0, y: 0 };
          if (speed > maxMs) {
            const s = maxMs / speed;
            return { x: sep.x * s, y: sep.y * s };
          }
          return { x: sep.x, y: sep.y };
        })()
      : { x: 0, y: 0 };
  unit.vx = vel.x;
  unit.vy = vel.y;
  if (!unit.waypoint && vel.x === 0 && vel.y === 0) {
    return { unit, clipped: false, reason: null };
  }

  let nx = unit.x + vel.x * c.DT;
  let ny = unit.y + vel.y * c.DT;

  if (isLeashed(unit.status)) {
    const sid = leashSourceId(unit.status);
    const src = sid ? state.units.find((u) => u.id === sid) : null;
    if (src && src.alive) {
      const d = dist(nx, ny, src.x, src.y);
      if (d > LEASH_RADIUS) {
        const n = normalize(nx - src.x, ny - src.y);
        nx = src.x + n.x * LEASH_RADIUS;
        ny = src.y + n.y * LEASH_RADIUS;
      }
    }
  }

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
  if (isRooted(unit.status)) return { unit, clipped: false, reason: null };
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
  void c;
}
