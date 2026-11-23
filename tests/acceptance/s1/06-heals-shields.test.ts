/** Heals, shields, caps, combat-heal rule, regen, the four "no-op" abilities (spec §6.4 L423-431, M1 16/17 L1721-1722, §7 kits). */
import { describe, expect, it } from "vitest";
import { ab, healAmount, mit, shieldAmount, skillScale, statAt } from "./_oracle.js";
import { dist, maxHp, near, run, skillIs, type Scenario, type UId, floorsTo } from "./_harness.js";

describe("M1-16 shield cap: total shield ≤ 25% of current max HP; new shields add, then the total is capped, overflow is lost (spec L429, L1721)", () => {
  // Two Toruns (both can shield with W): 219.2 + 219.2 = 438.4 > 25% of Huntress L1 max 900 = 225.
  const mk = (): Scenario => ({ T: 4,
    units: { "blue:adc": { champ: "huntress", level: 1, x: 7.5, y: 8 }, "blue:jungle": { champ: "torun", level: 7, x: 6, y: 7.2 }, "blue:top": { champ: "torun", level: 7, x: 6, y: 8.8 }, "red:mid": { champ: "maelis", level: 7, x: 11, y: 8 } },
    casts: [{ tick: 3, by: "blue:jungle", key: "W", target: "blue:adc" }, { tick: 3, by: "blue:top", key: "W", target: "blue:adc" }, { tick: 15, by: "red:mid", key: "R", aim: [7.5, 8] }] });
  it("each Torun W grants 200+0.6×32=219.2; the second brings the pool to the 225 cap, not 438.4", () => {
    const r = run(mk()); const s = r.shields(undefined, "blue:adc");
    expect(s.length).toBe(2);
    expect(Math.abs(s[0]!.amount - 219.2)).toBeLessThanOrEqual(0.02); expect(Math.abs(s[1]!.amount - 219.2)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(s[1]!.capped_to - 225)).toBeLessThanOrEqual(0.02);
    expect(s[0]!.capped_to).toBeLessThanOrEqual(225 + 1e-6);
  });
  it("the pool really is 225: a Maelis R (492.8 raw → 397.4 mitigated vs Huntress L1 MRes 24) absorbs exactly 225", () => {
    const r = run(mk()); const h = r.skillHits("red:mid", "blue:adc")[0]!;
    const raw = 350 + 1.7 * 84; const mitigated = raw * mit(statAt("huntress", 1).mres);
    expect(Math.abs(h.mitigated - mitigated)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(h.shield_absorbed - 225)).toBeLessThanOrEqual(0.02);
    expect(floorsTo(h.hp_after, 900 - (mitigated - 225)), `hp_after ${h.hp_after} = floor(900 - (${mitigated} - 225)) (spec L124)`).toBe(true);
  });
  it("a single shield below the cap is not truncated (Torun W 219.2 on a 1720-HP unit: cap 430)", () => {
    const r = run({ T: 2, units: { "blue:adc": { champ: "torun", level: 7, x: 6, y: 8 }, "blue:jungle": { champ: "torun", level: 7, x: 7.5, y: 8 } }, casts: [{ tick: 3, by: "blue:jungle", key: "W", target: "blue:adc" }] });
    expect(Math.abs(r.shields(undefined, "blue:adc")[0]!.capped_to - 219.2)).toBeLessThanOrEqual(0.02);
  });
});

