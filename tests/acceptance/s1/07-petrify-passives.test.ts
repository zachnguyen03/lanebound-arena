/** M1-13 petrify + passives other than Kiln-Cured (spec L440, L787, L592, L655, L829; Break L456). Kiln-Cured is in kiln-cured.test.ts. */
import { describe, expect, it } from "vitest";
import { mit, rawDamage, ab, statAt } from "./_oracle.js";
import { lazy, maxHp, run, skillIs, type Scenario, type UId } from "./_harness.js";

describe("M1-13 Brannoch R petrify: stun + 25% damage-taken reduction on the petrified unit for the stun duration (spec L440, L793, L1718)", () => {
  const BR = "blue:top" as UId, V = "red:mid" as UId, H = "blue:adc" as UId, M = "blue:mid" as UId;
  const sc = (): Scenario => ({ T: 6, units: { [BR]: { champ: "brannoch", level: 7, x: 6, y: 8 }, [V]: { champ: "torun", level: 7, x: 7.5, y: 8 }, [H]: { champ: "huntress", level: 7, x: 6, y: 9 }, [M]: { champ: "maelis", level: 7, x: 6, y: 7 } },
    casts: [{ tick: 5, by: BR, key: "R", aim: [6, 8] }, { tick: 15, by: H, key: "Q", aim: [7.5, 8] }, { tick: 40, by: M, key: "Q", aim: [7.5, 8] }] });
  const RR = lazy(() => run(sc()));
  it("stun 1.6 s (Lock) is applied", () => { const r = RR();
    const a = r.status(V, ["stun", "petrify"]); expect(a.length).toBe(1); expect(a[0]!.applied_duration).toBeCloseTo(1.6, 6); expect(a[0]!.category).toBe("lock");
  });
  it("a third party's Huntress Q during the petrify deals ×0.75 (raw 190 → 142.5 before resist; mitigated = 142.5×100/166 = 85.84)", () => { const r = RR();
    const h = r.skillHits(H, V)[0]!; const a = r.status(V, ["stun", "petrify"])[0]!;
    expect(h.t).toBeGreaterThan(a.t); expect(h.t).toBeLessThan(a.t + 1.6);
    expect(Math.abs(h.mitigated - 190 * 0.75 * mit(66))).toBeLessThanOrEqual(0.02);
  });
  it("after the stun ends the reduction is gone (Maelis Q 273.4 raw → 170.9 vs 60 MRes)", () => { const r = RR();
    const h = r.skillHits(M, V)[0]!; const a = r.status(V, ["stun", "petrify"])[0]!;
    expect(h.t).toBeGreaterThan(a.t + 1.6);
    expect(Math.abs(h.mitigated - (160 + 1.35 * 84) * mit(60))).toBeLessThanOrEqual(0.02);
  });
  it("Brannoch R's OWN damage is NOT cut by its own petrify: damage resolves in phase 8, the new CC lands in phase 9 (spec L143-144; interpretation, see README open question OQ-2)", () => { const r = RR();
    const own = r.skillHits(BR, V).filter((e) => skillIs(e, "brannoch", "R"))[0]!;
    const raw = rawDamage(ab("brannoch", "R"), 7);
    expect(Math.abs(own.mitigated - raw * mit(60))).toBeLessThanOrEqual(0.02);
  });
});

