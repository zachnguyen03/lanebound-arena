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
import { pitOpensIn } from "../objectives.js";
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

// ---------------------------------------------------------------------------
// Experimental cadence rovers (exp/orb-buff-cadence; not in the build spec).
// Jungle + support leave the pit for orbs and buffs; the carry takes its
// own-side buff. Off unless MatchConfig.cadence.rovers.
// ---------------------------------------------------------------------------

/** Walk to a buff pad this many seconds before it spawns (setup). */
const BUFF_SETUP_S = 8;
/** Rovers ignore pads farther than this (tiles). */
const ROVE_MAX_D = 16;
/** Carry only takes a buff this close (tiles). */
const CARRY_BUFF_D = 7;
/** A rover hunts an enemy this close when not outnumbered around it (tiles). */
const ROVE_SEEK_R = 7;

interface PadPick {
  key: string;
  x: number;
  y: number;
  buff: boolean;
}

function onOwnSide(team: Team, x: number): boolean {
  return team === "blue" ? x < 12 : x > 12;
}

function buffReady(state: MatchState, b: { up: boolean; respawn_at?: number }): boolean {
  return b.up || (b.respawn_at !== undefined && b.respawn_at - state.t <= BUFF_SETUP_S + 1e-9);
}

/** Carry's own-side buff, if ready and close. */
function carryBuff(state: MatchState, u: UnitState): PadPick | null {
  for (const b of state.buffs ?? []) {
    if (!buffReady(state, b) || !onOwnSide(u.team, b.x)) continue;
    if (dist(u.x, u.y, b.x, b.y) > CARRY_BUFF_D + 1e-9) continue;
    return { key: b.buff_id, x: b.x, y: b.y, buff: true };
  }
  return null;
}

function bestRoverPad(state: MatchState, u: UnitState, taken: ReadonlySet<string>): PadPick | null {
  const enemies = state.units.filter((e) => e.alive && e.team !== u.team && !isBanished(e.status));
  const contested = (x: number, y: number) => enemies.some((e) => dist(e.x, e.y, x, y) <= 5);
  let best: PadPick | null = null;
  let bestScore = -Infinity;
  const consider = (key: string, x: number, y: number, buff: boolean, value: number) => {
    if (taken.has(key)) return;
    const d = dist(u.x, u.y, x, y);
    if (d > ROVE_MAX_D + 1e-9) return;
    const own = onOwnSide(u.team, x);
    // Role split: the jungle invades enemy-side pads; the support guards its own
    // side and is pulled hard to a pad an enemy is contesting (counter-rotate).
    const side = u.slot === "jungle" ? (own ? 0 : 3) : own ? (contested(x, y) ? 6 : 0) : -8;
    const score = value * 2 - d + side;
    if (score > bestScore + 1e-9) {
      bestScore = score;
      best = { key, x, y, buff };
    }
  };
  for (const b of state.buffs ?? []) if (buffReady(state, b)) consider(b.buff_id, b.x, b.y, true, 10);
  for (const o of state.orbs ?? []) if (o.up) consider(o.orb_id, o.x, o.y, false, 4);
  return best;
}

/**
 * Rover skirmish target: nearest enemy within ROVE_SEEK_R when this rover's side
 * is not outnumbered inside that radius. Null when cadence rovers are off.
 */
export function roverPrey(state: MatchState, u: UnitState): UnitState | null {
  if (!state.config?.cadence?.rovers) return null;
  if (u.slot !== "jungle" && u.slot !== "support") return null;
  const local = (team: Team) =>
    state.units.filter(
      (x) => x.alive && x.team === team && !isBanished(x.status) && dist(u.x, u.y, x.x, x.y) <= ROVE_SEEK_R + 1e-9,
    );
  const foes = local(u.team === "blue" ? "red" : "blue");
  if (foes.length === 0 || local(u.team).length < foes.length) return null;
  return foes.slice().sort((a, b) => dist(u.x, u.y, a.x, a.y) - dist(u.x, u.y, b.x, b.y) || a.index - b.index)[0]!;
}

/**
 * A rover more than ROVE_DETACH_R from every top/mid/adc ally is on its own
 * map: the pit group's disengage call does not recall it (it makes local calls).
 */
const ROVE_DETACH_R = 6;
export function roverDetached(state: MatchState, u: UnitState): boolean {
  if (!state.config?.cadence?.rovers) return false;
  if (u.slot !== "jungle" && u.slot !== "support") return false;
  return !state.units.some(
    (a) =>
      a.alive &&
      a.team === u.team &&
      (a.slot === "top" || a.slot === "mid" || a.slot === "adc") &&
      dist(u.x, u.y, a.x, a.y) <= ROVE_DETACH_R + 1e-9,
  );
}

/** Locally outnumbered inside ROVE_SEEK_R. */
export function roverOutnumbered(state: MatchState, u: UnitState): boolean {
  const count = (team: Team) =>
    state.units.filter(
      (x) => x.alive && x.team === team && !isBanished(x.status) && dist(u.x, u.y, x.x, x.y) <= ROVE_SEEK_R + 1e-9,
    ).length;
  return count(u.team === "blue" ? "red" : "blue") > count(u.team);
}

