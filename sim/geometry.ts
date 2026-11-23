/**
 * Deterministic shape / range geometry (spec §6.8, OQ-4/5/6).
 * Allowed Math: + - * / sqrt floor ceil … — no sin/cos/atan2.
 * Cone half-angle cosines are hardcoded IEEE literals (not Math.cos).
 */
import type { Constants } from "./constants.js";
import { hitsPillar, inOwnSanctuary } from "./map.js";
import { dist, hypot, normalize } from "./math.js";
import type { UnitState } from "./types.js";

/** cos(halfAngle) for authored full angles 60° / 70° / 80° (half = 30 / 35 / 40). */
export const COS_HALF_ANGLE: Record<number, number> = {
  60: 0.8660254037844386, // cos(30°)
  70: 0.8191520442889918, // cos(35°)
  80: 0.766044443118978, // cos(40°)
};

/** sin(halfAngle) — hardcoded IEEE literals (no Math.sin). */
export const SIN_HALF_ANGLE: Record<number, number> = {
  60: 0.5, // sin(30°)
  70: 0.5735764363510461, // sin(35°)
  80: 0.6427876096865393, // sin(40°)
};

function nearestAngleKey(angleDeg: number): number {
  const keys = Object.keys(COS_HALF_ANGLE).map(Number);
  let best = keys[0]!;
  let bestD = Math.abs(best - angleDeg);
  for (const k of keys) {
    const d = Math.abs(k - angleDeg);
    if (d < bestD) {
      best = k;
      bestD = d;
    }
  }
  return best;
}

export function cosHalfForAngle(angleDeg: number): number {
  return COS_HALF_ANGLE[angleDeg] ?? COS_HALF_ANGLE[nearestAngleKey(angleDeg)]!;
}

export function sinHalfForAngle(angleDeg: number): number {
  return SIN_HALF_ANGLE[angleDeg] ?? SIN_HALF_ANGLE[nearestAngleKey(angleDeg)]!;
}

/** Distance from point P to segment AB. */
export function distPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 <= 1e-18) return hypot(apx, apy);
  let t = (apx * abx + apy * aby) / ab2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const qx = ax + abx * t;
  const qy = ay + aby * t;
  return hypot(px - qx, py - qy);
}

export function circleHitsUnit(
  cx: number,
  cy: number,
  radius: number,
  unit: { x: number; y: number },
  bodyR: number,
): boolean {
  return dist(cx, cy, unit.x, unit.y) <= radius + bodyR;
}

/**
 * Line capsule: segment of length L along aimDir from caster; hit if
 * dist(unit centre, segment) <= width/2 + BODY_RADIUS (OQ-5).
 */
export function lineHitsUnit(
  caster: { x: number; y: number },
  aimNx: number,
  aimNy: number,
  length: number,
  width: number,
  unit: { x: number; y: number },
  bodyR: number,
): boolean {
  const bx = caster.x + aimNx * length;
  const by = caster.y + aimNy * length;
  const d = distPointToSegment(unit.x, unit.y, caster.x, caster.y, bx, by);
  // Inclusive threshold (OQ-5): exactly width/2 + BODY_RADIUS hits.
  return d <= width / 2 + bodyR + 1e-12;
}

/**
 * Cone sector: full angle_deg (± half). Hit if body circle (r=bodyR) intersects
 * the sector within range (OQ-4). Angular slack = asin(bodyR/d) via cos(a+b).
 */
export function coneHitsUnit(
  caster: { x: number; y: number },
  aimNx: number,
  aimNy: number,
  range: number,
  angleDeg: number,
  unit: { x: number; y: number },
  bodyR: number,
): boolean {
  const dx = unit.x - caster.x;
  const dy = unit.y - caster.y;
  const d = hypot(dx, dy);
  if (d > range + bodyR) return false;
  if (d <= bodyR) return true; // overlapping caster
  const n = normalize(dx, dy);
  const forward = n.x * aimNx + n.y * aimNy;
  const cosHalf = cosHalfForAngle(angleDeg);
  // cos(half + asin(bodyR/d)) = cosHalf*cosSlack - sinHalf*sinSlack
  const rd = Math.min(1, bodyR / d);
  const cosSlack = Math.sqrt(Math.max(0, 1 - rd * rd));
  const sinSlack = rd;
  const sinHalf = Math.sqrt(Math.max(0, 1 - cosHalf * cosHalf));
  const cosCombined = cosHalf * cosSlack - sinHalf * sinSlack;
  return forward >= cosCombined - 1e-12;
}

