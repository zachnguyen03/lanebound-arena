/**
 * Appendix R #2 — GD rulings 23 Nov 2026 (build spec L1895-1905). Additive: does not edit the original suite.
 * Every assertion is cited to an Appendix R line. Previously un-asserted movement / angle / capsule / clamp
 * cases that OQ-3/4/5/6 now settle live here (the original files kept their conservative margins).
 */
import { describe, expect, it } from "vitest";
import { defaultEvenConfig, simulate } from "../../../sim/index.js";
import { mit, rawDamage, ab, statAt } from "./_oracle.js";
import {
  Run, ZONE_SHIFT, dist, maxHp, run, skillIs,
  type Ev, type Scenario, type UId,
} from "./_harness.js";

const MI = "blue:mid" as UId, H = "blue:adc" as UId, V = "red:mid" as UId;
const BR = "blue:top" as UId, TO = "blue:jungle" as UId, IS = "blue:adc" as UId, SA = "blue:support" as UId;
const MS_H = statAt("huntress", 7).ms; // 3.3, spec L547

/** Like `run()`, plus extra `constants` overrides (public MatchConfig.constants). */
function runConst(sc: Scenario, extra: Record<string, unknown> = {}): Run {
  const sh = sc.abs ? 0 : ZONE_SHIFT;
  const cfg: any = { ...defaultEvenConfig(sc.seed ?? 20261122), constants: { MATCH_T: sc.T, ...extra }, debug_pos: sc.pos ?? false };
  const uo: any = {};
  for (const [id, u] of Object.entries(sc.units)) {
    const level = u!.level ?? 7;
    const o: any = { champ: u!.champ, level, x: u!.x - sh, y: u!.y, spawn_shield_until: 0, auto_next_start_t: u!.auto ? (typeof u!.auto === "number" ? u!.auto : 0) : 999 };
    if (u!.hp !== undefined) o.hp = typeof u!.hp === "number" ? u!.hp : maxHp(u!.champ, level) * u!.hp.frac;
    if (u!.as !== undefined) o.as = u!.as; if (u!.range !== undefined) o.range = u!.range;
    if (u!.attrs) o.attrs = u!.attrs;
    uo[id] = o;
  }
  for (const team of ["blue", "red"]) for (const role of ["top", "jungle", "mid", "adc", "support"]) {
    const id = `${team}:${role}`; if (!uo[id]) uo[id] = { auto_next_start_t: 999, spawn_shield_until: 0 };
  }
  cfg.unit_overrides = uo;
  cfg.scripted_casts = (sc.casts ?? []).map((c) => ({ tick: c.tick, source_id: c.by, skill: c.key, ...(c.target ? { target_id: c.target } : {}), ...(c.aim ? { aim_x: c.aim[0] - sh, aim_y: c.aim[1] } : {}), ...(c.force_hit !== undefined ? { force_hit: c.force_hit } : { force_hit: true }) }));
  if (sc.cc) cfg.scripted_cc = sc.cc.map((c) => ({ tick: c.tick, target_id: c.target, kind: c.kind, duration: c.duration, ...(c.source ? { source_id: c.source } : {}) }));
  if (sc.damage) cfg.scripted_damage = sc.damage.map((d) => ({ tick: d.tick, source_id: d.source, target_id: d.target, raw: d.raw }));
  if (sc.motor) { cfg.scripted_motor = {}; for (const [id, m] of Object.entries(sc.motor)) cfg.scripted_motor[id] = { waypoints: m!.to.map(([x, y]) => ({ x: x - sh, y })), arrive_r: m!.arrive_r ?? 0.05, hold_at_end: true }; }
  const r: any = simulate(cfg);
  const units: Record<string, any> = {}; for (const u of r.state.units) units[u.id] = { ...u, x: u.x + sh };
  return new Run(r.events as Ev[], units, r.digest, sc, sh);
}
function constantsHash(extra: Record<string, unknown> = {}): string {
  const r: any = simulate({ ...defaultEvenConfig(20261122), constants: { MATCH_T: 240, ...extra } });
  const ev = (r.events as Ev[]).find((e) => e.type === "match_start");
  expect(ev, "match_start.constants_hash (spec L1889 G10)").toBeDefined();
  return ev!.constants_hash as string;
}
const meanSpeed = (r: Run, id: UId, t0: number, t1: number) => {
  const s = r.speeds(id).filter((x) => x.t > t0 + 1e-9 && x.t <= t1 + 1e-9);
  expect(s.length, `move samples for ${id} in (${t0},${t1}]`).toBeGreaterThan(0);
  return s.reduce((a, x) => a + x.v, 0) / s.length;
};

