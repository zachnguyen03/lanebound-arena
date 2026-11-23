import { describe, expect, it } from "vitest";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import {
  addShield,
  applyCc,
  emptyStatus,
  threeStunDr,
  lockBudgetTaperDemo,
} from "../sim/fixture.js";
import { applyHeal } from "../sim/heal.js";

describe("M1-16 shield cap 25% max HP", () => {
  it("truncates overflow to 25% max HP", () => {
    const st = emptyStatus();
    const maxHp = 1000;
    const r1 = addShield(st, 200, maxHp, DEFAULT_CONSTANTS.SHIELD_CAP_FRAC);
    expect(st.shield_pool).toBe(200);
    const r2 = addShield(st, 200, maxHp, DEFAULT_CONSTANTS.SHIELD_CAP_FRAC);
    expect(st.shield_pool).toBe(250); // 25% of 1000
    expect(r2.capped_to).toBe(250);
  });
});

describe("M1-17 combat heal ×0.75", () => {
  it("applies ×0.75 inside 3s combat window and ×1 outside", () => {
    const c = DEFAULT_CONSTANTS;
    const inside = applyHeal(100, {
      now: 5,
      last_damage_t: 4,
      last_dealt_t: -Infinity,
      combat_window_s: c.COMBAT_HEAL_WINDOW_S,
      combat_heal_scale: c.COMBAT_HEAL_SCALE,
    });
    expect(inside.in_combat).toBe(true);
    expect(inside.applied).toBe(75);

    const outside = applyHeal(100, {
      now: 10,
      last_damage_t: 1,
      last_dealt_t: 1,
      combat_window_s: c.COMBAT_HEAL_WINDOW_S,
      combat_heal_scale: c.COMBAT_HEAL_SCALE,
    });
    expect(outside.in_combat).toBe(false);
    expect(outside.applied).toBe(100);
  });
});

describe("M1-18 DR three stuns", () => {
  it("applied durations d, 0.70d, 0.49d before budget taper", () => {
    const d = 2.0;
    const applied = threeStunDr(d);
    expect(applied[0]).toBeCloseTo(d, 10);
    expect(applied[1]).toBeCloseTo(0.7 * d, 10);
    expect(applied[2]).toBeCloseTo(0.49 * d, 10);
  });
});

describe("M1-19 Lock budget taper", () => {
  it("once lock_owed ≥ 7.5, new Lock apply ×0.35", () => {
    const st = emptyStatus();
    const c = DEFAULT_CONSTANTS;
    // Apply 4×2.0s stuns with DR: 2 + 1.4 + 0.98 + 0.686 = 5.066 — need more
    // Force lock_owed by applying large raw with DR disabled via spaced categories
    // Apply stuns that sum applied ≥ 7.5
    let t = 0;
    // First apply large stun ignoring we'll use raw that after DR still fills budget
    // Use raw=8 with n=0 → applied 8 ≥ 7.5 already for NEXT apply
    applyCc(st, {
      kind: "stun",
      raw_duration: 8,
      school: "magic",
      source_id: "a",
      now: t,
      dr_window: c.DR_WINDOW_S,
      dr_factor: c.DR_FACTOR,
      dr_floor: c.DR_FLOOR,
      lock_budget: c.LOCK_BUDGET_S,
      lock_taper: c.LOCK_TAPER,
    });
    t = 0.1;
    const next = applyCc(st, {
      kind: "fear",
      raw_duration: 2,
      school: "magic",
      source_id: "a",
      now: t,
      dr_window: c.DR_WINDOW_S,
      dr_factor: c.DR_FACTOR,
      dr_floor: c.DR_FLOOR,
      lock_budget: c.LOCK_BUDGET_S,
      lock_taper: c.LOCK_TAPER,
    });
    expect(next.lock_taper).toBe(true);
    // fear is Lock; DR n=1 for lock → 2*0.7=1.4, then taper ×0.35 → 0.49
    expect(next.applied_duration).toBeCloseTo(2 * 0.7 * 0.35, 10);
  });

  it("lockBudgetTaperDemo eventually tapers", () => {
    const r = lockBudgetTaperDemo(2.0);
    expect(r.tapered).toBe(true);
  });
});
