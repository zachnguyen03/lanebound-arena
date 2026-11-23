/**
 * Ruled dps_est / est_ttk (Appendix R #3 / OQ-S2-5).
 * dps_est = (dummy 5 s damage including R if ready) / 5.
 * Delete the cheap ATK*AS fallback.
 */
import { KITS } from "../../data/champions/kits.js";
import { CHAMPIONS } from "../../data/champions/defs.js";
import { abilityBaseRaw } from "../formula.js";
import { skillScale, mit } from "../stats.js";
import type { UnitId, UnitState } from "../types.js";

function dist(a: UnitState, b: UnitState): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Physical-leaning classes; others treated as magic for eHP resist pick. */
function primaryPhysical(u: UnitState): boolean {
  const cls = CHAMPIONS[u.champ]?.class;
  return cls === "Marksman" || cls === "Fighter" || cls === "Assassin" || cls === "Tank";
}

/** Dummy 5 s damage at current level; R once if L≥5 and R off CD. */
export function dummy5sDamage(u: UnitState): number {
  const crit = Math.min(u.stats.crit, 0.8);
  const auto = u.stats.atk * u.stats.as * 5 * (1 + crit * 0.75);
  let r = 0;
  if (u.level >= 5 && u.cd_r <= 1e-9) {
    const kit = KITS[u.champ]?.R;
    if (kit && kit.damage && kit.damage !== "none") {
      r = abilityBaseRaw(kit, u.stats.atk, u.stats.pow) * skillScale(u.level);
    }
  }
  return auto + r;
}

export function dpsEst(u: UnitState): number {
  return dummy5sDamage(u) / 5;
}

/** eHP vs one attacker's damage type: (hp + shields) / mit(resist). */
export function ehpVsAttacker(target: UnitState, attacker: UnitState): number {
  const shield = target.status.shield_pool;
  const pool = Math.max(0, target.hp) + Math.max(0, shield);
  const resist = primaryPhysical(attacker) ? target.stats.pres : target.stats.mres;
  const taken = mit(resist); // damage-taken multiplier
  return pool / Math.max(1e-6, taken);
}

/**
 * est_ttk(target) = eHP / Σ dps_est of living allies within 8 tiles of the target
 * whose current intent targets it. Evaluating unit always counts itself.
 * Denominator floor 1.
 */
export function estTtk(
  evaluator: UnitState,
  target: UnitState,
  all: UnitState[],
  intentTarget: Partial<Record<UnitId, UnitId | null>>,
): number {
  const ehp = ehpVsAttacker(target, evaluator);
  let sum = 0;
  for (const a of all) {
    if (!a.alive || a.team !== evaluator.team) continue;
    if (a.id !== evaluator.id) {
      if (dist(a, target) > 8) continue;
      if (intentTarget[a.id] !== target.id) continue;
    }
    sum += dpsEst(a);
  }
  return ehp / Math.max(1, sum);
}