/* ───────────────────────────────────────────── OQ-1 ───────────────────────────────────────────── */
describe("OQ-1 (Appendix R #2 L1897): 'off under Break' is a Break on the passive's OWNER; Break on the victim or the attacker does nothing", () => {
  describe("Mirren Kiln-Cured (also covered in kiln-cured-ruled.test.ts; M1 test 14 breaks Mirren)", () => {
    const hq = 190 * mit(66);
    const sc = (brk?: UId): Scenario => ({ T: 4, units: { [MI]: { champ: "mirren", level: 7, x: 6, y: 8 }, [V]: { champ: "torun", level: 7, x: 9, y: 8 }, [H]: { champ: "huntress", level: 7, x: 6, y: 9 } },
      casts: [{ tick: 3, by: MI, key: "W", target: V }, { tick: 10, by: H, key: "Q", aim: [9, 8] }],
      ...(brk ? { cc: [{ tick: 1, target: brk, kind: "break", duration: 10, source: V }] } : {}) });
    const q = (r: Run) => r.skillHits(H, V).find((e) => skillIs(e, "huntress", "Q"))!;
    it("Break on Mirren (owner): amp off", () => expect(Math.abs(q(run(sc(MI))).mitigated - hq)).toBeLessThanOrEqual(0.02));
    it("Break on the hexed target (victim): amp still +12%", () => expect(Math.abs(q(run(sc(V))).mitigated - hq * 1.12)).toBeLessThanOrEqual(0.02));
    it("Break on Huntress (attacker): amp still +12%", () => expect(Math.abs(q(run(sc(H))).mitigated - hq * 1.12)).toBeLessThanOrEqual(0.02));
    it("no Break: +12%", () => expect(Math.abs(q(run(sc())).mitigated - hq * 1.12)).toBeLessThanOrEqual(0.02));
  });

  describe("Isra Long Sight (+8% at ≥5.0 tiles, L396, L592)", () => {
    const base = (90 + 0.7 * 98) * mit(66);
    const q = (extra: Partial<Scenario> = {}) => run({ T: 4, units: { [IS]: { champ: "isra", level: 7, x: 6, y: 8 }, [V]: { champ: "torun", level: 7, x: 12, y: 8 } }, casts: [{ tick: 5, by: IS, key: "Q", aim: [12, 8] }], ...extra }).skillHits(IS, V)[0]!;
    it("Break on Isra (owner): bonus off, plain Q", () => expect(Math.abs(q({ cc: [{ tick: 1, target: IS, kind: "break", duration: 10, source: V }] }).mitigated - base)).toBeLessThanOrEqual(0.02));
    it("Break on the target (victim): bonus still +8%", () => expect(Math.abs(q({ cc: [{ tick: 1, target: V, kind: "break", duration: 10, source: IS }] }).mitigated - base * 1.08)).toBeLessThanOrEqual(0.02));
    it("no Break: +8%", () => expect(Math.abs(q().mitigated - base * 1.08)).toBeLessThanOrEqual(0.02));
  });

  describe("Tolle Well-Fed (25+2% max HP on Lock/Bind he lands on an enemy, L655)", () => {
    const wf = 25 + 0.02 * maxHp("tolle", 7);
    const ban = (extra: Partial<Scenario> = {}) => run({ T: 3, units: { [TO]: { champ: "tolle", level: 7, x: 6, y: 8, hp: { frac: 0.5 } }, [V]: { champ: "torun", level: 7, x: 9, y: 8 } }, casts: [{ tick: 5, by: TO, key: "W", target: V }], ...extra });
    it("Break on Tolle (owner): banish still lands, no Well-Fed heal", () => {
      const r = ban({ cc: [{ tick: 1, target: TO, kind: "break", duration: 10, source: V }] });
      expect(r.status(V, "banish").length).toBe(1); expect(r.heals(TO, TO).length).toBe(0);
    });
    it("Break on the CC'd enemy (victim): Well-Fed still heals 60.2 out of combat", () => {
      const r = ban({ cc: [{ tick: 1, target: V, kind: "break", duration: 10, source: TO }] });
      expect(r.status(V, "banish").length).toBe(1);
      expect(r.heals(TO, TO).length).toBe(1);
      expect(Math.abs(r.heals(TO, TO)[0]!.applied - wf)).toBeLessThanOrEqual(0.02);
    });
  });

  describe("Brannoch Bedrock (+20 PRes/MRes below 50% HP, L787)", () => {
    // Owner and packet-victim are the same unit (Brannoch). The ruling's "victim" case is N/A as a distinct person;
    // Break on Brannoch turns the passive off because he is the OWNER. Break on the shooter (attacker) does nothing.
    const hit = (extra: Partial<Scenario> = {}) => run({ T: 3, units: { [BR]: { champ: "brannoch", level: 7, x: 9, y: 8, hp: { frac: 0.48 } }, [H]: { champ: "huntress", level: 7, x: 6, y: 8 } }, casts: [{ tick: 5, by: H, key: "Q", aim: [9, 8] }], ...extra }).skillHits(H, BR)[0]!;
    it("Break on Brannoch (owner): +20 PRes is off, mitigation uses 68", () => expect(Math.abs(hit({ cc: [{ tick: 1, target: BR, kind: "break", duration: 10, source: H }] }).mitigated - 190 * mit(68))).toBeLessThanOrEqual(0.02));
    it("Break on Huntress (attacker): +20 PRes still on, mitigation uses 88", () => expect(Math.abs(hit({ cc: [{ tick: 1, target: H, kind: "break", duration: 10, source: BR }] }).mitigated - 190 * mit(88))).toBeLessThanOrEqual(0.02));
    it("no Break, 48% HP: uses 88", () => expect(Math.abs(hit().mitigated - 190 * mit(88))).toBeLessThanOrEqual(0.02));
  });

  describe("Saelo Rewound Moment (25% max HP shield for 2.5 s when HP crosses 30%, L829)", () => {
    const mk = (extra: Partial<Scenario> = {}) => run({ T: 4, units: { [SA]: { champ: "saelo", level: 7, x: 6, y: 8, hp: 340 }, [H]: { champ: "huntress", level: 7, x: 11, y: 8 } }, casts: [{ tick: 5, by: H, key: "Q", aim: [6, 8] }], ...extra });
    it("Break on Saelo (owner) suppresses the shield; Break on Huntress (attacker) does not (shield of 270 still granted)", () => {
      expect(mk({ cc: [{ tick: 1, target: SA, kind: "break", duration: 10, source: H }] }).shields(undefined, SA).length, "owner Break: no shield").toBe(0);
      const s = mk({ cc: [{ tick: 1, target: H, kind: "break", duration: 10, source: SA }] }).shields(undefined, SA);
      expect(s.length, "attacker Break: shield still granted (pairs with the owner case so a sim that never shields cannot pass)").toBe(1);
      expect(Math.abs(s[0]!.amount - 270)).toBeLessThanOrEqual(0.02);
    });
  });
});

