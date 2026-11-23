/**
 * Cast range, shape, radius and pierce by POSITION (spec §6.8 L506-514, §5.1 L205-216, §7 kit text).
 * Real map coordinates (abs). Caster = blue:mid at (2.5, 8). Units that must be hit sit well inside the authored geometry; units that must
 * be missed sit well outside it (margins avoid every spec ambiguity that is listed in README OQ-3..OQ-6). force_hit=true removes the Aim roll.
 */
import { describe, expect, it } from "vitest";
import { ABILITIES, mit, rawDamage, type Ability } from "./_oracle.js";
import { dist, lazy, run, skillIs, type Scenario, type UId } from "./_harness.js";

const C = "blue:mid" as UId;
const RED: UId[] = ["red:top", "red:jungle", "red:mid", "red:adc", "red:support"];
const CP = { x: 2.5, y: 8 };
type P = [number, number];
const fire = (a: Ability, pts: Record<string, P>, cast: { target?: string; aim?: P }, T = 3, level = 7) => {
  const names = Object.keys(pts); const units: Scenario["units"] = { [C]: { champ: a.champ, level, x: CP.x, y: CP.y } };
  names.forEach((n, i) => { units[RED[i]!] = { champ: "torun", level: 7, x: pts[n]![0], y: pts[n]![1] }; });
  const idOf = (n: string) => RED[names.indexOf(n)]!;
  const R = lazy(() => run({ abs: true, T, pos: true, units, casts: [{ tick: 5, by: C, key: a.key, ...(cast.target ? { target: idOf(cast.target) } : {}), ...(cast.aim ? { aim: cast.aim } : {}) }] }));
  const hits = (n: string) => R().skillHits(C, idOf(n)).filter((e) => skillIs(e, a.champ, a.key));
  const effect = (n: string) => hits(n).length + R().status(idOf(n)).length;
  return { get r() { return R(); }, hits, effect, id: idOf };
};

const LINES = ABILITIES.filter((a) => a.shape === "line");
describe("Line skillshots: capsule of authored length and width, pierce all / stop at first (spec L509-510)", () => {
  for (const a of LINES) {
    const L = a.range, w = a.width!;
    const pts: Record<string, P> = { near: [CP.x + 2, 8], end: [CP.x + L - 0.5, 8], lateralMiss: [CP.x + 2, 8 + w / 2 + 0.65], beyond: [CP.x + L + 2.0, 8], lateralIn: [CP.x + 4, 8 + Math.max(0.05, w / 2 - 0.1)] };
    const f = fire(a, pts, { aim: [CP.x + L, 8] });
    const first = a.pierce === "first";
    it(`${a.champ} ${a.key} (L${a.line}, length ${L}, width ${w}, ${first ? "stops at first" : "pierce all"}): centre-line target hits exactly once`, () => {
      expect(f.hits("near").length).toBe(1);
    });
    if (first) it(`${a.champ} ${a.key}: nothing behind the first enemy is hit (hook/leash stops at first, L510)`, () => {
      for (const n of ["end", "lateralIn"]) expect(f.effect(n), n).toBe(0);
    }); else it(`${a.champ} ${a.key}: pierces — the far target 0.5 inside the length and the lateral-inside target are also hit`, () => {
      expect(f.hits("end").length).toBe(1); expect(f.hits("lateralIn").length).toBe(1);
    });
    it(`${a.champ} ${a.key}: misses a target 0.65 outside the half-width (${(w / 2 + 0.65).toFixed(2)} off-axis) and one 2.0 beyond the length`, () => {
      expect(f.effect("lateralMiss")).toBe(0); expect(f.effect("beyond")).toBe(0);
    });
  }
});

describe("Cone skillshot (Calder Q, 60°, range 6.4) is polar from the caster; pierces all (spec L511, L703)", () => {
  const a = ABILITIES.find((x) => x.champ === "calder" && x.key === "Q")!;
  const f = fire(a, { axis: [CP.x + 2, 8], rim: [CP.x + 5.9, 8], off10: [CP.x + 3 * Math.cos(Math.PI / 18), 8 + 3 * Math.sin(Math.PI / 18)], side90: [CP.x, 8 + 3], beyond: [CP.x + 6.4 + 1.5, 8] }, { aim: [CP.x + 6.4, 8] });
  it("hits on-axis at 2.0, on-axis at 5.9 (inside range) and 10° off-axis", () => { for (const n of ["axis", "rim", "off10"]) expect(f.hits(n).length, n).toBe(1); });
  it("misses a target 90° off-axis and one 1.5 beyond the range", () => { for (const n of ["side90", "beyond"]) expect(f.effect(n), n).toBe(0); });
});

