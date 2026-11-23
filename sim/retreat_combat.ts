/**
 * S2-R4-5 (Appendix R #4 L1974): combat legality while following a disengage
 * Retreat/Regroup. Shared by autos and casts so freestyle targeting cannot bypass.
 */
import { KITS, type AbilityDef } from "../data/champions/kits.js";
import type { Constants } from "./constants.js";
import { inOwnSanctuary } from "./map.js";
import { isLeashed, isRooted } from "./status.js";
import type { MatchState, ScriptedCast, UnitId, UnitState } from "./types.js";

const PEEL_CC_KINDS = new Set([
  "stun",
  "fear",
  "root",
  "slow",
  "knockback",
  "pull",
  "pull-away",
]);

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function abilityOf(champ: string, skill: "Q" | "W" | "R"): AbilityDef | null {
  const kit = KITS[champ];
  if (!kit) return null;
  return kit[skill] ?? null;
}

/**
 * Exception (S2-R4-5): rooted, leashed, or already at own sanctuary pad with no
 * path left — may auto/cast normally.
 */
export function retreatImmobile(u: UnitState, c: Constants): boolean {
  if (isRooted(u.status) || isLeashed(u.status)) return true;
  if (!inOwnSanctuary(u.team, u.x, u.y, c)) return false;
  const pad = u.team === "blue" ? c.BLUE_SPAWN : c.RED_SPAWN;
  // Arrived: at/near pad centre, or Retreat waypoint cleared because path is done.
  const atPad = dist(u.x, u.y, pad[0]!, pad[1]!) <= 0.35;
  if (atPad) return true;
  if (
    u.waypoint &&
    dist(u.waypoint.x, u.waypoint.y, pad[0]!, pad[1]!) <= 0.35 &&
    dist(u.x, u.y, u.waypoint.x, u.waypoint.y) <= 0.35
  ) {
    return true;
  }
  return false;
}

/** True when a mobile Retreat/Regroup window still blocks offensive combat. */
export function retreatSuppressesCombat(u: UnitState, state: MatchState, c: Constants): boolean {
  if (u.ai_retreat_suppress_until <= state.t + 1e-9) return false;
  if (retreatImmobile(u, c)) return false;
  return true;
}

function hasDefensiveSupport(ab: AbilityDef): boolean {
  return !!ab.heal || !!ab.shield || !!ab.dispel;
}

function isDashOrBlink(ab: AbilityDef): boolean {
  return ab.shape === "self_dash" || (ab.dash_tiles ?? 0) > 0;
}

function hasPeelCc(ab: AbilityDef): boolean {
  if ((ab.knockback ?? 0) > 0 || (ab.pull ?? 0) > 0) return true;
  if (ab.slow) return true;
  return (ab.cc ?? []).some((cc) => PEEL_CC_KINDS.has(cc.kind));
}

function nearestThreat(u: UnitState, state: MatchState): UnitState | null {
  let best: UnitState | null = null;
  let bestD = Infinity;
  for (const e of state.units) {
    if (!e.alive || e.team === u.team) continue;
    const d = dist(u.x, u.y, e.x, e.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Dash/blink aim is away from the nearest living enemy. */
function dashAwayFromThreat(
  u: UnitState,
  cast: ScriptedCast,
  state: MatchState,
): boolean {
  const threat = nearestThreat(u, state);
  if (!threat) return true;
  const aimX = cast.aim_x ?? u.x;
  const aimY = cast.aim_y ?? u.y;
  // Displacement vector from caster toward aim (or self_dash with no aim → treat as away if no aim set).
  const mx = aimX - u.x;
  const my = aimY - u.y;
  if (Math.abs(mx) + Math.abs(my) < 1e-9) {
    // No aim: kits resolve self_dash opposite the threat in the cast interpreter — allow.
    return true;
  }
  const tx = threat.x - u.x;
  const ty = threat.y - u.y;
  // Away ⟺ aim has non-positive dot with vector-to-threat.
  return mx * tx + my * ty <= 1e-9;
}

function peelCcTargetOk(
  u: UnitState,
  cast: ScriptedCast,
  state: MatchState,
): boolean {
  if (!cast.target_id) return false;
  const foe = state.units.find((x) => x.id === cast.target_id);
  if (!foe || !foe.alive || foe.team === u.team) return false;
  if (dist(u.x, u.y, foe.x, foe.y) > 4 + 1e-9) return false;
  const intent = foe.intent;
  if (intent !== "Chase" && intent !== "Engage") return false;
  const tgt = foe.ai_target_id;
  if (!tgt) return false;
  const ally = state.units.find((x) => x.id === tgt);
  return !!ally && ally.alive && ally.team === u.team;
}

/**
 * S2-R4-5 allowed casts while a mobile unit is in the retreat suppress window:
 * self/ally heals, shields, dispels; dashes/blinks away from nearest threat;
 * peel CC on an enemy Chase/Engage-ing an ally within 4 tiles.
 */
export function retreatCastAllowed(
  u: UnitState,
  skill: "Q" | "W" | "R",
  cast: ScriptedCast,
  state: MatchState,
  c: Constants,
): boolean {
  void c;
  if (!retreatSuppressesCombat(u, state, c)) return true;
  const ab = abilityOf(u.champ, skill);
  if (!ab) return false;
  if (hasDefensiveSupport(ab)) return true;
  if (isDashOrBlink(ab) && dashAwayFromThreat(u, cast, state)) return true;
  if (hasPeelCc(ab) && peelCcTargetOk(u, cast, state)) return true;
  return false;
}

/** Cancel unapplied windup on the first retreat step (unless it applies this tick). */
export function cancelRetreatWindupIfMoving(
  u: UnitState,
  moved: boolean,
  state: MatchState,
  c: Constants,
): void {
  if (!moved) return;
  if (!retreatSuppressesCombat(u, state, c)) return;
  if (u.auto_windup_left <= c.DT + 1e-12) return; // applies on this tick — keep
  u.auto_windup_left = 0;
  u.auto_windup_target = null;
}

export type { UnitId };