describe("Shields absorb damage first, expire on time, and never absorb CC (spec L431, L575, L638)", () => {
  const M = "blue:mid" as UId, E = "red:mid" as UId;
  const base = (extra: Partial<Scenario> = {}): Scenario => ({ T: 8, units: { [M]: { champ: "maelis", level: 7, x: 6, y: 8 }, [E]: { champ: "huntress", level: 7, x: 11, y: 8 }, "red:top": { champ: "torun", level: 7, x: 11, y: 9 } }, ...extra });
  it("Maelis W shield (80+0.4×84=113.6, 2.5 s): the next hit is absorbed first, HP only takes the remainder", () => {
    const r = run(base({ casts: [{ tick: 3, by: M, key: "W", aim: [6, 14] }, { tick: 12, by: E, key: "Q", aim: [6, 8] }] }));
    const sh = r.shields(M, M)[0]!; expect(Math.abs(sh.amount - 113.6)).toBeLessThanOrEqual(0.02);
    const h = r.skillHits(E, M)[0]!; const mit_ = 190 * mit(statAt("maelis", 7).pres);
    expect(h.t).toBeLessThan(sh.expires_at);
    expect(Math.abs(h.mitigated - mit_)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(h.shield_absorbed - Math.min(113.6, mit_))).toBeLessThanOrEqual(0.02);
    expect(floorsTo(h.hp_after, 1080 - (mit_ - 113.6)), `hp_after ${h.hp_after} = floor(1080 - (${mit_} - 113.6)) (spec L124)`).toBe(true);
  });
  it("after the 2.5 s duration the shield is gone: a later hit is not absorbed", () => {
    const r = run(base({ casts: [{ tick: 3, by: M, key: "W", aim: [6, 14] }, { tick: 50, by: E, key: "Q", aim: [6, 8] }] }));
    const h = r.skillHits(E, M)[0]!; const sh = r.shields(M, M)[0]!;
    expect(h.t).toBeGreaterThan(sh.expires_at + 1.0);
    expect(h.shield_absorbed).toBe(0);
  });
  it("shields do not absorb CC: a shielded unit still gets stunned (Torun R on a Torun-W-shielded Huntress)", () => {
    const r = run({ T: 4, units: { "blue:adc": { champ: "huntress", level: 7, x: 6, y: 8 }, "blue:jungle": { champ: "torun", level: 7, x: 7, y: 9.5 }, "red:top": { champ: "torun", level: 7, x: 10, y: 8 } },
      casts: [{ tick: 3, by: "blue:jungle", key: "W", target: "blue:adc" }, { tick: 8, by: "red:top", key: "R", aim: [7, 8] }] });
    const h = r.skillHits("red:top", "blue:adc")[0]!; expect(h.shield_absorbed).toBeGreaterThan(0);
    expect(r.status("blue:adc", "stun").length).toBe(1);
  });
});