describe("Targeted cones (Rhedan Q 70°/3.0, Ysol Q 80°/7.2) face the target; primary always hits; others in the cone hit (forced Aim) (spec L768, L810)", () => {
  for (const [champ, key] of [["rhedan", "Q"], ["ysol", "Q"]] as const) {
    const a = ABILITIES.find((x) => x.champ === champ && x.key === key)!;
    const f = fire(a, { prim: [CP.x + 2, 8], in25: [CP.x + 2.5 * Math.cos(25 * Math.PI / 180), 8 + 2.5 * Math.sin(25 * Math.PI / 180)], side90: [CP.x, 8 + 2], beyond: [CP.x + a.range + 1.5, 8] }, { target: "prim" });
    it(`${champ} ${key}: hits the primary and a unit 25° off the facing axis (inside under either reading of the authored angle, full or half: OQ-4); misses a unit 90° off the axis and one beyond range`, () => {
      expect(f.hits("prim").length).toBe(1);
      expect(f.hits("in25").length).toBe(1);
      expect(f.effect("side90")).toBe(0); expect(f.effect("beyond")).toBe(0);
    });
  }
});

const CIRCLES = ABILITIES.filter((a) => a.shape === "circle_point" && !a.hitsAllies);
describe("Point circles: every enemy whose body intersects the circle is hit, none outside (spec L508, body radius 0.4)", () => {
  for (const a of CIRCLES) {
    const r = a.radius!; const P0: P = [8, 8];
    const f = fire(a, { centre: P0, south: [8, 8 - 0.6 * r], northIn: [8, 8 + r - 0.2], westOut: [8 - (r + 0.9), 8], eastFar: [8 + r + 1.5, 8] }, { aim: P0 }, 4);
    it(`${a.champ} ${a.key} (L${a.line}, r=${r}): hits centre, 0.6r and r−0.2; misses r+0.9 and r+1.5`, () => {
      for (const n of ["centre", "south", "northIn"]) expect(f.hits(n).length, n).toBe(1);
      for (const n of ["westOut", "eastFar"]) expect(f.effect(n), n).toBe(0);
    });
    it(`${a.champ} ${a.key}: a unit whose centre is r+0.3 away intersects (body 0.4) and is hit; r+0.5 away is not`, () => {
      const g = fire(a, { edgeHit: [8, 8 + r + 0.3], edgeMiss: [8, 8 - (r + 0.5)] }, { aim: P0 }, 4);
      expect(g.hits("edgeHit").length).toBe(1); expect(g.effect("edgeMiss")).toBe(0);
    });
  }
});

describe("Hostile-and-friendly point circles (Sedge R, Saelo R) hit enemies AND allies but never the caster (spec L619, L837)", () => {
  for (const [champ, r] of [["sedge", 3.8], ["saelo", 2.4]] as const) it(`${champ} R: caster standing at the circle centre is not affected; ally and enemy inside are`, () => {
    const a = ABILITIES.find((x) => x.champ === champ && x.key === "R")!;
    const res = run({ abs: true, T: 3, units: { [C]: { champ, level: 7, x: 5, y: 8 }, "blue:adc": { champ: "torun", level: 7, x: 5 + r * 0.6, y: 8 }, [RED[0]!]: { champ: "torun", level: 7, x: 5, y: 8 + r * 0.6 }, "red:adc": { champ: "torun", level: 7, x: 5 + r + 1.2, y: 8 } },
      casts: [{ tick: 5, by: C, key: "R", aim: [5, 8] }] });
    const kind = champ === "sedge" ? "sleep" : "timestop";
    expect(res.status(C).length).toBe(0); expect(res.status("blue:adc", kind).length).toBe(1); expect(res.status(RED[0]!, kind).length).toBe(1); expect(res.status("red:adc").length).toBe(0);
  });
});

describe("Targeted circles (circle, targeted): primary always hits; neighbours near the primary hit; far ones do not (spec L615, L636, L657, L726, L745, L772)", () => {
  for (const a of ABILITIES.filter((x) => x.shape === "circle_target")) {
    const r = a.radius!; const t0: P = [CP.x + 1.2, 8];
    const f = fire(a, { prim: t0, near: [CP.x + 0.6, 8.7], far: [CP.x + 1.2 + r + 1.2, 8] }, { target: "prim" });
    it(`${a.champ} ${a.key} (r=${r}): primary and a neighbour 0.9 from both caster and primary are hit; a unit r+1.2 beyond is not`, () => {
      expect(f.hits("prim").length).toBe(1); expect(f.hits("near").length).toBe(1); expect(f.effect("far")).toBe(0);
    });
  }
  it("Sedge Q is centred AROUND THE TARGET (spec L615 says so): a unit 1.5 behind the target (5.0 from the caster) is hit; one 3.0 off to the side is not", () => {
    const a = ABILITIES.find((x) => x.champ === "sedge" && x.key === "Q")!;
    const f = fire(a, { prim: [CP.x + 3.5, 8], behind: [CP.x + 5.0, 8], side: [CP.x + 3.5, 11] }, { target: "prim" });
    expect(f.hits("prim").length).toBe(1); expect(f.hits("behind").length).toBe(1); expect(f.effect("side")).toBe(0);
  });
});

