/**
 * Damage packet computation (§6.1 / §6.3).
 * Amp order: skill_scale+finisher → source dmg dealt → kit amps → target dmg taken → mit → shields → HP.
 */
import { mit } from "./stats.js";

export interface PacketInput {
  /** Pre-scale base: base_L7 + ratio_atk*ATK + ratio_pow*POW + other */
  base_raw: number;
  level: number;
  /** Finisher multiplier (1 = none). Applied with skill_scale step. */
  finisher_mult?: number;
  /** Mark / skill own bonus already folded into finisher_mult when appropriate. */
  source_dmg_dealt?: number; // default 1; flank buff etc. additive then one multiply
  kit_amps?: number; // Long Sight, Kiln-Cured
  target_dmg_taken?: number; // petrify 0.75 (= 1 - 0.25 DR)
  resist: number;
  physical: boolean;
}

export interface PacketResult {
  raw: number;
  mitigated: number;
  amp: number;
}

export function skillScale(level: number): number {
  return 1 + 0.05 * (level - 7);
}

/**
 * raw = (base_L7 + ratios) * skill_scale * finisher
 * mitigated = raw * source_dmg * kit_amps * target_dmg_taken * mit(resist)
 */
export function computePacket(p: PacketInput): PacketResult {
  const scale = skillScale(p.level);
  const fin = p.finisher_mult ?? 1;
  const raw = p.base_raw * scale * fin;
  const src = p.source_dmg_dealt ?? 1;
  const kit = p.kit_amps ?? 1;
  const taken = p.target_dmg_taken ?? 1;
  const m = mit(p.resist);
  const mitigated = raw * src * kit * taken * m;
  return { raw, mitigated, amp: src * kit * taken };
}

/** Huntress Q L7 worked example helper. */
export function huntressQBase(atk: number): number {
  return 110 + 0.8 * atk;
}

export function maelisRBase(pow: number): number {
  return 350 + 1.7 * pow;
}

export function kerrigRBase(atk: number, pow: number): number {
  return 330 + 1.4 * atk + 0.15 * pow;
}