/* ───────────────────────────────────────────── OQ-2 ───────────────────────────────────────────── */
describe("OQ-2 (Appendix R #2 L1898): CC or amps applied this tick never modify packets resolved this tick; Kiln-Cured starts next tick", () => {
  it("Brannoch R's own packet is not cut by the petrify it applies this tick (own packet before own CC)", () => {
    const r = run({ T: 3, units: { [BR]: { champ: "brannoch", level: 7, x: 6, y: 8 }, [V]: { champ: "torun", level: 7, x: 7.5, y: 8 } }, casts: [{ tick: 5, by: BR, key: "R", aim: [6, 8] }] });
    const own = r.skillHits(BR, V).filter((e) => skillIs(e, "brannoch", "R"))[0]!;
    expect(Math.abs(own.mitigated - rawDamage(ab("brannoch", "R"), 7) * mit(60))).toBeLessThanOrEqual(0.02);
  });
  it("a third-party scripted packet on the petrify's own tick is NOT ×0.75; one on the next tick IS", () => {
    const r = run({ T: 4, units: { [BR]: { champ: "brannoch", level: 7, x: 6, y: 8 }, [V]: { champ: "torun", level: 7, x: 7.5, y: 8 }, [H]: { champ: "huntress", level: 7, x: 6, y: 9 } },
      casts: [{ tick: 5, by: BR, key: "R", aim: [6, 8] }],
      damage: Array.from({ length: 12 }, (_, i) => ({ tick: 5 + i, source: H, target: V, raw: 190 })) });
    const pet = r.status(V, ["stun", "petrify"])[0]!; expect(pet, "petrify landed").toBeDefined();
    const pk = r.skillHits(H, V).filter((e) => e.skill_id === "scripted");
    const same = pk.find((e) => e.tick === pet.tick); const next = pk.find((e) => e.tick === pet.tick + 1);
    expect(same).toBeDefined(); expect(next).toBeDefined();
    expect(Math.abs(same!.mitigated - 190 * mit(66)), "same tick: no petrify DR").toBeLessThanOrEqual(0.02);
    expect(Math.abs(next!.mitigated - 190 * 0.75 * mit(66)), "next tick: ×0.75").toBeLessThanOrEqual(0.02);
  });
  it("Kiln-Cured: same-tick scripted packet plain, next-tick packet ×1.12 (see also kiln-cured-ruled.test.ts)", () => {
    const r = run({ T: 4, units: { [MI]: { champ: "mirren", level: 7, x: 6, y: 8 }, [V]: { champ: "torun", level: 7, x: 9, y: 8 }, [H]: { champ: "huntress", level: 7, x: 6, y: 9 } },
      casts: [{ tick: 3, by: MI, key: "W", target: V }],
      damage: Array.from({ length: 10 }, (_, i) => ({ tick: 3 + i, source: H, target: V, raw: 190 })) });
    const hx = r.status(V, "hex")[0]!;
    const pk = r.skillHits(H, V).filter((e) => e.skill_id === "scripted");
    const same = pk.find((e) => e.tick === hx.tick); const next = pk.find((e) => e.tick === hx.tick + 1);
    expect(same).toBeDefined(); expect(next).toBeDefined();
    expect(Math.abs(same!.mitigated - 190 * mit(66))).toBeLessThanOrEqual(0.02);
    expect(Math.abs(next!.mitigated - 190 * 1.12 * mit(66))).toBeLessThanOrEqual(0.02);
  });
});