describe("Self-centred circle (Brannoch R, r=2.6): hits enemies in the radius around the caster, whatever the aim point (spec L793)", () => {
  const a = ABILITIES.find((x) => x.champ === "brannoch" && x.key === "R")!;
  const f = fire(a, { in20: [CP.x + 2.0, 8], in26n: [CP.x, 8 + 2.5], out32: [CP.x, 8 - 3.2], far: [CP.x + 5, 8] }, { aim: [CP.x, CP.y] });
  it("hits 2.0 and 2.5 away; misses 3.2 and 5.0", () => { expect(f.hits("in20").length).toBe(1); expect(f.hits("in26n").length).toBe(1); expect(f.effect("out32")).toBe(0); expect(f.effect("far")).toBe(0); });
});

describe("Cast range: out of range means no effect (spec L507 'Targeted skills require a legal target in range at cast start')", () => {
  for (const a of ABILITIES.filter((x) => ["circle_target", "cone_target", "target", "streak", "ally_target", "circle_ally"].includes(x.shape))) {
    const ally = a.shape === "ally_target" || a.shape === "circle_ally";
    const mkRun = (d: number) => {
      const units: Scenario["units"] = { [C]: { champ: a.champ, level: 7, x: 2.5, y: 8 } };
      const tid: UId = ally ? "blue:adc" : "red:mid";
      units[tid] = { champ: "torun", level: 7, x: 2.5 + d, y: 8, ...(ally ? { hp: { frac: 0.5 } } : {}) };
      return { r: run({ abs: true, T: 3, units, casts: [{ tick: 5, by: C, key: a.key, target: tid }, ...(a.needsMark ? [] : [])] }), tid };
    };
    if (a.needsMark) continue; // Kerrig R: refused range is covered by the generic streak case below via Brannoch W
    it(`${a.champ} ${a.key} (range ${a.range}): target 0.15 inside range is cast; 0.25 outside is refused and nothing happens`, () => {
      const inn = mkRun(a.range - 0.15), out = mkRun(a.range + 0.25);
      expect(inn.r.casts(C, a.key).length, "in range").toBe(1);
      expect(out.r.casts(C, a.key).length, "out of range: no cast_start").toBe(0);
      const any = out.r.of("hit").length + out.r.of("status_apply").length + out.r.of("heal").length + out.r.of("shield_apply").length;
      expect(any).toBe(0);
    });
  }
  for (const a of ABILITIES.filter((x) => ["line", "cone_skill", "circle_point"].includes(x.shape))) {
    const reach = a.shape === "circle_point" ? a.range + a.radius! + 1.6 : a.range + 2.5;
    it(`${a.champ} ${a.key} (range ${a.range}): an enemy ${reach.toFixed(1)} away (beyond every reach) is untouched even when aimed at`, () => {
      const r = run({ abs: true, T: 4, units: { [C]: { champ: a.champ, level: 7, x: 2.5, y: 8 }, "red:mid": { champ: "torun", level: 7, x: 2.5 + reach, y: 8 } }, casts: [{ tick: 5, by: C, key: a.key, aim: [2.5 + reach, 8] }] });
      expect(r.skillHits(C, "red:mid").length + r.status("red:mid").length).toBe(0);
    });
  }
});

