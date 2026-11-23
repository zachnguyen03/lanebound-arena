/**
 * Lab/fixture helpers for M1 combat tests — scripted packets and status
 * without requiring full AI.
 */
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

export { computePacket, statsAtLevel, skillScale, hitChance, effAim, emptyStatus, applyCc, addShield, absorbDamage, breakSleepOnHpLoss, strongDispel, basicDispel };

export function huntressQPacket(level: number, atk: number, targetPres: number): { raw: number; mitigated: number } {
  const base = 110 + 0.8 * atk;
  return computePacket({
    base_raw: base,
    level,
    resist: targetPres,
    physical: true,
  });
}

export function maelisRPacket(
  level: number,
  pow: number,
  targetMres: number,
  missingHpFrac: number,
): { raw: number; mitigated: number } {
  const base = 350 + 1.7 * pow;
  const fin = 1 + 0.2 * missingHpFrac;
  return computePacket({
    base_raw: base,
    level,
    finisher_mult: fin,
    resist: targetMres,
    physical: false,
  });
}

export function kerrigRPacket(
  level: number,
  atk: number,
  pow: number,
  targetPres: number,
  missingHpFrac: number,
  hasMark: boolean,
): { raw: number; mitigated: number; fizzled: boolean } {
  if (!hasMark) return { raw: 0, mitigated: 0, fizzled: true };
  const base = 330 + 1.4 * atk + 0.15 * pow;
  const fin = 1 + 0.35 * missingHpFrac;
  const p = computePacket({
    base_raw: base,
    level,
    finisher_mult: fin,
    resist: targetPres,
    physical: true,
  });
  return { ...p, fizzled: false };
}

export function huntressRPacket(
  level: number,
  atk: number,
  targetPres: number,
  marked: boolean,
): { raw: number; mitigated: number; consumed_mark: boolean } {
  const base = 230 + 1.05 * atk;
  const fin = marked ? 1.35 : 1;
  const p = computePacket({
    base_raw: base,
    level,
    finisher_mult: fin,
    resist: targetPres,
    physical: true,
  });
  return { ...p, consumed_mark: marked };
}

/** Scripted three-stun DR sequence for test 18. */
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

/** Apply locks until budget taper kicks in (test 19). */
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
  // Keep applying until taper
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
): { hits: number; rate: number; digestSeed: string } {
  const rng = new RngBank(seed);
  const p = hitChance(effAimVal, reflexes);
  let hits = 0;
  for (let i = 0; i < n; i++) {
    if (rng.next("skillshot", 0) < p) hits += 1;
  }
  return { hits, rate: hits / n, digestSeed: `${seed}:${hits}` };
}

export type { StatusState, CcKind };
