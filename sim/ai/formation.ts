/**
 * exp/teamfight-dynamics formation (not build spec). Reshapes a fight waypoint:
 * the backline does not walk past its front line, divers swing wide to flank.
 * Off unless MatchConfig.teamfight.formation.
 */
import { CHAMPIONS } from "../../data/champions/defs.js";
import type { MatchState, UnitState } from "../types.js";
import { isDiver, isFrontline } from "./target.js";

/** Backliners stay this far (tiles) behind their front line. */
const BACK_GAP = 1.5;
/** Front-liners farther than this (tiles) from the backliner are ignored. */
const FRONT_NEAR = 8;
/** Divers flank when the target is farther than this (tiles). */
const FLANK_FROM = 4;
/** Flank lane offset (tiles) from the target's row. */
const FLANK_Y = 3;

const FIGHT_INTENTS = new Set(["Chase", "Approach", "Engage"]);

function isBackliner(u: UnitState): boolean {
  const c = CHAMPIONS[u.champ]?.class ?? "Fighter";
  return (c === "Marksman" || c === "Mage" || c === "Enchanter") && !isDiver(u);
}

export function shapeFormation(
  state: MatchState,
  u: UnitState,
  intent: string,
  waypoint: { x: number; y: number } | null,
): { x: number; y: number } | null {
  if (!state.config?.teamfight?.formation || !waypoint || !FIGHT_INTENTS.has(intent)) return waypoint;
  const dir = u.team === "blue" ? 1 : -1;
  if (isBackliner(u)) {
    // Only front-liners actually with this backliner count (a respawned tank at
    // base must not drag the carry home).
    const front = state.units.filter(
      (a) => a.alive && a.team === u.team && isFrontline(a) && Math.hypot(a.x - u.x, a.y - u.y) <= FRONT_NEAR,
    );
    if (front.length === 0) return waypoint;
    // Lead body = the front-liner furthest toward the enemy.
    let lead = front[0]!.x;
    for (const a of front) if (a.x * dir > lead * dir) lead = a.x;
    // Hold in place at worst; formation never walks a backliner backward.
    let cap = lead - dir * BACK_GAP;
    if (cap * dir < u.x * dir) cap = u.x;
    if (waypoint.x * dir > cap * dir) return { x: cap, y: waypoint.y };
    return waypoint;
  }
  if (isDiver(u)) {
    const dx = waypoint.x - u.x;
    const dy = waypoint.y - u.y;
    if (Math.sqrt(dx * dx + dy * dy) <= FLANK_FROM) return waypoint;
    const side = u.y >= waypoint.y ? 1 : -1;
    const y = Math.min(15, Math.max(1, waypoint.y + side * FLANK_Y));
    return { x: waypoint.x, y };
  }
  return waypoint;
}