describe("Pillars and the enemy sanctuary clip skills, dashes and circles (spec L205, L215, L512, L514, M1-9 L1710)", () => {
  it("a line that would cross a pillar stops at its face: Helvar Q at (13.5,3) +x hits the unit before the NE pillar (x 17-18, y 2-3), not the one behind it", () => {
    const r = run({ abs: true, T: 3, units: { [C]: { champ: "helvar", level: 7, x: 13.5, y: 3.0 }, "red:mid": { champ: "torun", level: 7, x: 15.5, y: 3.0 }, "red:adc": { champ: "torun", level: 7, x: 20.5, y: 3.0 } }, casts: [{ tick: 5, by: C, key: "Q", aim: [21.5, 3.0] }] });
    expect(r.skillHits(C, "red:mid").length).toBe(1); expect(r.skillHits(C, "red:adc").length).toBe(0);
  });
  it("a dash into a pillar stops at its face and the skill still applies: Maelis W from (14.5,3) +2.5 tiles: centre ends ≤17.0, shield still granted", () => {
    const r = run({ abs: true, T: 3, pos: true, units: { [C]: { champ: "maelis", level: 7, x: 14.5, y: 3.0 } }, casts: [{ tick: 5, by: C, key: "W", aim: [20, 3.0] }] });
    const p = r.posAt(C, 2.9); expect(p.x).toBeLessThanOrEqual(17.0 + 1e-6); expect(p.x).toBeGreaterThan(15.0); expect(r.shields(C, C).length).toBe(1);
  });
  it("M1-9: Isra R aimed at the enemy pad deals 0 to a unit standing in the sanctuary and logs a sanctuary_clip; a unit outside the pad inside the circle IS hit", () => {
    const r = run({ abs: true, T: 4, units: { [C]: { champ: "isra", level: 7, x: 11, y: 7 }, "red:mid": { champ: "torun", level: 7, x: 22.5, y: 7 }, "red:adc": { champ: "torun", level: 7, x: 20, y: 7 } }, casts: [{ tick: 5, by: C, key: "R", aim: [22, 7] }] });
    expect(r.of("hit", (e) => e.target_id === "red:mid" && e.mitigated > 0).length, "no damage in sanctuary").toBe(0);
    expect(r.of("sanctuary_clip").length).toBeGreaterThanOrEqual(1);
    const h = r.skillHits(C, "red:adc")[0]!; expect(h, "outside the pad, inside the circle").toBeDefined();
    expect(Math.abs(h.mitigated - rawDamage(ABILITIES.find((x) => x.champ === "isra" && x.key === "R")!, 7) * 1.08 * mit(66))).toBeLessThanOrEqual(0.02); // dist 9 ≥ 5 → Long Sight ×1.08
  });
  it("a line fired through the enemy pad does not hit a unit standing in it (Huntress Q from (17,7) aimed +x)", () => {
    const r = run({ abs: true, T: 3, units: { [C]: { champ: "huntress", level: 7, x: 17, y: 7 }, "red:adc": { champ: "torun", level: 7, x: 20, y: 7 }, "red:mid": { champ: "torun", level: 7, x: 22.5, y: 7 } }, casts: [{ tick: 5, by: C, key: "Q", aim: [25, 7] }] });
    expect(r.skillHits(C, "red:adc").length).toBe(1); expect(r.of("hit", (e) => e.target_id === "red:mid" && e.mitigated > 0).length).toBe(0);
  });
  it("a targeted skill cannot affect an enemy standing in its own sanctuary (Mirren W on a unit at (22.5,7) from (17,7))", () => {
    const r = run({ abs: true, T: 3, units: { [C]: { champ: "mirren", level: 7, x: 17, y: 7 }, "red:mid": { champ: "torun", level: 7, x: 22.5, y: 7 } }, casts: [{ tick: 5, by: C, key: "W", target: "red:mid" }] });
    expect(r.status("red:mid").length).toBe(0);
  });
  it("a dash toward the enemy pad stops short of it (centre stays out of x≥22) and the skill still applies (Maelis W shield)", () => {
    const r = run({ abs: true, T: 3, pos: true, units: { [C]: { champ: "maelis", level: 7, x: 20.5, y: 8 } }, casts: [{ tick: 5, by: C, key: "W", aim: [26, 8] }] });
    expect(r.posAt(C, 2.9).x).toBeLessThan(22.0); expect(r.shields(C, C).length).toBe(1);
  });
});

describe("Isra land delay: the circle is evaluated at LAND time, at the aim point chosen at cast (spec L508, L594)", () => {
  const I = "blue:adc" as UId;
  const q = (tpos: P, motor?: P[]) => run({ T: 4, pos: true, units: { [I]: { champ: "isra", level: 7, x: 6, y: 8 }, "red:mid": { champ: "torun", level: 7, x: tpos[0], y: tpos[1] } }, casts: [{ tick: 5, by: I, key: "Q", aim: [10, 8] }], ...(motor ? { motor: { "red:mid": { to: motor } } } : {}) });
  it("a unit standing on the aim point is hit 1.3 s after the cast starts (0.3 cast + 1.0 delay)", () => {
    const r = q([10, 8]); const c = r.casts(I, "Q")[0]!; const h = r.skillHits(I, "red:mid")[0]!;
    expect(h.t - c.t).toBeGreaterThanOrEqual(1.3 - 1e-6); expect(h.t - c.t).toBeLessThanOrEqual(1.5 + 1e-6);
  });
  it("a unit that walks away during the delay (4.2 tiles > r 1.4 + 0.4) is missed", () => { expect(q([10, 8], [[22, 8]]).skillHits(I, "red:mid").length).toBe(0); });
  it("a unit outside the circle at cast time that walks into it before the land is hit", () => { expect(q([7, 8], [[10, 8]]).skillHits(I, "red:mid").length).toBe(1); });
  it("no damage is dealt before the land time", () => {
    const r = q([10, 8]); const c = r.casts(I, "Q")[0]!; for (const h of r.skillHits(I, "red:mid")) expect(h.t).toBeGreaterThan(c.t + 1.0);
  });
});