/* ───────────────────────────────────────────── OQ-3 ───────────────────────────────────────────── */
describe("OQ-3 (Appendix R #2 L1899): Fear flees from the source at current MS after slows (fear adds no slow), clips and slides; Hex walks to the own-team centroid (or own pad) at MS×0.65; both skip the Unit Brain", () => {
  const A = "blue:mid" as UId, SRC = "red:mid" as UId;
  describe("Fear", () => {
    it("flees directly away from the source: from (8,8) with source at (12,8), x decreases, y stays, at Huntress MS 3.3 (no slow added)", () => {
      const r = run({ abs: true, T: 4, pos: true, units: { [A]: { champ: "huntress", level: 7, x: 8, y: 8 }, [SRC]: { champ: "torun", level: 7, x: 12, y: 8 } },
        cc: [{ tick: 5, target: A, kind: "fear", duration: 3.0, source: SRC }] });
      const ap = r.status(A, "fear")[0]!; expect(ap, "fear applied").toBeDefined();
      expect(r.status(A, "slow").length, "fear adds no slow").toBe(0);
      const t0 = ap.t + 0.3, t1 = ap.t + 1.3;
      const p0 = r.posAt(A, t0), p1 = r.posAt(A, t1);
      expect(p1.x, "flees −x, away from the source").toBeLessThan(p0.x - 2.0);
      expect(Math.abs(p1.y - p0.y), "no sideways component").toBeLessThan(0.3);
      expect(Math.abs(meanSpeed(r, A, t0, t1) - MS_H)).toBeLessThanOrEqual(0.25);
    });
    it("clips and slides along a pillar face: fleeing +x from (16, 3.3) into the NE pillar (tiles x 17-18, y 2-3) does not enter the pillar, and y then changes along the face", () => {
      const r = run({ abs: true, T: 5, pos: true, units: { [A]: { champ: "huntress", level: 7, x: 16, y: 3.3 }, [SRC]: { champ: "torun", level: 7, x: 11, y: 3.3 } },
        cc: [{ tick: 5, target: A, kind: "fear", duration: 4.0, source: SRC }] });
      const ap = r.status(A, "fear")[0]!;
      const path = r.series(A).filter((p) => p.t >= ap.t && p.t <= ap.t + ap.applied_duration);
      expect(path.length).toBeGreaterThan(5);
      for (const p of path) {
        const inside = p.x >= 17 && p.x <= 19 && p.y >= 2 && p.y <= 4;
        expect(inside, `entered the NE pillar at (${p.x.toFixed(2)},${p.y.toFixed(2)})`).toBe(false);
      }
      const atFace = path.filter((p) => p.x >= 16.7 && p.x <= 17.05);
      expect(atFace.length, "reaches the west face").toBeGreaterThan(0);
      const ys = atFace.map((p) => p.y);
      expect(Math.max(...ys) - Math.min(...ys), "slides along the face (y changes)").toBeGreaterThan(0.3);
    });
    it("a scripted motor toward the source is ignored (Unit Brain skipped): still flees away", () => {
      const r = run({ abs: true, T: 4, pos: true, units: { [A]: { champ: "huntress", level: 7, x: 8, y: 8 }, [SRC]: { champ: "torun", level: 7, x: 12, y: 8 } },
        motor: { [A]: { to: [[14, 8]] } }, cc: [{ tick: 5, target: A, kind: "fear", duration: 3.0, source: SRC }] });
      const ap = r.status(A, "fear")[0]!;
      const p0 = r.posAt(A, ap.t + 0.2), p1 = r.posAt(A, ap.t + 1.2);
      expect(p1.x, "not walking toward the source / waypoint").toBeLessThan(p0.x - 1.5);
    });
    it("cannot cast or auto while feared (L450, L1899)", () => {
      const r = run({ abs: true, T: 5, units: { [A]: { champ: "huntress", level: 7, x: 8, y: 8, auto: true }, [SRC]: { champ: "torun", level: 7, x: 12, y: 8 } },
        cc: [{ tick: 5, target: A, kind: "fear", duration: 3.0, source: SRC }], casts: [{ tick: 12, by: A, key: "Q", aim: [12, 8] }] });
      const ap = r.status(A, "fear")[0]!; const end = ap.t + ap.applied_duration;
      expect(r.casts(A, "Q").filter((c) => c.t >= ap.t && c.t < end - 0.05).length).toBe(0);
      expect(r.autoHits(A, ap.t, end - 0.05).length).toBe(0);
    });
  });

  describe("Hex", () => {
    it("moves toward the own-team living-ally centroid at MS×0.65: allies clustered at (8,12), unit at (8,6) walks +y, not toward the pad at (1,7)", () => {
      const r = run({ abs: true, T: 5, pos: true, units: {
        [A]: { champ: "huntress", level: 7, x: 8, y: 6 },
        "blue:adc": { champ: "ysol", level: 7, x: 7, y: 12 },
        "blue:support": { champ: "saelo", level: 7, x: 9, y: 12 },
        "blue:top": { champ: "torun", level: 7, x: 8, y: 11 },
        "blue:jungle": { champ: "sedge", level: 7, x: 8, y: 13 },
        [SRC]: { champ: "mirren", level: 7, x: 11, y: 6 },
      }, casts: [{ tick: 5, by: SRC, key: "W", target: A }] });
      const hx = r.status(A, "hex")[0]!; expect(hx, "hex applied").toBeDefined();
      const t0 = hx.t + 0.3, t1 = hx.t + 1.3;
      const p0 = r.posAt(A, t0), p1 = r.posAt(A, t1);
      expect(p1.y, "walks +y toward the ally centroid at y=12").toBeGreaterThan(p0.y + 1.0);
      expect(p1.x, "does not walk toward the pad (x=1)").toBeGreaterThan(6.5);
      expect(Math.abs(meanSpeed(r, A, t0, t1) - MS_H * 0.65)).toBeLessThanOrEqual(0.25);
    });
    it("with no living allies, walks toward the own spawn pad (1, 7)", () => {
      const r = run({ abs: true, T: 6, pos: true, units: {
        [A]: { champ: "huntress", level: 7, x: 8, y: 10, hp: 400 },
        "blue:adc": { champ: "ysol", level: 7, x: 8, y: 4, hp: 1 },
        "blue:support": { champ: "saelo", level: 7, x: 7, y: 4, hp: 1 },
        "blue:top": { champ: "torun", level: 7, x: 9, y: 4, hp: 1 },
        "blue:jungle": { champ: "sedge", level: 7, x: 8, y: 3, hp: 1 },
        [SRC]: { champ: "mirren", level: 7, x: 11, y: 10 },
        [V]: { champ: "torun", level: 7, x: 11, y: 4 },
      }, damage: [
        { tick: 1, source: V, target: "blue:adc" as UId, raw: 9999 },
        { tick: 1, source: V, target: "blue:support" as UId, raw: 9999 },
        { tick: 1, source: V, target: "blue:top" as UId, raw: 9999 },
        { tick: 1, source: V, target: "blue:jungle" as UId, raw: 9999 },
      ], casts: [{ tick: 15, by: SRC, key: "W", target: A }] });
      expect(r.of("death", (e) => String(e.unit_id).startsWith("blue:") && e.unit_id !== A).length).toBe(4);
      const hx = r.status(A, "hex")[0]!; expect(hx).toBeDefined();
      const p0 = r.posAt(A, hx.t + 0.3), p1 = r.posAt(A, hx.t + 1.5);
      // pad (1,7) from (8,10): −x, −y
      expect(p1.x, "walks toward pad x=1").toBeLessThan(p0.x - 0.8);
      expect(p1.y, "walks toward pad y=7").toBeLessThan(p0.y - 0.2);
    });
    it("cannot use skills or autos (L1899, L747)", () => {
      const r = run({ abs: true, T: 5, units: { [A]: { champ: "huntress", level: 7, x: 8, y: 8, auto: true }, [SRC]: { champ: "mirren", level: 7, x: 11, y: 8 }, "blue:adc": { champ: "ysol", level: 7, x: 6, y: 8 } },
        casts: [{ tick: 5, by: SRC, key: "W", target: A }, { tick: 12, by: A, key: "Q", aim: [11, 8] }] });
      const hx = r.status(A, "hex")[0]!; const end = hx.t + hx.applied_duration;
      expect(r.casts(A, "Q").filter((c) => c.t >= hx.t && c.t < end - 0.05).length).toBe(0);
      expect(r.autoHits(A, hx.t, end - 0.05).length).toBe(0);
    });
    it("a scripted motor away from the centroid is ignored (Unit Brain skipped)", () => {
      const r = run({ abs: true, T: 5, pos: true, units: {
        [A]: { champ: "huntress", level: 7, x: 8, y: 6 },
        "blue:adc": { champ: "ysol", level: 7, x: 8, y: 12 },
        "blue:support": { champ: "saelo", level: 7, x: 8, y: 12 },
        [SRC]: { champ: "mirren", level: 7, x: 11, y: 6 },
      }, motor: { [A]: { to: [[8, 1]] } }, casts: [{ tick: 5, by: SRC, key: "W", target: A }] });
      const hx = r.status(A, "hex")[0]!;
      const p0 = r.posAt(A, hx.t + 0.2), p1 = r.posAt(A, hx.t + 1.2);
      expect(p1.y, "walks toward the allies at y=12, not the waypoint at y=1").toBeGreaterThan(p0.y + 0.8);
    });
  });
});