function roverPlan(state: MatchState, u: UnitState, _c: Constants): PlannerPlan | null {
  const allies = livingAllies(state, u.team);
  const enemiesAlive = state.units.filter((e) => e.alive && e.team !== u.team).length;
  // Never leave the group when outnumbered.
  if (allies.length < enemiesAlive) return null;
  const byslot = (slot: string) => allies.find((a) => a.slot === slot) ?? null;
  const carry = byslot("adc");
  const carryPick = carry ? carryBuff(state, carry) : null;
  if (u.slot === "adc") {
    return carryPick ? { intent: "TakeBuff", waypoint: { x: carryPick.x, y: carryPick.y } } : null;
  }
  if (u.slot !== "jungle" && u.slot !== "support") return null;
  // Skirmish: hunt a nearby enemy when not outnumbered locally (Dota rune fights).
  const prey = roverPrey(state, u);
  if (prey) return { intent: "Approach", waypoint: { x: prey.x, y: prey.y } };
  const taken = new Set<string>(carryPick ? [carryPick.key] : []);
  // Jungle picks first; support takes the next-best pad (stable order, no RNG).
  const jungle = byslot("jungle");
  if (u.slot === "support" && jungle) {
    const jp = bestRoverPad(state, jungle, taken);
    if (jp) taken.add(jp.key);
  }
  const pick = bestRoverPad(state, u, taken);
  if (!pick) return null;
  return { intent: pick.buff ? "TakeBuff" : "CollectOrb", waypoint: { x: pick.x, y: pick.y } };
}

// ---------------------------------------------------------------------------
// exp/objectives (not build spec): slot → point assignment. Off unless
// MatchConfig.objectives. null = fall through to the tactic's normal plan.
// ---------------------------------------------------------------------------

type PointId = "north" | "centre" | "south";

/** Per tactic, slot → home point. Missing slot = normal tactic plan (Hunt's chasers). */
const POINT_HOME: Record<TacticPreset, Partial<Record<string, PointId>>> = {
  hold_the_pit: { top: "north", jungle: "centre", mid: "centre", adc: "centre", support: "south" },
  hunt: { top: "north", support: "south" },
  starve: { top: "north", jungle: "north", mid: "centre", adc: "south", support: "south" },
};
/** Pulse: shrines only (no centre point); the pit reopens and pulls everyone back. */
const SHRINE_HOME: Record<TacticPreset, Partial<Record<string, PointId>>> = {
  hold_the_pit: { top: "north", jungle: "north", mid: "south", adc: "south", support: "south" },
  hunt: { top: "north", support: "south" },
  starve: { top: "north", jungle: "north", mid: "south", adc: "south", support: "south" },
};
/** Regroup on the pit this long before it reopens. */
const PULSE_REGROUP_S = 6;

/**
 * Side duty: this unit's plan is a north / south point. It skips the main
 * fight and only fights what it meets locally (brain.ts).
 */
export function sideDutyPlan(state: MatchState, u: UnitState, tactic: TacticPreset): PlannerPlan | null {
  return objectivePlan(state, u, tactic, true);
}

function objectivePlan(state: MatchState, u: UnitState, tactic: TacticPreset, sideOnly = false): PlannerPlan | null {
  const mode = state.config?.objectives?.mode;
  const pts = state.objectives;
  if (!mode || !pts || !u.slot) return null;
  let live = pts;
  let home: PointId | undefined;
  if (mode === "pulse") {
    const opensIn = pitOpensIn(state.t);
    if (opensIn <= PULSE_REGROUP_S + 1e-9) return null;
    live = pts.filter((p) => !p.paid);
    home = SHRINE_HOME[tactic][u.slot];
  } else {
    home = POINT_HOME[tactic][u.slot];
  }
  if (!home || live.length === 0) return null;
  let p = live.find((x) => x.id === home);
  // Home point held (points) or already paid (pulse): take the nearest point we do not own.
  if (!p || (mode === "points" && p.owner === u.team && !enemyNear(state, u, p, 6))) {
    const open = live
      .filter((x) => x.owner !== u.team)
      .sort((a, b) => dist(u.x, u.y, a.x, a.y) - dist(u.x, u.y, b.x, b.y));
    p = open[0] ?? p;
  }
  if (!p) return null;
  if (sideOnly && p.id === "centre") return null;
  // Side points sit between the corner pillars: from the flank, walk in via a
  // staging spot inside the pillar line so the straight walk does not snag.
  if (Math.abs(p.y - 8) > 3 && Math.abs(u.x - p.x) > 3.5 && Math.abs(u.y - p.y) > 1.5) {
    return { intent: "HoldZone", waypoint: { x: p.x + Math.sign(u.x - p.x) * 3, y: p.y < 8 ? 5 : 11 } };
  }
  return { intent: "HoldZone", waypoint: { x: p.x, y: p.y } };
}

function enemyNear(state: MatchState, u: UnitState, p: { x: number; y: number }, r: number): boolean {
  return state.units.some((e) => e.alive && e.team !== u.team && dist(e.x, e.y, p.x, p.y) <= r + 1e-9);
}

export interface PlannerPlan {
  intent: "HoldZone" | "Approach" | "CollectOrb" | "TakeBuff";
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
  if (state.config?.objectives) {
    const obj = objectivePlan(state, u, tactic);
    if (obj) return obj;
  }
  if (state.config?.cadence?.rovers && tactic !== "hunt") {
    const rove = roverPlan(state, u, c);
    if (rove) return rove;
  }
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
