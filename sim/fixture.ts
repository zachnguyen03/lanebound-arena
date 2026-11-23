/**
 * Lab/fixture helpers for M1 combat tests — read kit numbers from kits.ts only.
 */
import { KITS } from "../data/champions/kits.js";
import { computePacket } from "./packet.js";
import { statsAtLevel, skillScale, hitChance, effAim } from "./stats.js";
import {
  applyCc,
  emptyStatus,
  addShield,
  absorbDamage,
  breakSleepOnHpLoss,
  strongDispel,
  basicDispel,
  type StatusState,
  type CcKind,
} from "./status.js";
import { DEFAULT_CONSTANTS } from "./constants.js";
import { RngBank } from "./rng.js";
import { sha256Hex } from "./sha256.js";
import { evalL7Base } from "./formula.js";
import { rollSkillshotHit } from "./cast.js";

export {
  computePacket,
  statsAtLevel,
  skillScale,
  hitChance,
  effAim,
  emptyStatus,
  applyCc,
  addShield,
  absorbDamage,
  breakSleepOnHpLoss,
  strongDispel,
  basicDispel,
  evalL7Base,
  rollSkillshotHit,
};

export function kitBase(champ: string, skill: "Q" | "W" | "R", atk: number, pow: number): number {
  return evalL7Base(KITS[champ]![skill].l7_formula, atk, pow);
}

export function huntressQPacket(level: number, atk: number, targetPres: number): { raw: number; mitigated: number } {
  const base = kitBase("huntress", "Q", atk, 0);
  return computePacket({ base_raw: base, level, resist: targetPres, physical: true });
}

export function maelisRPacket(
  level: number,
  pow: number,
  targetMres: number,
  missingHpFrac: number,
): { raw: number; mitigated: number; base_raw: number } {
  const base = kitBase("maelis", "R", 0, pow);
  const fin = 1 + 0.2 * missingHpFrac;
  const p = computePacket({
    base_raw: base,
    level,
    finisher_mult: fin,
    resist: targetMres,
    physical: false,
  });
  return { ...p, base_raw: base };
}

export function kerrigRPacket(
  level: number,
  atk: number,
  pow: number,
  targetPres: number,
  missingHpFrac: number,
  hasMark: boolean,
): { raw: number; mitigated: number; fizzled: boolean; base_raw: number } {
  if (!hasMark) return { raw: 0, mitigated: 0, fizzled: true, base_raw: 0 };
  const base = kitBase("kerrig", "R", atk, pow);
  const fin = 1 + 0.35 * missingHpFrac;
  const p = computePacket({
    base_raw: base,
    level,
    finisher_mult: fin,
    resist: targetPres,
    physical: true,
  });
  return { ...p, fizzled: false, base_raw: base };
}

export function huntressRPacket(
  level: number,
  atk: number,
  targetPres: number,
  marked: boolean,
): { raw: number; mitigated: number; consumed_mark: boolean; base_raw: number } {
  const base = kitBase("huntress", "R", atk, 0);
  const fin = marked ? 1.35 : 1;
  const p = computePacket({
    base_raw: base,
    level,
    finisher_mult: fin,
    resist: targetPres,
    physical: true,
  });
  return { ...p, consumed_mark: marked, base_raw: base };
}

export function threeStunDr(raw: number, now0 = 0): number[] {
  const st = emptyStatus();
  const c = DEFAULT_CONSTANTS;
  const out: number[] = [];
  for (let i = 0; i < 3; i++) {
    const r = applyCc(st, {
      kind: "stun",
      raw_duration: raw,
      school: "physical",
      source_id: "blue:top",
      now: now0 + i * 0.1,
      dr_window: c.DR_WINDOW_S,
      dr_factor: c.DR_FACTOR,
      dr_floor: c.DR_FLOOR,
      lock_budget: c.LOCK_BUDGET_S,
      lock_taper: c.LOCK_TAPER,
    });
    out.push(r.applied_duration);
  }
  return out;
}

export function lockBudgetTaperDemo(rawEach: number): { before: number; after: number; tapered: boolean } {
  const st = emptyStatus();
  const c = DEFAULT_CONSTANTS;
  let t = 0;
  let last = applyCc(st, {
    kind: "stun",
    raw_duration: rawEach,
    school: "magic",
    source_id: "x",
    now: t,
    dr_window: c.DR_WINDOW_S,
    dr_factor: c.DR_FACTOR,
    dr_floor: c.DR_FLOOR,
    lock_budget: c.LOCK_BUDGET_S,
    lock_taper: c.LOCK_TAPER,
  });
  for (let i = 0; i < 20; i++) {
    t += 0.1;
    const r = applyCc(st, {
      kind: "fear",
      raw_duration: rawEach,
      school: "magic",
      source_id: "x",
      now: t,
      dr_window: c.DR_WINDOW_S,
      dr_factor: c.DR_FACTOR,
      dr_floor: c.DR_FLOOR,
      lock_budget: c.LOCK_BUDGET_S,
      lock_taper: c.LOCK_TAPER,
    });
    if (r.lock_taper) {
      return { before: last.applied_duration, after: r.applied_duration, tapered: true };
    }
    last = r;
  }
  return { before: last.applied_duration, after: last.applied_duration, tapered: false };
}

export function rollAimHits(
  seed: number,
  effAimVal: number,
  reflexes: number,
  n: number,
  c = DEFAULT_CONSTANTS,
): { hits: number; rate: number; replayDigest: string; hitChance: number } {
  const rng = new RngBank(seed);
  // Consume the same reserved draws simulate() does before skillshot use.
  void rng.next("player", 0);
  void rng.next("skillshot", 0);
  const p = hitChance(effAimVal, reflexes, c.HIT_BASE, c.HIT_COEF, c.HIT_FLOOR, c.HIT_CEIL);
  let hits = 0;
  const bits: number[] = [];
  for (let i = 0; i < n; i++) {
    const hit = rng.next("skillshot", 0) < p;
    bits.push(hit ? 1 : 0);
    if (hit) hits += 1;
  }
  return { hits, rate: hits / n, replayDigest: sha256Hex(bits.join("")), hitChance: p };
}

export type { StatusState, CcKind };
