/**
 * Six attribute hooks (§8.4) — pure deterministic helpers.
 * Only Aim/Execution take mastery; others use raw attrs.
 * Perception coefficients locked as S2 defaults (P) — Appendix R #3 / OQ-S2-1.
 */
import type { PlayerAttrs } from "../types.js";
import type { Constants } from "../constants.js";

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function masteryMod(mastery: number, c: Constants): number {
  return clamp((mastery - 50) * c.MASTERY_COEF, -c.MASTERY_MOD_CAP, c.MASTERY_MOD_CAP);
}

export function effAim(attrs: PlayerAttrs, mastery: number, c: Constants): number {
  return clamp(attrs.aim + masteryMod(mastery, c), 1, 99);
}

export function effExecution(attrs: PlayerAttrs, mastery: number, c: Constants): number {
  return clamp(attrs.execution + masteryMod(mastery, c), 1, 99);
}

/** Aim vs Reflexes hit% (§8.4). */
export function skillshotHitChance(effAimVal: number, targetReflexes: number, c: Constants): number {
  return clamp(c.HIT_BASE + c.HIT_COEF * (effAimVal - targetReflexes), c.HIT_FLOOR, c.HIT_CEIL);
}

/** Reflexes reaction delay (s). */
export function reactionDelayS(reflexes: number): number {
  return clamp(0.7 - 0.008 * (reflexes - 50), 0.2, 0.9);
}

/** (P) Decision perception radius — S2 locked defaults. */
export function perceptionRadiusTiles(decision: number): number {
  return clamp(7.0 + 0.04 * (decision - 50), 5.0, 11.0);
}

/** (P) Decision perception delay — S2 locked defaults. */
export function perceptionDelayS(decision: number): number {
  return clamp(0.4 - 0.004 * (decision - 50), 0.15, 0.6);
}

export function decisionLagS(decision: number): number {
  return clamp(0.8 - 0.012 * (decision - 50), 0.2, 1.2);
}

export function mistakeBand(decision: number): number {
  return clamp(0.08 - 0.0015 * (decision - 50), 0.02, 0.12);
}

/** Appendix R #3 / OQ-S2-2: hyst_s = clamp(0.8 + 0.01×(D−50), 0.4, 1.3). */
export function hystS(decision: number): number {
  return clamp(0.8 + 0.01 * (decision - 50), 0.4, 1.3);
}

export function regroupS(decision: number): number {
  return clamp(3.0 - 0.03 * (decision - 50), 1.5, 4.5);
}

export function holdDist(autoRange: number, positioning: number): number {
  const raw = autoRange * (0.75 + 0.003 * (positioning - 50));
  return clamp(raw, autoRange - 1.5, autoRange);
}

export function diveSlack(positioning: number): number {
  return clamp(0.08 - 0.0016 * (positioning - 50), 0.0, 0.12);
}

/** Teamwork < 35 damage-class mid-combo may skip peel (§8.4). */
export function teamworkMaySkipPeel(teamwork: number, isTankOrEnchanter: boolean): boolean {
  if (isTankOrEnchanter) return false;
  return teamwork < 35;
}

/** Execution hooks (§8.4). */
export function comboFollowS(effExec: number): number {
  return clamp(0.35 - 0.005 * (effExec - 50), 0.1, 0.5);
}

export function rHoldA(effExec: number): number {
  return clamp(0.55 - 0.003 * (effExec - 50), 0.4, 0.62);
}

export function rHoldHp(effExec: number): number {
  return clamp(0.55 - 0.004 * (effExec - 50), 0.35, 0.7);
}

export function kiteSlackTiles(effExec: number): number {
  return clamp(0.8 - 0.012 * (effExec - 50), 0.2, 1.2);
}

export function autoResetS(effExec: number): number {
  return clamp(0.2 - 0.002 * (effExec - 50), 0.08, 0.28);
}

/**
 * Teamwork follow-call multiplier — Appendix R6-7(d):
 *   clamp(1 + 0.01·(T − 50), 0.70, 1.40)
 * Replaces the old §8.4 form `1 + 0.01·max(0, 50 − T)`, which was inert for
 * T ∈ [50, 99] and inverted below 50 (low T made follow easier).
 */
export function callFollowSlack(teamwork: number): number {
  return clamp(1 + 0.01 * (teamwork - 50), 0.7, 1.4);
}
