import { CHAMPIONS, CLASS_GROWTH, type ChampClass, type L1Stats } from "../data/champions/defs.js";
import { clamp } from "./math.js";

export interface ResolvedStats {
  hp: number;
  regen: number;
  atk: number;
  pow: number;
  pres: number;
  mres: number;
  as: number;
  crit: number;
  range: number;
  ms: number;
}

/** §6.2 skill_scale(L) = 1 + 0.05 * (L - 7) */
export function skillScale(level: number): number {
  return 1 + 0.05 * (level - 7);
}

export function eHP(hp: number, resist: number): number {
  return hp * (100 + resist) / 100;
}

export function eHPAvg(hp: number, pres: number, mres: number): number {
  return 0.5 * (eHP(hp, pres) + eHP(hp, mres));
}

export function mit(resist: number): number {
  return 100 / (100 + Math.max(0, resist));
}

/** stat(L) = base_L1 + growth * (L - 1). Range and MS do not grow. */
export function statsAtLevel(champId: string, level: number): ResolvedStats {
  const def = CHAMPIONS[champId];
  if (!def) throw new Error(`unknown champion ${champId}`);
  const g = CLASS_GROWTH[def.class as ChampClass];
  const b = def.l1;
  const n = level - 1;
  return {
    hp: b.hp + g.hp * n,
    regen: b.regen + g.regen * n,
    atk: b.atk + g.atk * n,
    pow: b.pow + g.pow * n,
    pres: b.pres + g.pres * n,
    mres: b.mres + g.mres * n,
    as: b.as + g.as * n,
    crit: b.crit + g.crit * n,
    range: b.range,
    ms: b.ms,
  };
}

/** Display rounding for test 5: HP integer, AS 3 dp, crit 0.1%, eHP avg 1 dp. */
export function roundSnapshot(s: ResolvedStats): {
  hp: number;
  regen: number;
  atk: number;
  pow: number;
  pres: number;
  mres: number;
  as: number;
  crit_pct: number;
  range: number;
  ms: number;
  ehp_avg: number;
} {
  return {
    hp: Math.round(s.hp),
    regen: parseFloat(s.regen.toFixed(2)),
    atk: Math.round(s.atk),
    pow: Math.round(s.pow),
    pres: Math.round(s.pres),
    mres: Math.round(s.mres),
    as: parseFloat(s.as.toFixed(3)),
    crit_pct: parseFloat((s.crit * 100).toFixed(1)),
    range: s.range,
    ms: s.ms,
    ehp_avg: parseFloat(eHPAvg(s.hp, s.pres, s.mres).toFixed(1)),
  };
}

export function masteryMod(mastery: number, coef = 0.15, cap = 8): number {
  return clamp((mastery - 50) * coef, -cap, cap);
}

export function effAim(aim: number, mastery: number): number {
  return clamp(aim + masteryMod(mastery), 1, 99);
}

export function hitChance(effAimVal: number, targetReflexes: number, hitBase = 0.55, hitCoef = 0.01, floor = 0.25, ceil = 0.9): number {
  return clamp(hitBase + hitCoef * (effAimVal - targetReflexes), floor, ceil);
}

/**
 * K-2 disabled-target skillshot override (§8.4 L935–944).
 * Reflexes drop out; piecewise linear in eff_Aim, clamp [0.70, 0.95]:
 *   < 60: 0.80 + (0.10/30)·(eff_Aim − 60)
 *   ≥ 60: 0.80 + 0.01·(eff_Aim − 60)
 */
export function hitChanceDisabled(effAimVal: number): number {
  const raw =
    effAimVal < 60
      ? 0.8 + (0.1 / 30) * (effAimVal - 60)
      : 0.8 + 0.01 * (effAimVal - 60);
  return clamp(raw, 0.7, 0.95);
}

export type { L1Stats, ChampClass };
