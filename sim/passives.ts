/**
 * Data-driven passive hooks (Long Sight, Kiln-Cured, Well-Fed, Bedrock, Rewound Moment).
 * Numbers come only from PassiveDef on KITS.
 */
import { KITS } from "../data/champions/kits.js";
import { KILN_BREAK_READING, type KilnBreakReading } from "./config.js";
import { dist } from "./math.js";
import { underBreak, type StatusState } from "./status.js";
import type { UnitState } from "./types.js";

export function kitPassive(champ: string) {
  return KITS[champ]?.passive;
}

/** Long Sight kit amp for a packet from `source` into `target`. */
export function longSightAmp(source: UnitState, target: UnitState, now: number): number {
  const p = kitPassive(source.champ);
  if (!p || p.far_bonus === undefined || p.far_tiles === undefined) return 1;
  if (p.off_under_break && underBreak(source.status, now)) return 1;
  const d = dist(source.x, source.y, target.x, target.y);
  if (d + 1e-9 < p.far_tiles) return 1;
  return 1 + p.far_bonus;
}

/**
 * Kiln-Cured: if target is hexed by Mirren, ×(1+kiln_amp) from all sources.
 * Break reading controlled by KILN_BREAK_READING (default owner / Reading A).
 */
export function kilnAmp(
  stateUnits: UnitState[],
  target: UnitState,
  attacker: UnitState,
  now: number,
  reading: KilnBreakReading = KILN_BREAK_READING,
): number {
  const hex = target.status.effects.find((e) => e.kind === "hex" && e.remaining > 0 && e.hex_from);
  if (!hex || !hex.hex_from) return 1;
  const owner = stateUnits.find((u) => u.id === hex.hex_from);
  if (!owner) return 1;
  const p = kitPassive(owner.champ);
  if (!p || p.kiln_amp === undefined) return 1;

  let broken = false;
  if (reading === "owner") broken = underBreak(owner.status, now);
  else if (reading === "victim") broken = underBreak(target.status, now);
  else broken = underBreak(attacker.status, now);

  if (p.off_under_break && broken) return 1;
  return 1 + p.kiln_amp;
}

/** Combined kit amp (Long Sight × Kiln). */
export function kitAmps(
  stateUnits: UnitState[],
  source: UnitState,
  target: UnitState,
  now: number,
): number {
  return longSightAmp(source, target, now) * kilnAmp(stateUnits, target, source, now);
}

/** Bedrock: bonus resist while below HP threshold (off under Break). */
export function bedrockResistBonus(u: UnitState, now: number): number {
  const p = kitPassive(u.champ);
  if (!p || p.bedrock_hp === undefined || p.bedrock_res === undefined) return 0;
  if (p.off_under_break && underBreak(u.status, now)) return 0;
  if (u.hp >= p.bedrock_hp * u.max_hp - 1e-9) return 0;
  return p.bedrock_res;
}

export function effectiveResist(u: UnitState, physical: boolean, now: number): number {
  const base = physical ? u.stats.pres : u.stats.mres;
  return base + bedrockResistBonus(u, now) + (u.zone_aura_res ?? 0);
}

/** Well-Fed heal raw (not skill-scaled). */
export function wellFedHealRaw(tolle: UnitState): number | null {
  const p = kitPassive(tolle.champ);
  if (!p || p.wellfed_base === undefined) return null;
  return p.wellfed_base + (p.wellfed_pct ?? 0) * tolle.max_hp;
}

export function wellFedCombatMult(tolle: UnitState): number {
  return kitPassive(tolle.champ)?.combat_heal_multiplier ?? 0.75;
}

export function wellFedActive(tolle: UnitState, now: number): boolean {
  const p = kitPassive(tolle.champ);
  if (!p || p.wellfed_base === undefined) return false;
  if (p.off_under_break && underBreak(tolle.status, now)) return false;
  return true;
}

/** Rewound Moment: trigger shield when HP crosses below threshold. */
export function tryRewoundMoment(
  u: UnitState,
  now: number,
): { amount: number; duration_s: number } | null {
  const p = kitPassive(u.champ);
  if (!p || p.rewind_hp === undefined || p.rewind_shield === undefined) return null;
  if (u.rewind_used) return null;
  if (p.off_under_break && underBreak(u.status, now)) return null;
  if (u.hp >= p.rewind_hp * u.max_hp - 1e-9) return null;
  u.rewind_used = true;
  return {
    amount: p.rewind_shield * u.max_hp,
    duration_s: p.rewind_dur_s ?? 2.5,
  };
}

/** Cannot cast / auto (spec L452 Lock list). */
export function isHardLocked(st: StatusState): boolean {
  return st.effects.some(
    (e) =>
      e.remaining > 0 &&
      (e.kind === "stun" ||
        e.kind === "knockup" ||
        e.kind === "sleep" ||
        e.kind === "banish" ||
        e.kind === "fear" ||
        e.kind === "timestop" ||
        e.kind === "hex" ||
        e.kind === "petrify"),
  );
}

/** Velocity forced to 0 (spec L145; fear/hex movement is OQ-3). */
export function isMovementFrozen(st: StatusState): boolean {
  return st.effects.some(
    (e) =>
      e.remaining > 0 &&
      (e.kind === "stun" ||
        e.kind === "knockup" ||
        e.kind === "sleep" ||
        e.kind === "banish" ||
        e.kind === "timestop" ||
        e.kind === "petrify"),
  );
}