describe("Isra Long Sight: +8% to autos and skills against targets ≥5.0 tiles away; off under Break (spec L396, L592, L1226)", () => {
  const I = "blue:adc" as UId, T = "red:mid" as UId;
  const q = (d: number, extra: Partial<Scenario> = {}) => run({ T: 4, units: { [I]: { champ: "isra", level: 7, x: 6, y: 8 }, [T]: { champ: "torun", level: 7, x: 6 + d, y: 8 } }, casts: [{ tick: 5, by: I, key: "Q", aim: [6 + d, 8] }], ...extra });
  const base = (90 + 0.7 * 98) * mit(66);
  it("Q at 6.0 tiles: ×1.08", () => expect(Math.abs(q(6).skillHits(I, T)[0]!.mitigated - base * 1.08)).toBeLessThanOrEqual(0.02));
  it("Q at exactly 5.0 tiles: ×1.08 (≥ 5.0 inclusive)", () => expect(Math.abs(q(5).skillHits(I, T)[0]!.mitigated - base * 1.08)).toBeLessThanOrEqual(0.02));
  it("Q at 4.5 tiles: no bonus", () => expect(Math.abs(q(4.5).skillHits(I, T)[0]!.mitigated - base)).toBeLessThanOrEqual(0.02));
  it("R at 6.0 tiles: ×1.08; at 4.0: none", () => {
    const rr = (d: number) => run({ T: 4, units: { [I]: { champ: "isra", level: 7, x: 6, y: 8 }, [T]: { champ: "torun", level: 7, x: 6 + d, y: 8 } }, casts: [{ tick: 5, by: I, key: "R", aim: [6 + d, 8] }] }).skillHits(I, T)[0]!;
    const b = (145 + 0.75 * 98) * mit(66);
    expect(Math.abs(rr(6).mitigated - b * 1.08)).toBeLessThanOrEqual(0.02); expect(Math.abs(rr(4).mitigated - b)).toBeLessThanOrEqual(0.02);
  });
  it("autos at 6.0 tiles: non-crit auto = ATK 98 ×1.08 vs 66 PRes; at 3.0 tiles: no bonus", () => {
    const au = (d: number) => run({ T: 4, units: { [I]: { champ: "isra", level: 7, x: 6, y: 8, auto: true }, [T]: { champ: "torun", level: 7, x: 6 + d, y: 8 } } }).autoHits(I).filter((h) => !h.crit)[0]!;
    expect(Math.abs(au(6).mitigated - 98 * 1.08 * mit(66))).toBeLessThanOrEqual(0.02);
    expect(Math.abs(au(3).mitigated - 98 * mit(66))).toBeLessThanOrEqual(0.02);
  });
  it("under Break on Isra the bonus is off (skills and autos)", () => {
    const rq = q(6, { cc: [{ tick: 1, target: I, kind: "break", duration: 10, source: T }] }).skillHits(I, T)[0]!;
    expect(Math.abs(rq.mitigated - base)).toBeLessThanOrEqual(0.02);
    const au = run({ T: 4, units: { [I]: { champ: "isra", level: 7, x: 6, y: 8, auto: true }, [T]: { champ: "torun", level: 7, x: 12, y: 8 } }, cc: [{ tick: 1, target: I, kind: "break", duration: 10, source: T }] }).autoHits(I).filter((h) => !h.crit)[0]!;
    expect(Math.abs(au.mitigated - 98 * mit(66))).toBeLessThanOrEqual(0.02);
  });
  it("Long Sight is not skill-scaled: at L1 the amp is still +8% (spec L359)", () => {
    const r = run({ T: 4, units: { [I]: { champ: "isra", level: 1, x: 6, y: 8 }, [T]: { champ: "torun", level: 1, x: 12, y: 8 } }, casts: [{ tick: 5, by: I, key: "Q", aim: [12, 8] }] });
    const raw = (90 + 0.7 * 70) * 0.7; expect(Math.abs(r.skillHits(I, T)[0]!.mitigated - raw * 1.08 * mit(44))).toBeLessThanOrEqual(0.02);
  });
});

describe("Tolle Well-Fed: each Lock or Bind he lands on an ENEMY heals him 25 + 2% max HP, not skill-scaled, ×0.75 in combat; off under Break (spec L655, L428, L1226)", () => {
  const TO = "blue:jungle" as UId, E1 = "red:mid" as UId, E2 = "red:adc" as UId;
  const wf = (L: number) => 25 + 0.02 * maxHp("tolle", L);
  it("banish (W) on an enemy: one heal of 25+2%×1760=60.2 at L7 and 51.8 at L1 (NOT ×0.70), out of combat ×1.0", () => {
    for (const L of [7, 1]) {
      const r = run({ T: 3, units: { [TO]: { champ: "tolle", level: L, x: 6, y: 8, hp: { frac: 0.5 } }, [E1]: { champ: "torun", level: L, x: 9, y: 8 } }, casts: [{ tick: 5, by: TO, key: "W", target: E1 }] });
      const h = r.heals(TO, TO); expect(h.length, `L${L}`).toBe(1);
      expect(Math.abs(h[0]!.raw - wf(L))).toBeLessThanOrEqual(0.02); expect(h[0]!.combat_scaled).toBe(false); expect(Math.abs(h[0]!.applied - wf(L))).toBeLessThanOrEqual(0.02);
    }
  });
  it("Q stuns two enemies → two heals (one per application); Tolle just dealt damage, so each is ×0.75 (phase 8 order L143)", () => {
    const r = run({ T: 3, units: { [TO]: { champ: "tolle", level: 7, x: 6, y: 8, hp: { frac: 0.5 } }, [E1]: { champ: "torun", level: 7, x: 7.2, y: 8 }, [E2]: { champ: "torun", level: 7, x: 7.6, y: 8.4 } }, casts: [{ tick: 5, by: TO, key: "Q", target: E1 }] });
    expect(r.status(E1, "stun").length).toBe(1); expect(r.status(E2, "stun").length).toBe(1);
    const h = r.heals(TO, TO); expect(h.length).toBe(2);
    for (const x of h) { expect(Math.abs(x.raw - wf(7))).toBeLessThanOrEqual(0.02); expect(Math.abs(x.applied - wf(7) * 0.75)).toBeLessThanOrEqual(0.02); }
  });
  it("banish on an ALLY is not a Lock landed on an enemy: no Well-Fed heal", () => {
    const r = run({ T: 3, units: { [TO]: { champ: "tolle", level: 7, x: 6, y: 8, hp: { frac: 0.5 } }, "blue:adc": { champ: "huntress", level: 7, x: 9, y: 8 } }, casts: [{ tick: 5, by: TO, key: "W", target: "blue:adc" }] });
    expect(r.heals(TO, TO).length).toBe(0);
  });
  it("under Break on Tolle: no heal", () => {
    const r = run({ T: 3, units: { [TO]: { champ: "tolle", level: 7, x: 6, y: 8, hp: { frac: 0.5 } }, [E1]: { champ: "torun", level: 7, x: 9, y: 8 } }, casts: [{ tick: 5, by: TO, key: "W", target: E1 }], cc: [{ tick: 1, target: TO, kind: "break", duration: 10, source: E1 }] });
    expect(r.status(E1, "banish").length).toBe(1); expect(r.heals(TO, TO).length).toBe(0);
  });
});

