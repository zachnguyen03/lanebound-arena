/**
 * §9.2 Arena planner — out-of-fight objectives for Hold / Hunt / Starve.
 * Fight Call and auto-peel override these in the Unit Brain.
 *
 * Lab convention (not a build-spec line): `isLabParked` treats
 * `auto_next_start_t ≥ 900` as a harness-parked unused pad.
 */
import { CHAMPIONS, type ChampClass } from "../../data/champions/defs.js";
import type { Constants } from "../constants.js";
import { inOwnSanctuary } from "../map.js";
import { isBanished } from "../status.js";
import type { MatchState, Team, UnitId, UnitState } from "../types.js";

export type TacticPreset = "hold_the_pit" | "hunt" | "starve";

/**
 * Lab harness convention: unused pads are parked with `auto_next_start_t ≥ 900`
 * so fixtures stay quiet. Not a build-spec constant.
 */
export function isLabParked(u: UnitState): boolean {
  return u.auto_next_start_t >= 900 - 1e-9;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function champClass(u: UnitState): ChampClass {
  return CHAMPIONS[u.champ]?.class ?? "Fighter";
}

const CLASS_HOLD_PRI: Record<ChampClass, number> = {
  Tank: 0,
  Fighter: 1,
  Assassin: 2,
  Mage: 3,
  Marksman: 4,
  Enchanter: 5,
};

/** Orb pad tile centres (§5.7) — same order as S3 arena. */
const ORB_PADS: ReadonlyArray<readonly [number, number]> = [
  [2.5, 4.5],
  [2.5, 11.5],
  [21.5, 4.5],
  [21.5, 11.5],
  [8.5, 1.5],
  [15.5, 1.5],
  [8.5, 14.5],
  [15.5, 14.5],
];

function livingAllies(state: MatchState, team: Team): UnitState[] {
  return state.units.filter(
    (u) => u.alive && u.team === team && !isBanished(u.status) && !isLabParked(u),
  );
}

/** Friendly-side rim of the zone (Hold backliners / Starve pre-orb). */
function zoneRim(u: UnitState, c: Constants, outset = 0.5): { x: number; y: number } {
  const cx = c.ZONE_CENTER[0]!;
  const cy = c.ZONE_CENTER[1]!;
  const side = u.team === "blue" ? -1 : 1;
  return { x: cx + side * (c.ZONE_RADIUS + outset), y: cy };
}

/**
 * Hold the Pit: ≥2 bodies (Tank → Fighter → highest HP) walk to the zone;
 * Marksmen / Enchanters hold the rim toward their own side.
 */
function holdZoneWaypoint(u: UnitState, state: MatchState, c: Constants): { x: number; y: number } {
  const cx = c.ZONE_CENTER[0]!;
  const cy = c.ZONE_CENTER[1]!;
  const cls = champClass(u);
  if (cls === "Marksman" || cls === "Enchanter") {
    return zoneRim(u, c, 0.5);
  }
  const allies = livingAllies(state, u.team);
  const ranked = allies.slice().sort((a, b) => {
    const pa = CLASS_HOLD_PRI[champClass(a)] ?? 9;
    const pb = CLASS_HOLD_PRI[champClass(b)] ?? 9;
    if (pa !== pb) return pa - pb;
    if (b.hp !== a.hp) return b.hp - a.hp;
    return a.index - b.index;
  });
  // Top two priority bodies occupy the centre (§9.2 "at least two").
  const holders = new Set(ranked.slice(0, 2).map((x) => x.id));
  if (holders.has(u.id) || cls === "Tank" || cls === "Fighter") {
    return { x: cx, y: cy };
  }
  return zoneRim(u, c, 0.5);
}

/** Hunt: walk toward the nearest living non-sanctuary enemy (else enemy pad). */
function huntWaypoint(u: UnitState, state: MatchState, c: Constants): { x: number; y: number } {
  let best: UnitState | null = null;
  let bestD = Infinity;
  for (const e of state.units) {
    if (!e.alive || e.team === u.team || isBanished(e.status)) continue;
    if (inOwnSanctuary(e.team, e.x, e.y, c)) continue;
    const d = dist(u.x, u.y, e.x, e.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (best) return { x: best.x, y: best.y };
  const pad = u.team === "blue" ? c.RED_SPAWN : c.BLUE_SPAWN;
  return { x: pad[0]!, y: pad[1]! };
}

/** Starve: nearest orb pad (own side first), else a light zone contest on the rim. */
function starveWaypoint(u: UnitState, state: MatchState, c: Constants): { x: number; y: number } {
  const ownSide =
    u.team === "blue"
      ? (p: readonly [number, number]) => p[0]! < 12
      : (p: readonly [number, number]) => p[0]! > 12;
  const ranked = ORB_PADS.slice().sort((a, b) => {
    const oa = ownSide(a) ? 0 : 1;
    const ob = ownSide(b) ? 0 : 1;
    if (oa !== ob) return oa - ob;
    return dist(u.x, u.y, a[0]!, a[1]!) - dist(u.x, u.y, b[0]!, b[1]!);
  });
  const pad = ranked[0]!;
  // Before first orb wave, still walk toward a pad (and meet mid for contests).
  if (state.t + 1e-9 < c.ORB_FIRST_SPAWN_S) {
    return zoneRim(u, c, 0.2);
  }
  return { x: pad[0]!, y: pad[1]! };
}

export interface PlannerPlan {
  intent: "HoldZone" | "Approach" | "CollectOrb";
  waypoint: { x: number; y: number };
}

/**
 * Out-of-fight plan for a living, non-parked unit (§9.2).
 * Returns null only if the unit should truly idle (should not happen for live presets).
 */
export function planObjective(
  state: MatchState,
  u: UnitState,
  tactic: TacticPreset,
  c: Constants,
): PlannerPlan | null {
  if (!u.alive || isLabParked(u)) return null;
  if (tactic === "hold_the_pit") {
    return { intent: "HoldZone", waypoint: holdZoneWaypoint(u, state, c) };
  }
  if (tactic === "hunt") {
    return { intent: "Approach", waypoint: huntWaypoint(u, state, c) };
  }
  // starve
  const wp = starveWaypoint(u, state, c);
  const towardOrb = ORB_PADS.some((p) => Math.abs(p[0]! - wp.x) < 1e-9 && Math.abs(p[1]! - wp.y) < 1e-9);
  return {
    intent: towardOrb ? "CollectOrb" : "HoldZone",
    waypoint: wp,
  };
}

/**
 * Arrival test with exit hysteresis so HoldZone ↔ Idle does not flicker every
 * tick when the motor overshoots the arrive radius. `u.ai_at_planner_wp` is
 * maintained by the Unit Brain.
 */
export function atPlannerWaypoint(
  u: UnitState,
  wp: { x: number; y: number },
  arriveR = 0.4,
  leaveR = 1.0,
): boolean {
  const d = dist(u.x, u.y, wp.x, wp.y);
  if (u.ai_at_planner_wp) return d <= leaveR + 1e-9;
  return d <= arriveR + 1e-9;
}

export type { UnitId };