describe("The four no-op abilities (spec L554, L596, L575, L638): each does exactly what is authored", () => {
  it("Huntress W Switchback: dashes 2 tiles, no damage, no CC, no heal, no shield", () => {
    const r = run({ T: 3, pos: true, units: { "blue:mid": { champ: "huntress", level: 7, x: 6, y: 8 }, "red:mid": { champ: "torun", level: 7, x: 8, y: 8 } }, casts: [{ tick: 5, by: "blue:mid", key: "W", aim: [12, 8] }] });
    expect(dist(r.posAt("blue:mid", 2.9), { x: 6, y: 8 })).toBeCloseTo(2, 1);
    expect(r.of("hit").length + r.of("status_apply").length + r.of("heal").length + r.of("shield_apply").length).toBe(0);
    expect(r.casts("blue:mid", "W")[0]!.cast_time).toBeCloseTo(0.15, 6);
  });
  it("Isra W Recoil Step: dashes 2.5 tiles, nothing else", () => {
    const r = run({ T: 3, pos: true, units: { "blue:mid": { champ: "isra", level: 7, x: 6, y: 8 } }, casts: [{ tick: 5, by: "blue:mid", key: "W", aim: [12, 8] }] });
    expect(dist(r.posAt("blue:mid", 2.9), { x: 6, y: 8 })).toBeCloseTo(2.5, 1);
    expect(r.of("hit").length + r.of("status_apply").length + r.of("heal").length + r.of("shield_apply").length).toBe(0);
  });
  it("Maelis W Glass Veil: dashes 2.5 tiles AND shields self 80+40% POW×scale for 2.5 s; no CC", () => {
    for (const L of [1, 7]) {
      const r = run({ T: 3, pos: true, units: { "blue:mid": { champ: "maelis", level: L, x: 6, y: 8 } }, casts: [{ tick: 5, by: "blue:mid", key: "W", aim: [12, 8] }] });
      expect(dist(r.posAt("blue:mid", 2.9), { x: 6, y: 8 })).toBeCloseTo(2.5, 1);
      const s = r.shields("blue:mid", "blue:mid"); expect(s.length).toBe(1);
      expect(Math.abs(s[0]!.amount - (80 + 0.4 * statAt("maelis", L).pow) * skillScale(L))).toBeLessThanOrEqual(0.02);
      expect(r.of("status_apply").length).toBe(0);
    }
  });
  it("Torun W Sluice Ward: shields the chosen ally and allies within r=1.2 of it; not allies outside, not enemies, not the caster standing apart", () => {
    const r = run({ T: 3, units: { "blue:jungle": { champ: "torun", level: 7, x: 6, y: 8 }, "blue:adc": { champ: "huntress", level: 7, x: 9, y: 8 }, "blue:mid": { champ: "maelis", level: 7, x: 9.8, y: 8.5 },
      "blue:support": { champ: "ysol", level: 7, x: 11.5, y: 8 }, "red:mid": { champ: "torun", level: 7, x: 9, y: 9 } }, casts: [{ tick: 5, by: "blue:jungle", key: "W", target: "blue:adc" }] });
    const exp = 200 + 0.6 * 32;
    for (const id of ["blue:adc", "blue:mid"] as UId[]) { const s = r.shields("blue:jungle", id); expect(s.length, id).toBe(1); expect(Math.abs(s[0]!.amount - exp)).toBeLessThanOrEqual(0.02); }
    for (const id of ["blue:support", "blue:jungle", "red:mid"] as UId[]) expect(r.shields("blue:jungle", id).length, id).toBe(0);
    expect(r.of("hit").length).toBe(0); // no damage
  });
  it("Torun W cast on self (centre = self) shields Torun himself (spec L638 'including self if chosen as the centre')", () => {
    const r = run({ T: 3, units: { "blue:jungle": { champ: "torun", level: 7, x: 6, y: 8 } }, casts: [{ tick: 5, by: "blue:jungle", key: "W", target: "blue:jungle" }] });
    expect(r.shields("blue:jungle", "blue:jungle").length).toBe(1);
  });
});

describe("M1-17 combat heal ×0.75 inside the 3.0 s window, ×1.0 outside (spec L425, L1722)", () => {
  const C = "blue:mid" as UId, E = "red:adc" as UId;
  const calder = (healTick: number, extra: Partial<Scenario> = {}) => run({ T: 8, units: { [C]: { champ: "calder", level: 7, x: 6, y: 8, hp: { frac: 0.5 } }, [E]: { champ: "huntress", level: 7, x: 11, y: 8 } },
    casts: [{ tick: 5, by: E, key: "Q", aim: [6, 8] }, { tick: healTick, by: C, key: "W" }], ...extra });
  const W = 75 + 0.45 * 104;
  it("target RECEIVED damage 1.3 s before: applied = raw × 0.75, combat_scaled=true", () => {
    const r = calder(20); const h = r.heals(C, C)[0]!;
    expect(Math.abs(h.raw - W)).toBeLessThanOrEqual(0.02); expect(h.combat_scaled).toBe(true); expect(Math.abs(h.applied - W * 0.75)).toBeLessThanOrEqual(0.02);
  });
  it("damage 3.6 s before (outside the window): ×1.0", () => {
    const r = calder(50); const h = r.heals(C, C)[0]!;
    expect(h.combat_scaled).toBe(false); expect(Math.abs(h.applied - W)).toBeLessThanOrEqual(0.02);
  });
  it("target DEALT damage 1.3 s before: ×0.75 too ('dealt or received')", () => {
    const r = run({ T: 8, units: { [C]: { champ: "calder", level: 7, x: 6, y: 8, hp: { frac: 0.5 } }, "red:mid": { champ: "torun", level: 7, x: 9, y: 8 } }, casts: [{ tick: 5, by: C, key: "Q", aim: [9, 8] }, { tick: 20, by: C, key: "W" }] });
    const h = r.heals(C, C)[0]!; expect(h.combat_scaled).toBe(true); expect(Math.abs(h.applied - W * 0.75)).toBeLessThanOrEqual(0.02);
  });
  it("never in combat: ×1.0", () => {
    const r = run({ T: 4, units: { [C]: { champ: "calder", level: 7, x: 6, y: 8, hp: { frac: 0.5 } } }, casts: [{ tick: 5, by: C, key: "W" }] });
    expect(r.heals(C, C)[0]!.combat_scaled).toBe(false);
  });
  it("applies to Saelo W and Ysol W on an ally the same way (0.75 on the already skill-scaled heal)", () => {
    for (const [champ, amount] of [["saelo", 65 + 0.35 * 100], ["ysol", 95 + 0.45 * 90]] as const) {
      const r = run({ T: 6, units: { "blue:support": { champ, level: 7, x: 6, y: 8 }, "blue:adc": { champ: "torun", level: 7, x: 8, y: 8, hp: { frac: 0.5 } }, [E]: { champ: "huntress", level: 7, x: 13, y: 8 } },
        casts: [{ tick: 5, by: E, key: "Q", aim: [8, 8] }, { tick: 20, by: "blue:support", key: "W", target: "blue:adc" }] });
      const h = r.heals("blue:support", "blue:adc")[0]!; expect(Math.abs(h.applied - amount * 0.75), champ).toBeLessThanOrEqual(0.02);
    }
  });
});

