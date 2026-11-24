/**
 * exp/teamfight-r3 levers (not build spec). Each is off unless its
 * MatchConfig.teamfight flag is set; see lab/teamfight3/REPORT.md.
 */
import { KITS } from "../../data/champions/kits.js";
import { isLocked } from "../status.js";
import type { MatchState, UnitState } from "../types.js";
import type { CastProposal } from "./cast_policy.js";

type Pt = { x: number; y: number };

const d2 = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function clampArena(p: Pt): Pt {
  return { x: Math.min(23.5, Math.max(0.5, p.x)), y: Math.min(14.5, Math.max(0.5, p.y)) };
}

/** `p` pushed from `from` until it is `r` tiles away (straight out). */
function awayTo(p: Pt, from: Pt, r: number): Pt {
  const len = d2(p, from) || 1;
  return clampArena({ x: from.x + ((p.x - from.x) / len) * r, y: from.y + ((p.y - from.y) / len) * r });
}

const enemiesOf = (state: MatchState, u: UnitState) =>
  state.units.filter((e) => e.alive && e.team !== u.team);

/** `dodge`: an enemy ground-area cast winding up on us → step outside its radius. */
export function dodgeWaypoint(state: MatchState, u: UnitState): Pt | null {
  if (!state.config?.teamfight?.dodge) return null;
  for (const e of enemiesOf(state, u)) {
    if (e.cast_left <= 1e-9 || !e.cast_skill) continue;
    const ab = KITS[e.champ]?.[e.cast_skill];
    if (!ab || !(ab.radius ?? 0) || !ab.shape.startsWith("circle")) continue;
    const tgt = e.cast_target ? state.units.find((x) => x.id === e.cast_target) : null;
    // Targeted circles follow the target; we cannot outrun our own feet.
    if (tgt?.id === u.id) continue;
    const centre = ab.shape === "circle_self" ? e : tgt ?? { x: e.cast_aim_x, y: e.cast_aim_y };
    const r = ab.radius!;
    if (d2(u, centre) < r + 0.2) return awayTo(u, centre, r + 0.6);
  }
  return null;
}

/** `disengage`: under 30% HP with an enemy within 4 tiles → walk home. */
export function lowHpRetreat(state: MatchState, u: UnitState): boolean {
  if (!state.config?.teamfight?.disengage) return false;
  if (u.hp / Math.max(1, u.max_hp) >= 0.3) return false;
  return enemiesOf(state, u).some((e) => d2(u, e) <= 4);
}

/** `ranged_hold`: step back from close melee, else stop at 0.9× range from the target. */
export function rangedHoldWaypoint(state: MatchState, u: UnitState, target: UnitState, engage: boolean): Pt | null {
  if (!state.config?.teamfight?.ranged_hold || u.stats.range <= 2) return null;
  let melee: UnitState | null = null;
  for (const e of enemiesOf(state, u)) {
    if (e.stats.range <= 2 && d2(u, e) <= 2 && (!melee || d2(u, e) < d2(u, melee))) melee = e;
  }
  if (melee) return awayTo(u, melee, 3);
  if (engage && d2(u, target) > u.stats.range) return awayTo(u, target, u.stats.range * 0.9);
  return null;
}

/** `ult_timing`: veto an R that would be wasted. */
export function ultWorthIt(state: MatchState, u: UnitState, p: CastProposal): boolean {
  if (!state.config?.teamfight?.ult_timing || p.skill !== "R") return true;
  if (u.hp / Math.max(1, u.max_hp) < 0.3) return true; // last chance
  const ab = KITS[u.champ]?.R;
  const tgt = p.target_id ? state.units.find((x) => x.id === p.target_id) : null;
  const r = ab?.radius ?? 0;
  if (r > 0) {
    const centre =
      ab!.shape === "circle_self" ? u : p.aim_x !== undefined ? { x: p.aim_x, y: p.aim_y! } : tgt ?? u;
    return enemiesOf(state, u).filter((e) => d2(e, centre) <= r + 0.3).length >= 2;
  }
  if (!tgt || tgt.team === u.team) return true; // ally / self ults: policy knows best
  return isLocked(tgt.status) || tgt.hp / Math.max(1, tgt.max_hp) < 0.5;
}