describe("Brannoch Bedrock: while below 50% HP, +20 PRes and +20 MRes; off under Break (spec L787, L1226)", () => {
  const BR = "red:top" as UId, H = "blue:adc" as UId, V = "blue:mid" as UId;
  const hit = (hpFrac: number, shooter: "huntress" | "helvar", extra: Partial<Scenario> = {}) => {
    const r = run({ T: 3, units: { [BR]: { champ: "brannoch", level: 7, x: 9, y: 8, hp: { frac: hpFrac } }, [H]: { champ: shooter, level: 7, x: 6, y: 8 } }, casts: [{ tick: 5, by: H, key: "Q", aim: [9, 8] }], ...extra });
    return r.skillHits(H, BR)[0]!;
  };
  it("physical: at 48% HP mitigation uses PRes 68+20=88; at 60% HP uses 68", () => {
    expect(Math.abs(hit(0.48, "huntress").mitigated - 190 * mit(88))).toBeLessThanOrEqual(0.02);
    expect(Math.abs(hit(0.60, "huntress").mitigated - 190 * mit(68))).toBeLessThanOrEqual(0.02);
  });
  it("magic: MRes 60+20=80 below 50% (Helvar Q raw 100+0.9×102=191.8)", () => {
    const raw = 100 + 0.9 * 102;
    expect(Math.abs(hit(0.48, "helvar").mitigated - raw * mit(80))).toBeLessThanOrEqual(0.02);
    expect(Math.abs(hit(0.60, "helvar").mitigated - raw * mit(60))).toBeLessThanOrEqual(0.02);
  });
  it("under Break on Brannoch the +20/+20 is off", () => {
    const h = hit(0.48, "huntress", { cc: [{ tick: 1, target: BR, kind: "break", duration: 10, source: H }] });
    expect(Math.abs(h.mitigated - 190 * mit(68))).toBeLessThanOrEqual(0.02);
  });
});

describe("Saelo Rewound Moment: when HP drops below 30%, shield of 25% max HP for 2.5 s, not skill-scaled; off under Break (spec L829, L429)", () => {
  const S = "blue:support" as UId, H = "red:adc" as UId, M = "red:mid" as UId;
  const mk = (L: number, hp: number, extra: Partial<Scenario> = {}): Scenario => ({ T: 4, units: { [S]: { champ: "saelo", level: L, x: 6, y: 8, hp }, [H]: { champ: "huntress", level: 7, x: 11, y: 8 }, [M]: { champ: "maelis", level: 7, x: 11, y: 8.9 } },
    casts: [{ tick: 5, by: H, key: "Q", aim: [6, 8] }, { tick: 12, by: M, key: "Q", aim: [6, 8] }], ...extra });
  it("L7: crossing 30% (hp 340/1080 → Huntress Q 141.8 → 202) grants a 270 shield (25%×1080) lasting 2.5 s", () => {
    const r = run(mk(7, 340)); const s = r.shields(undefined, S); expect(s.length).toBe(1);
    expect(Math.abs(s[0]!.amount - 270)).toBeLessThanOrEqual(0.02); expect(s[0]!.capped_to).toBeLessThanOrEqual(270 + 1e-6);
    expect(Math.abs(s[0]!.expires_at - s[0]!.t - 2.5)).toBeLessThanOrEqual(0.25);
    const hq = r.skillHits(H, S)[0]!; expect(s[0]!.t).toBeGreaterThanOrEqual(hq.t - 1e-9); expect(s[0]!.t).toBeLessThanOrEqual(hq.t + 0.2);
  });
  it("the shield then absorbs the next hit (Maelis Q 195.3 mitigated is fully absorbed)", () => {
    const r = run(mk(7, 340)); const h = r.skillHits(M, S)[0]!;
    expect(h.shield_absorbed).toBeGreaterThan(190); expect(Math.abs(h.mitigated - (160 + 1.35 * 84) * mit(40))).toBeLessThanOrEqual(0.02);
  });
  it("not skill-scaled: at L1 the shield is 25%×900 = 225", () => {
    const r = run(mk(1, 290)); const s = r.shields(undefined, S); expect(s.length).toBe(1); expect(Math.abs(s[0]!.amount - 225)).toBeLessThanOrEqual(0.02);
  });
  it("no trigger when the hit does not take her below 30% (hp 700)", () => {
    expect(run(mk(7, 700)).shields(undefined, S).length).toBe(0);
  });
  it("under Break on Saelo: no shield", () => {
    expect(run(mk(7, 340, { cc: [{ tick: 1, target: S, kind: "break", duration: 10, source: H }] })).shields(undefined, S).length).toBe(0);
  });
});