/* ───────────────────────────────────────────── OQ-4 ───────────────────────────────────────────── */
describe("OQ-4 (Appendix R #2 L1900): cone angles are the full angle (70° = ±35°); a unit is hit if its r=0.4 body circle intersects the sector", () => {
  const C = "blue:mid" as UId;
  const rad = (d: number) => d * Math.PI / 180;
  const at = (cx: number, cy: number, ang: number, d: number): [number, number] => [cx + d * Math.cos(rad(ang)), cy + d * Math.sin(rad(ang))];
  it("Rhedan Q (70° / range 3.0, L768): primary and a unit on the +35° ray are hit; a unit 46° off-axis at d=2.0 is still hit (body intersects the sector, asin(0.4/2)≈11.5°); a unit at 50° is not", () => {
    const units: Scenario["units"] = {
      [C]: { champ: "rhedan", level: 7, x: 8, y: 8 },
      "red:mid": { champ: "torun", level: 7, x: 10, y: 8 },                         // primary, on-axis
      "red:adc": { champ: "torun", level: 7, ...{ x: at(8, 8, 35, 2.0)[0], y: at(8, 8, 35, 2.0)[1] } },
      "red:top": { champ: "torun", level: 7, ...{ x: at(8, 8, 46, 2.0)[0], y: at(8, 8, 46, 2.0)[1] } },
      "red:jungle": { champ: "torun", level: 7, ...{ x: at(8, 8, 50, 2.0)[0], y: at(8, 8, 50, 2.0)[1] } },
      "red:support": { champ: "torun", level: 7, x: 8, y: 10.5 },                   // 90° off, miss
    };
    const r = run({ abs: true, T: 3, units, casts: [{ tick: 5, by: C, key: "Q", target: "red:mid" }] });
    expect(r.skillHits(C, "red:mid").length, "primary").toBe(1);
    expect(r.skillHits(C, "red:adc").length, "on the +35° ray (full-angle edge)").toBe(1);
    expect(r.skillHits(C, "red:top").length, "46°: body intersects the +35° ray").toBe(1);
    expect(r.skillHits(C, "red:jungle").length, "50°: body misses the sector").toBe(0);
    expect(r.skillHits(C, "red:support").length, "90° off").toBe(0);
  });
  it("Rhedan Q range edge uses the body: a unit on-axis at 3.3 (range+0.3) is hit, at 3.5 (range+0.5) is not", () => {
    const r = run({ abs: true, T: 3, units: { [C]: { champ: "rhedan", level: 7, x: 8, y: 8 }, "red:mid": { champ: "torun", level: 7, x: 10, y: 8 },
      "red:adc": { champ: "torun", level: 7, x: 8 + 3.3, y: 8 }, "red:top": { champ: "torun", level: 7, x: 8 + 3.5, y: 8 } },
      casts: [{ tick: 5, by: C, key: "Q", target: "red:mid" }] });
    expect(r.skillHits(C, "red:adc").length, "range+0.3").toBe(1);
    expect(r.skillHits(C, "red:top").length, "range+0.5").toBe(0);
  });
  it("Calder Q (60° = ±30°, range 6.4, L703): a unit on the +30° ray at d=3 is hit; one at 45° is not; body at 30°+asin(0.4/3)≈37.7° is the edge — 36° hits, 42° misses", () => {
    const r = run({ abs: true, T: 3, units: { [C]: { champ: "calder", level: 7, x: 8, y: 8 },
      "red:mid": { champ: "torun", level: 7, x: at(8, 8, 0, 3)[0], y: at(8, 8, 0, 3)[1] },
      "red:adc": { champ: "torun", level: 7, x: at(8, 8, 30, 3)[0], y: at(8, 8, 30, 3)[1] },
      "red:top": { champ: "torun", level: 7, x: at(8, 8, 36, 3)[0], y: at(8, 8, 36, 3)[1] },
      "red:jungle": { champ: "torun", level: 7, x: at(8, 8, 42, 3)[0], y: at(8, 8, 42, 3)[1] },
      "red:support": { champ: "torun", level: 7, x: at(8, 8, 45, 3)[0], y: at(8, 8, 45, 3)[1] } },
      casts: [{ tick: 5, by: C, key: "Q", aim: [14.4, 8] }] });
    expect(r.skillHits(C, "red:mid").length, "on-axis").toBe(1);
    expect(r.skillHits(C, "red:adc").length, "on the +30° ray").toBe(1);
    expect(r.skillHits(C, "red:top").length, "36° body intersects").toBe(1);
    expect(r.skillHits(C, "red:jungle").length, "42° body misses").toBe(0);
    expect(r.skillHits(C, "red:support").length, "45°").toBe(0);
  });
  it("Ysol Q (80° = ±40°, range 7.2, L810): a unit on the +40° ray is hit; one at 60° is not", () => {
    const r = run({ abs: true, T: 3, units: { [C]: { champ: "ysol", level: 7, x: 8, y: 8 },
      "red:mid": { champ: "torun", level: 7, x: 11, y: 8 },
      "red:adc": { champ: "torun", level: 7, x: at(8, 8, 40, 3)[0], y: at(8, 8, 40, 3)[1] },
      "red:top": { champ: "torun", level: 7, x: at(8, 8, 60, 3)[0], y: at(8, 8, 60, 3)[1] } },
      casts: [{ tick: 5, by: C, key: "Q", target: "red:mid" }] });
    expect(r.skillHits(C, "red:mid").length).toBe(1);
    expect(r.skillHits(C, "red:adc").length, "+40° ray").toBe(1);
    expect(r.skillHits(C, "red:top").length, "60°").toBe(0);
  });
});