describe("Heal rules: Calder W, Ysol W, Saelo W (spec L705, L812, L833; M1 L1706)", () => {
  it("Calder W heals self only (radius 0): an ally standing next to him is not healed (spec L705)", () => {
    const r = run({ T: 3, units: { "blue:mid": { champ: "calder", level: 7, x: 6, y: 8, hp: { frac: 0.5 } }, "blue:adc": { champ: "torun", level: 7, x: 6.5, y: 8, hp: { frac: 0.5 } } }, casts: [{ tick: 5, by: "blue:mid", key: "W" }] });
    expect(r.heals("blue:mid", "blue:mid").length).toBe(1); expect(r.heals(undefined, "blue:adc").length).toBe(0);
  });
  it("heals really raise HP (state check) and never above max HP", () => {
    const r = run({ T: 3, units: { "blue:mid": { champ: "calder", level: 7, x: 6, y: 8, hp: { frac: 0.5 } } }, casts: [{ tick: 5, by: "blue:mid", key: "W" }] });
    const h = r.heals("blue:mid", "blue:mid")[0]!; const exp = 570 + h.applied;
    expect(r.unit("blue:mid").hp).toBeGreaterThanOrEqual(exp - 0.5); expect(r.unit("blue:mid").hp).toBeLessThanOrEqual(exp + 4.8 * 3 + 0.5);
    const r2 = run({ T: 3, units: { "blue:mid": { champ: "calder", level: 7, x: 6, y: 8, hp: { frac: 0.97 } } }, casts: [{ tick: 5, by: "blue:mid", key: "W" }] });
    expect(r2.unit("blue:mid").hp).toBeLessThanOrEqual(r2.unit("blue:mid").max_hp + 1e-9);
  });
  const ysol = (extra: Partial<Scenario> = {}): Scenario => ({ T: 6, units: { "blue:support": { champ: "ysol", level: 7, x: 6, y: 8 }, "blue:adc": { champ: "torun", level: 7, x: 9, y: 8, hp: { frac: 0.5 } },
    "blue:mid": { champ: "torun", level: 7, x: 9.8, y: 8, hp: { frac: 0.5 } }, "blue:top": { champ: "torun", level: 7, x: 12, y: 8, hp: { frac: 0.5 } }, "red:mid": { champ: "torun", level: 7, x: 9, y: 9, hp: { frac: 0.5 } } }, ...extra });
  it("Ysol W: heals the chosen centre 95+45%×90=135.5; strong-dispels each ally within r=1.2 (centre and the one 0.8 away) but not the ally 3 away or the enemy", () => {
    const r = run(ysol({ cc: [{ tick: 2, target: "blue:adc", kind: "stun", duration: 4, source: "red:mid" }, { tick: 2, target: "blue:mid", kind: "silence", duration: 4, source: "red:mid" }, { tick: 2, target: "blue:top", kind: "stun", duration: 4, source: "red:mid" }],
      casts: [{ tick: 10, by: "blue:support", key: "W", target: "blue:adc" }] }));
    const hc = r.heals("blue:support", "blue:adc")[0]!; expect(Math.abs(hc.raw - 135.5)).toBeLessThanOrEqual(0.02); expect(hc.combat_scaled).toBe(false);
    const rem = (id: UId) => r.of("dispel", (e) => e.target_id === id).flatMap((e) => e.removed as string[]);
    expect(rem("blue:adc")).toContain("stun"); expect(rem("blue:mid")).toContain("silence");
    expect(r.of("dispel", (e) => e.target_id === "blue:top").length, "ally 3 tiles away").toBe(0);
    expect(r.of("dispel", (e) => e.target_id === "red:mid").length, "enemy").toBe(0);
    expect(r.heals(undefined, "red:mid").length).toBe(0);
  });
  it("Ysol W works on an ally standing in their own sanctuary (spec L215 'Allies may be healed / buffed in their own sanctuary by allies')", () => {
    const r = run({ T: 3, abs: true, units: { "blue:support": { champ: "ysol", level: 7, x: 5, y: 7 }, "blue:adc": { champ: "torun", level: 7, x: 1, y: 7, hp: { frac: 0.5 } } }, casts: [{ tick: 5, by: "blue:support", key: "W", target: "blue:adc" }] });
    expect(r.heals("blue:support", "blue:adc").length).toBe(1);
  });
  it("Saelo W: heals 65+35%×100=100 and basic-dispels the TARGET ONLY (radius 0): an ally 0.5 away gets neither (spec L833, L835)", () => {
    const r = run({ T: 4, units: { "blue:support": { champ: "saelo", level: 7, x: 6, y: 8 }, "blue:adc": { champ: "torun", level: 7, x: 9, y: 8, hp: { frac: 0.5 } }, "blue:mid": { champ: "torun", level: 7, x: 9.5, y: 8, hp: { frac: 0.5 } } },
      cc: [{ tick: 2, target: "blue:adc", kind: "silence", duration: 4, source: "red:mid" }, { tick: 2, target: "blue:mid", kind: "silence", duration: 4, source: "red:mid" }], casts: [{ tick: 10, by: "blue:support", key: "W", target: "blue:adc" }] });
    expect(Math.abs(r.heals("blue:support", "blue:adc")[0]!.raw - 100)).toBeLessThanOrEqual(0.02);
    expect(r.heals(undefined, "blue:mid").length).toBe(0);
    expect(r.of("dispel", (e) => e.target_id === "blue:adc").length).toBeGreaterThanOrEqual(1);
    expect(r.of("dispel", (e) => e.target_id === "blue:mid").length).toBe(0);
  });
});

describe("HP regen always applies, in or out of combat (spec L430)", () => {
  it("Torun L7 regen 9.7/s: +19.4 HP over 2.0 s (±1) from 50% HP", () => {
    const r = run({ T: 2, units: { "blue:mid": { champ: "torun", level: 7, x: 6, y: 8, hp: { frac: 0.5 } } } });
    expect(Math.abs(r.unit("blue:mid").hp - (860 + 19.4))).toBeLessThanOrEqual(1.0);
  });
  it("…and also right after taking damage (in combat)", () => {
    const r = run({ T: 3, units: { "blue:mid": { champ: "torun", level: 7, x: 6, y: 8 }, "red:adc": { champ: "huntress", level: 7, x: 11, y: 8 } }, casts: [{ tick: 5, by: "red:adc", key: "Q", aim: [6, 8] }] });
    const h = r.skillHits("red:adc", "blue:mid")[0]!;
    expect(Math.abs(r.unit("blue:mid").hp - (h.hp_after + 9.7 * (3 - h.t)))).toBeLessThanOrEqual(1.5);
  });
});
