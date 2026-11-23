/**
 * §9.2 Arena planner — out-of-fight objectives for Hold / Hunt / Starve.
 * Fight Call and auto-peel override these in the Unit Brain.
 */
import { CHAMPIONS, type ChampClass } from "../../data/champions/defs.js";
import type { Constants } from "../constants.js";
import { inOwnSanctuary } from "../map.js";
import { isBanished } from "../status.js";
import type { MatchState, Team, UnitId, UnitState } from "../types.js";

export type TacticPreset = "hold_the_pit" | "hunt" | "starve";

/** S2 harness parks unused pads with auto_next_start_t ≥ 900. */
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

/**
 * Hold the Pit: ≥2 bodies (Tank → Fighter → highest HP) walk to the zone;
 * Marksmen / Enchanters hold the rim toward their own side.
 */
function holdZoneWaypoint(u: UnitState, state: MatchState, c: Constants): { x: number; y: number } {
  const cx = c.ZONE_CENTER[0]!;
  const cy = c.ZONE_CENTER[1]!;
  const cls = champClass(u);
  const rim = cls === "Marksman" || cls === "Enchanter";
  if (rim) {
    // Rim on the friendly side of the zone so both teams can meet.
    const side = u.team === "blue" ? -1 : 1;
    return { x: cx + side * (c.ZONE_RADIUS + 0.5), y: cy };
  }
  const allies = livingAllies(state, u.team);
  const ranked = allies.slice().sort((a, b) => {
    const pa = CLASS_HOLD_PRI[champClass(a)] ?? 9;
    const pb = CLASS_HOLD_PRI[champClass(b)] ?? 9;
    if (pa !== pb) return pa - pb;
    if (b.hp !== a.hp) return b.hp - a.hp;
    return a.index - b.index;
  });
  const holders = new Set(ranked.slice(0, Math.max(2, ranked.length)).map((x) => x.id));
  // Frontliners and anyone in the top holders walk to the centre; leftovers to rim.
  if (holders.has(u.id) || cls === "Tank" || cls === "Fighter") {
    return { x: cx, y: cy };
  }
  const side = u.team === "blue" ? -1 : 1;
  return { x: cx + side * (c.ZONE_RADIUS + 0.5), y: cy };
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
  const ownSide = u.team === "blue" ? (p: readonly [number, number]) => p[0]! < 12 : (p: readonly [number, number]) => p[0]! > 12;
  const ranked = ORB_PADS.slice().sort((a, b) => {
    const oa = ownSide(a) ? 0 : 1;
    const ob = ownSide(b) ? 0 : 1;
    if (oa !== ob) return oa - ob;
    return dist(u.x, u.y, a[0]!, a[1]!) - dist(u.x, u.y, b[0]!, b[1]!);
  });
  const pad = ranked[0]!;
  // Before first orb wave, still walk toward a pad (and meet mid for contests).
  if (state.t + 1e-9 < c.ORB_FIRST_SPAWN_S) {
    const cx = c.ZONE_CENTER[0]!;
    const cy = c.ZONE_CENTER[1]!;
    const side = u.team === "blue" ? -1 : 1;
    return { x: cx + side * (c.ZONE_RADIUS + 0.2), y: cy };
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

/** True when the unit is close enough to its planner waypoint to stop pushing. */
export function atPlannerWaypoint(u: UnitState, wp: { x: number; y: number }, arriveR = 0.4): boolean {
  return dist(u.x, u.y, wp.x, wp.y) <= arriveR + 1e-9;
}

export type { UnitId };