/* ───────────────────────────────────────────── OQ-5 ───────────────────────────────────────────── */
describe("OQ-5 (Appendix R #2 L1901): a line hits if dist(centre, segment) ≤ width/2 + 0.4", () => {
  const C = "blue:mid" as UId;
  // Huntress Q: width 0.5 → half 0.25, threshold 0.65. Caster (8,8), aim +x, length 8, segment (8,8)→(16,8).
  it("Huntress Q (width 0.5, threshold 0.65): a unit at lateral 0.65 is hit; at 0.80 is not; at 0.60 (inside) is hit", () => {
    const r = run({ abs: true, T: 3, units: { [C]: { champ: "huntress", level: 7, x: 8, y: 8 },
      "red:mid": { champ: "torun", level: 7, x: 12, y: 8.60 },
      "red:adc": { champ: "torun", level: 7, x: 12, y: 8.65 },
      "red:top": { champ: "torun", level: 7, x: 12, y: 8.80 },
      "red:jungle": { champ: "torun", level: 7, x: 12, y: 7.35 } }, // other side, on the threshold
      casts: [{ tick: 5, by: C, key: "Q", aim: [16, 8] }] });
    expect(r.skillHits(C, "red:mid").length, "lateral 0.60").toBe(1);
    expect(r.skillHits(C, "red:adc").length, "lateral 0.65 (exactly width/2+0.4)").toBe(1);
    expect(r.skillHits(C, "red:top").length, "lateral 0.80").toBe(0);
    expect(r.skillHits(C, "red:jungle").length, "lateral −0.65").toBe(1);
  });
  it("Kerrig Q (width 0.45, threshold 0.625, stops at first): a lonely target at lateral 0.625 is hit; at 0.80 is not", () => {
    const hit = run({ abs: true, T: 3, units: { [C]: { champ: "kerrig", level: 7, x: 8, y: 8 }, "red:mid": { champ: "torun", level: 7, x: 12, y: 8.625 } }, casts: [{ tick: 5, by: C, key: "Q", aim: [14.5, 8] }] });
    const miss = run({ abs: true, T: 3, units: { [C]: { champ: "kerrig", level: 7, x: 8, y: 8 }, "red:mid": { champ: "torun", level: 7, x: 12, y: 8.80 } }, casts: [{ tick: 5, by: C, key: "Q", aim: [14.5, 8] }] });
    expect(hit.skillHits(C, "red:mid").length, "0.625").toBe(1);
    expect(miss.skillHits(C, "red:mid").length, "0.80").toBe(0);
  });
  it("Helvar W (width 2.0, threshold 1.4): a unit at lateral 1.4 is hit; at 1.6 is not", () => {
    const r = run({ abs: true, T: 3, units: { [C]: { champ: "helvar", level: 7, x: 8, y: 8 },
      "red:mid": { champ: "torun", level: 7, x: 12, y: 9.4 },
      "red:adc": { champ: "torun", level: 7, x: 12, y: 9.6 } },
      casts: [{ tick: 5, by: C, key: "W", aim: [16.5, 8] }] });
    expect(r.skillHits(C, "red:mid").length, "1.4").toBe(1);
    expect(r.skillHits(C, "red:adc").length, "1.6").toBe(0);
  });
});

/* ───────────────────────────────────────────── OQ-6 ───────────────────────────────────────────── */
describe("OQ-6 (Appendix R #2 L1902): point circles, mortars and dash end points clamp to max range along the aim line; lines always fire their full authored length", () => {
  const C = "blue:mid" as UId;
  it("Huntress R (point circle, range 7.5, r 2.6): aimed 12 tiles away lands at 7.5 along the aim line — a unit at the clamp point is hit, one at the far aim (4.5 away) is not", () => {
    const r = run({ abs: true, T: 3, units: { [C]: { champ: "huntress", level: 7, x: 8, y: 8 },
      "red:mid": { champ: "torun", level: 7, x: 15.5, y: 8 },   // 7.5 from caster
      "red:adc": { champ: "torun", level: 7, x: 20, y: 8 } },    // 12 from caster, 4.5 from land
      casts: [{ tick: 5, by: C, key: "R", aim: [20, 8] }] });
    expect(r.skillHits(C, "red:mid").length, "at the clamped land point").toBe(1);
    expect(r.skillHits(C, "red:adc").length, "at the unclamped aim").toBe(0);
  });
  it("Isra R (mortar, range 12, r 3.4, land delay 1.2): aimed 18 tiles away lands at 12 along the aim line", () => {
    const r = run({ abs: true, T: 4, units: { [C]: { champ: "isra", level: 7, x: 4, y: 8 },
      "red:mid": { champ: "torun", level: 7, x: 16, y: 8 },     // 12 from caster
      "red:adc": { champ: "torun", level: 7, x: 20.5, y: 8 } }, // 16.5 from caster, 4.5 from land (> 3.4+0.4)
      casts: [{ tick: 5, by: C, key: "R", aim: [22, 8] }] });
    const h = r.skillHits(C, "red:mid")[0]!; expect(h, "hit at the clamp point").toBeDefined();
    const c0 = r.casts(C, "R")[0]!; expect(h.t - c0.t).toBeGreaterThanOrEqual(1.7 - 1e-6); // 0.5 cast + 1.2 delay
    expect(r.skillHits(C, "red:adc").length, "far aim not in the clamped circle").toBe(0);
  });
  it("Tolle R (point, range 7, r 3.4, delay 0.8): aimed 12 tiles away lands at 7 along the aim line", () => {
    const r = run({ abs: true, T: 4, units: { [C]: { champ: "tolle", level: 7, x: 8, y: 8 },
      "red:mid": { champ: "torun", level: 7, x: 15, y: 8 },
      "red:adc": { champ: "torun", level: 7, x: 20, y: 8 } },
      casts: [{ tick: 5, by: C, key: "R", aim: [20, 8] }] });
    expect(r.skillHits(C, "red:mid").length).toBe(1);
    expect(r.skillHits(C, "red:adc").length).toBe(0);
  });
  it("Huntress W dash (2 tiles): aimed 10 tiles away, the caster ends 2 tiles along the aim line, at (10, 8)", () => {
    const r = run({ abs: true, T: 3, pos: true, units: { [C]: { champ: "huntress", level: 7, x: 8, y: 8 } }, casts: [{ tick: 5, by: C, key: "W", aim: [18, 8] }] });
    const p = r.posAt(C, 2.9);
    expect(Math.abs(p.x - 10), "clamped dash end").toBeLessThanOrEqual(0.15);
    expect(Math.abs(p.y - 8)).toBeLessThanOrEqual(0.15);
  });
  it("Isra W dash (2.5 tiles): aimed far +x, ends 2.5 tiles along the aim line", () => {
    const r = run({ abs: true, T: 3, pos: true, units: { [C]: { champ: "isra", level: 7, x: 8, y: 8 } }, casts: [{ tick: 5, by: C, key: "W", aim: [20, 8] }] });
    const p = r.posAt(C, 2.9);
    expect(Math.abs(p.x - 10.5)).toBeLessThanOrEqual(0.15);
    expect(Math.abs(p.y - 8)).toBeLessThanOrEqual(0.15);
  });
  it("Huntress Q (line, length 8): aimed only 3 tiles away STILL reaches a unit 7.5 along the same line (full authored length); a unit 10 along it is not hit (does not extend)", () => {
    const r = run({ abs: true, T: 3, units: { [C]: { champ: "huntress", level: 7, x: 8, y: 8 },
      "red:mid": { champ: "torun", level: 7, x: 15.5, y: 8 },
      "red:adc": { champ: "torun", level: 7, x: 18, y: 8 } },
      casts: [{ tick: 5, by: C, key: "Q", aim: [11, 8] }] });
    expect(r.skillHits(C, "red:mid").length, "7.5 along a short-aimed line").toBe(1);
    expect(r.skillHits(C, "red:adc").length, "beyond authored length").toBe(0);
  });
  it("Huntress Q aimed 12 tiles away still only extends 8 (a unit at 7.5 is hit, at 10 is not)", () => {
    const r = run({ abs: true, T: 3, units: { [C]: { champ: "huntress", level: 7, x: 8, y: 8 },
      "red:mid": { champ: "torun", level: 7, x: 15.5, y: 8 },
      "red:adc": { champ: "torun", level: 7, x: 18, y: 8 } },
      casts: [{ tick: 5, by: C, key: "Q", aim: [20, 8] }] });
    expect(r.skillHits(C, "red:mid").length).toBe(1);
    expect(r.skillHits(C, "red:adc").length).toBe(0);
  });
});