/** Clamp aim point to max range along the aim line from caster (OQ-6). */
export function clampAimToRange(
  casterX: number,
  casterY: number,
  aimX: number,
  aimY: number,
  range: number,
): { x: number; y: number } {
  const n = normalize(aimX - casterX, aimY - casterY);
  if (n.len <= 1e-12) return { x: casterX, y: casterY };
  const d = Math.min(n.len, range);
  return { x: casterX + n.x * d, y: casterY + n.y * d };
}

/** Truncate line length at the first pillar face along the aim ray. */
export function lineLengthUntilPillar(
  casterX: number,
  casterY: number,
  aimNx: number,
  aimNy: number,
  length: number,
  c: Constants,
): number {
  const step = 0.05;
  const n = Math.max(1, Math.ceil(length / step));
  for (let i = 1; i <= n; i++) {
    const t = (i / n) * length;
    const x = casterX + aimNx * t;
    const y = casterY + aimNy * t;
    if (hitsPillar(x, y, c)) {
      return Math.max(0, ((i - 1) / n) * length);
    }
  }
  return length;
}

function alongLine(caster: { x: number; y: number }, aimNx: number, aimNy: number, u: UnitState): number {
  return (u.x - caster.x) * aimNx + (u.y - caster.y) * aimNy;
}

export function unitsInLine(
  stateUnits: UnitState[],
  caster: UnitState,
  aimNx: number,
  aimNy: number,
  length: number,
  width: number,
  bodyR: number,
  opts: {
    pierce: "all" | "first";
    enemiesOnly?: boolean;
    includeAllies?: boolean;
    skipCaster?: boolean;
    c?: Constants;
  },
): UnitState[] {
  let L = length;
  if (opts.c) {
    L = lineLengthUntilPillar(caster.x, caster.y, aimNx, aimNy, length, opts.c);
  }
  const hits: UnitState[] = [];
  for (const u of stateUnits) {
    if (!u.alive) continue;
    if (opts.skipCaster !== false && u.id === caster.id) continue;
    if (opts.enemiesOnly && u.team === caster.team) continue;
    if (!opts.includeAllies && !opts.enemiesOnly && u.team === caster.team) continue;
    if (opts.includeAllies && u.id === caster.id) continue;
    if (opts.c && caster.team !== u.team && inOwnSanctuary(u.team, u.x, u.y, opts.c)) continue;
    if (!lineHitsUnit(caster, aimNx, aimNy, L, width, u, bodyR)) continue;
    hits.push(u);
  }
  hits.sort((a, b) => alongLine(caster, aimNx, aimNy, a) - alongLine(caster, aimNx, aimNy, b));
  if (opts.pierce === "first") {
    const firstEnemy = hits.find((u) => u.team !== caster.team);
    return firstEnemy ? [firstEnemy] : [];
  }
  return hits;
}

export function unitsInCircle(
  stateUnits: UnitState[],
  cx: number,
  cy: number,
  radius: number,
  bodyR: number,
  pred: (u: UnitState) => boolean,
  c?: Constants,
  casterTeam?: UnitState["team"],
): UnitState[] {
  const out: UnitState[] = [];
  for (const u of stateUnits) {
    if (!u.alive) continue;
    if (!pred(u)) continue;
    if (c && casterTeam && casterTeam !== u.team && inOwnSanctuary(u.team, u.x, u.y, c)) continue;
    if (!circleHitsUnit(cx, cy, radius, u, bodyR)) continue;
    out.push(u);
  }
  return out;
}

export function unitsInCone(
  stateUnits: UnitState[],
  caster: UnitState,
  aimNx: number,
  aimNy: number,
  range: number,
  angleDeg: number,
  bodyR: number,
  pred: (u: UnitState) => boolean,
  c?: Constants,
): UnitState[] {
  const out: UnitState[] = [];
  for (const u of stateUnits) {
    if (!u.alive) continue;
    if (!pred(u)) continue;
    if (c && caster.team !== u.team && inOwnSanctuary(u.team, u.x, u.y, c)) continue;
    if (!coneHitsUnit(caster, aimNx, aimNy, range, angleDeg, u, bodyR)) continue;
    out.push(u);
  }
  return out;
}