/* ───────────────────────────────────────────── OQ-7 ───────────────────────────────────────────── */
describe("OQ-7 (Appendix R #2 L1903): AUTO_WINDUP 0.25/AS and missile speed 18 are locked defaults (tunable 0.15–0.35 / 12–24)", () => {
  const A = "blue:adc" as UId, TGT = "red:mid" as UId;
  it("AS 0.5, target 4.5 tiles away: windup 0.50 s + travel 4.5/18 = 0.25 s → first auto lands at ≈ 0.75–0.85 (tick 0 is setup only)", () => {
    const r = run({ abs: true, T: 3, units: { [A]: { champ: "huntress", level: 7, x: 8, y: 8, auto: true, as: 0.5 }, [TGT]: { champ: "torun", level: 7, x: 12.5, y: 8 } } });
    const h = r.autoHits(A, 0, 3, TGT).filter((e) => !e.crit)[0]!;
    expect(h, "an auto landed").toBeDefined();
    const land = 0.5 + 4.5 / 18; // 0.75, plus up to one tick of start delay
    expect(h.t).toBeGreaterThanOrEqual(land - 0.05);
    expect(h.t).toBeLessThanOrEqual(land + 0.20);
  });
  it("the same auto with MISSILE_SPEED overridden to 9 (still inside 12–24 is not required of the override) takes twice the travel: lands ≈ 0.5 + 4.5/9 = 1.00", () => {
    const r = runConst({ abs: true, T: 3, units: { [A]: { champ: "huntress", level: 7, x: 8, y: 8, auto: true, as: 0.5 }, [TGT]: { champ: "torun", level: 7, x: 12.5, y: 8 } } }, { MISSILE_SPEED: 9 });
    const h = r.autoHits(A, 0, 3, TGT).filter((e) => !e.crit)[0]!;
    expect(h).toBeDefined();
    const land = 0.5 + 4.5 / 9; // 1.00
    expect(h.t).toBeGreaterThanOrEqual(land - 0.05);
    expect(h.t).toBeLessThanOrEqual(land + 0.20);
  });
  it("AUTO_WINDUP 0.15 (low end of the tunable range), AS 0.5, same 4.5-tile shot: land ≈ 0.30 + 0.25 = 0.55", () => {
    const r = runConst({ abs: true, T: 3, units: { [A]: { champ: "huntress", level: 7, x: 8, y: 8, auto: true, as: 0.5 }, [TGT]: { champ: "torun", level: 7, x: 12.5, y: 8 } } }, { AUTO_WINDUP: 0.15 });
    const h = r.autoHits(A, 0, 3, TGT).filter((e) => !e.crit)[0]!;
    expect(h).toBeDefined();
    const land = 0.15 / 0.5 + 4.5 / 18; // 0.55
    expect(h.t).toBeGreaterThanOrEqual(land - 0.05);
    expect(h.t).toBeLessThanOrEqual(land + 0.20);
  });
  it("constants_hash changes when AUTO_WINDUP or MISSILE_SPEED is overridden (they belong in the constants table)", () => {
    const h0 = constantsHash();
    expect(constantsHash({ AUTO_WINDUP: 0.15 })).not.toBe(h0);
    expect(constantsHash({ MISSILE_SPEED: 12 })).not.toBe(h0);
  });
});

/* ───────────────────────────────────────────── OQ-8 ───────────────────────────────────────────── */
describe("OQ-8 (Appendix R #2 L1904): Time-stop's own duration ticks down; it pauses every other timer on the unit; it counts toward the 7.5 s Lock budget", () => {
  const A = "blue:mid" as UId, B = "red:mid" as UId;
  it("own timer: a 3.0 s time-stop applied at t=0.5 expires at t=3.5; the unit is frozen until then and walks afterwards", () => {
    const r = run({ abs: true, T: 6, pos: true, units: { [A]: { champ: "huntress", level: 7, x: 8, y: 8 }, [B]: { champ: "torun", level: 7, x: 12, y: 8 } },
      motor: { [A]: { to: [[8, 14]] } }, cc: [{ tick: 5, target: A, kind: "timestop", duration: 3.0, source: B }] });
    const ap = r.status(A, "timestop")[0]!; expect(ap).toBeDefined();
    expect(ap.applied_duration).toBeCloseTo(3.0, 6);
    const ex = r.expires(A, "timestop");
    expect(ex.length).toBeGreaterThanOrEqual(1);
    expect(Math.abs(ex[ex.length - 1]!.t - (ap.t + 3.0))).toBeLessThanOrEqual(0.15);
    const p0 = r.posAt(A, ap.t + 0.2);
    expect(dist(r.posAt(A, ap.t + 2.8), p0), "frozen for the duration").toBeLessThan(0.05);
    expect(dist(r.posAt(A, 5.5), p0), "walks after it ends").toBeGreaterThan(0.5);
  });
  it("pauses other CC: stun 3.0 at t=0.2 + time-stop 2.0 at t=0.5 → stun expires at ≈ 5.2, not 3.2", () => {
    const r = run({ T: 8, units: { [A]: { champ: "huntress", level: 7, x: 6, y: 8 }, [B]: { champ: "torun", level: 7, x: 9, y: 8 } },
      cc: [{ tick: 2, target: A, kind: "stun", duration: 3.0, source: B }, { tick: 5, target: A, kind: "timestop", duration: 2.0, source: B }] });
    const st = r.status(A, "stun")[0]!, ts = r.status(A, "timestop")[0]!;
    const ex = r.expires(A, "stun"); expect(ex.length).toBeGreaterThanOrEqual(1);
    expect(Math.abs(ex[ex.length - 1]!.t - (st.t + st.applied_duration + ts.applied_duration))).toBeLessThanOrEqual(0.15);
  });
  it("pauses cooldown: Huntress Q (CD 8) at t=0.5, time-stop 2.0 at t=2.0 → not ready at t=8.6, ready at t=10.8", () => {
    const r = run({ T: 12, units: { [A]: { champ: "huntress", level: 7, x: 6, y: 8 }, [B]: { champ: "torun", level: 7, x: 9, y: 8 } },
      cc: [{ tick: 20, target: A, kind: "timestop", duration: 2.0, source: B }],
      casts: [{ tick: 5, by: A, key: "Q", aim: [9, 8] }, { tick: 86, by: A, key: "Q", aim: [9, 8] }, { tick: 108, by: A, key: "Q", aim: [9, 8] }] });
    const cs = r.casts(A, "Q");
    expect(cs.filter((c) => Math.abs(c.t - 8.6) < 0.15).length, "refused at 8.6 (CD still paused leftover)").toBe(0);
    expect(cs.filter((c) => c.t >= 10.7).length, "accepted at 10.8").toBe(1);
  });
  it("pauses regen: Torun L7 9.7/s from 50% HP, time-stop 2.0 at t=0.2 → HP is flat until ≈2.2, then regen resumes", () => {
    const r = run({ T: 5, pos: true, units: { [A]: { champ: "torun", level: 7, x: 6, y: 8, hp: { frac: 0.5 } }, [B]: { champ: "huntress", level: 7, x: 9, y: 8 } },
      cc: [{ tick: 2, target: A, kind: "timestop", duration: 2.0, source: B }] });
    const startHp = maxHp("torun", 7) * 0.5;
    // no mid-run HP stream; use regen over the whole 5 s = 2 s paused + 3 s live ≈ 29.1, vs 5 s live ≈ 48.5
    const hp = r.unit(A).hp;
    expect(hp).toBeGreaterThan(startHp + 9.7 * 2.5);
    expect(hp).toBeLessThan(startHp + 9.7 * 4.2);
  });
  it("counts toward the 7.5 s Lock budget: time-stop 5.0 + time-stop 4.0 (applied 2.8 after DR) leave owed=7.8; a subsequent stun 2.0 is DR 0.49 then taper 0.35 → applied 0.343", () => {
    const r = run({ T: 6, units: { [A]: { champ: "huntress", level: 7, x: 6, y: 8 }, [B]: { champ: "torun", level: 7, x: 9, y: 8 } },
      cc: [
        { tick: 1, target: A, kind: "timestop", duration: 5.0, source: B },
        { tick: 2, target: A, kind: "timestop", duration: 4.0, source: B },
        { tick: 3, target: A, kind: "stun", duration: 2.0, source: B },
      ] });
    const ts = r.status(A, "timestop");
    expect(ts.length).toBe(2);
    expect(ts[0]!.applied_duration).toBeCloseTo(5.0, 6);
    expect(ts[1]!.applied_duration).toBeCloseTo(2.8, 6);
    const st = r.status(A, "stun")[0]!;
    expect(st.applied_duration).toBeCloseTo(2 * 0.49 * 0.35, 6);
    expect(st.lock_taper).toBe(true);
  });
});

/* ───────────────────────────────────────────── S0 constants ───────────────────────────────────────────── */
describe("S0 constants (Appendix R #2 L1905): SEPARATION_STRENGTH=2.0 joins the constants table (tunable 0–4, allies only, steering only); SCRIPTED_ARRIVE_R=0.15 is lab-only and stays out of constants_hash", () => {
  it("overriding SEPARATION_STRENGTH changes constants_hash (it is in the table, default 2.0)", () => {
    const h0 = constantsHash();
    expect(constantsHash({ SEPARATION_STRENGTH: 0 })).not.toBe(h0);
    expect(constantsHash({ SEPARATION_STRENGTH: 4 })).not.toBe(h0);
  });
  it("overriding SCRIPTED_ARRIVE_R does NOT change constants_hash (lab-only, out of the table)", () => {
    expect(constantsHash({ SCRIPTED_ARRIVE_R: 9 })).toBe(constantsHash());
    expect(constantsHash({ SCRIPTED_ARRIVE_R: 0.01 })).toBe(constantsHash());
  });
  it("two allies starting 0.15 tiles apart (inside the 0.6 radius) steer away from each other under the default strength 2.0", () => {
    const r = run({ abs: true, T: 2, pos: true, units: { "blue:mid": { champ: "huntress", level: 7, x: 5.00, y: 8 }, "blue:adc": { champ: "ysol", level: 7, x: 5.15, y: 8 } } });
    const d0 = dist(r.posAt("blue:mid", 0.1), r.posAt("blue:adc", 0.1));
    const d1 = dist(r.posAt("blue:mid", 1.9), r.posAt("blue:adc", 1.9));
    expect(d0).toBeLessThan(0.4);
    expect(d1, "allies separate").toBeGreaterThan(d0 + 0.15);
  });
  it("an ally and an enemy starting 0.15 tiles apart do not separate (ally-only)", () => {
    const r = run({ abs: true, T: 2, pos: true, units: { "blue:mid": { champ: "huntress", level: 7, x: 5.00, y: 8 }, "red:mid": { champ: "torun", level: 7, x: 5.15, y: 8 } } });
    const d0 = dist(r.posAt("blue:mid", 0.1), r.posAt("red:mid", 0.1));
    const d1 = dist(r.posAt("blue:mid", 1.9), r.posAt("red:mid", 1.9));
    expect(d1).toBeLessThan(d0 + 0.10);
  });
  it("SEPARATION_STRENGTH=0: the same two allies do not steer apart", () => {
    const r = runConst({ abs: true, T: 2, pos: true, units: { "blue:mid": { champ: "huntress", level: 7, x: 5.00, y: 8 }, "blue:adc": { champ: "ysol", level: 7, x: 5.15, y: 8 } } }, { SEPARATION_STRENGTH: 0 });
    const d0 = dist(r.posAt("blue:mid", 0.1), r.posAt("blue:adc", 0.1));
    const d1 = dist(r.posAt("blue:mid", 1.9), r.posAt("blue:adc", 1.9));
    expect(d1).toBeLessThan(d0 + 0.10);
  });
});
