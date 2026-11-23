/**
 * CC is ENFORCED by the loop (spec §6.5 L432-460, §4.3 phase 6/7 L141-142, §6.8 L506, M1 scope L1706).
 * CC is injected with the lab hook `scripted_cc` (goes through the real status engine: DR, budget, expiry) or comes from real casts.
 * Windows are taken from the sim's own status_apply/status_expire events, so DR cannot skew them.
 */
import { describe, expect, it } from "vitest";
import { ab } from "./_oracle.js";
import { dist, near, run, skillIs, type Scenario, type UId } from "./_harness.js";

const A = "blue:mid" as UId, B = "red:mid" as UId, C = "red:adc" as UId;
const LOCKS = ["stun", "knockup", "sleep", "fear", "banish", "timestop", "hex"] as const;
/** movement is spec'd to be 0 for these (L145 'hard-locked has velocity 0'); fear (L450 flees) and hex (L747 'also slows') are open questions, see README */
const FROZEN = ["stun", "knockup", "sleep", "banish", "timestop"] as const;

function base(extra: Partial<Scenario> = {}): Scenario {
  return { T: 7, pos: true,
    units: { [A]: { champ: "huntress", level: 7, x: 8, y: 8, auto: true }, [B]: { champ: "torun", level: 7, x: 11, y: 8 } },
    motor: { [A]: { to: [[8, 15]] } }, ...extra };
}
const win = (r: ReturnType<typeof run>, kind: string) => { const ap = r.status(A, kind)[0]!; return { ap, w0: ap.t, w1: ap.t + ap.applied_duration }; };

describe("a unit under Lock cannot cast (spec L452 'cannot use skills', L142 phase 7 'not locked')", () => {
  for (const kind of LOCKS) it(`${kind}: a cast attempted inside the window is refused, and the same cast works after it ends`, () => {
    const r = run(base({ cc: [{ tick: 5, target: A, kind, duration: 3.0, source: B }],
      casts: [{ tick: 12, by: A, key: "Q", aim: [11, 8] }, { tick: 55, by: A, key: "Q", aim: [11, 8] }] }));
    const { w0, w1 } = win(r, kind);
    const cs = r.casts(A, "Q");
    expect(cs.filter((c) => c.t > w0 - 1e-9 && c.t < w1 - 0.05).length, "no cast_start inside the window").toBe(0);
    expect(cs.filter((c) => c.t >= w1 - 1e-9).length, "the later cast is accepted (refused cast did not burn the cooldown)").toBe(1);
  });
});

describe("a unit under Lock cannot auto (spec L506 'not disarmed / locked / time-stopped')", () => {
  it("control: without CC the unit autos in the same span", () => {
    const r = run(base());
    expect(r.autoHits(A, 0.6, 3.4).length).toBeGreaterThanOrEqual(1);
  });
  for (const kind of LOCKS) it(`${kind}: zero auto hits while it lasts; autos resume afterwards`, () => {
    const r = run(base({ cc: [{ tick: 5, target: A, kind, duration: 3.0, source: B }] }));
    const { w0, w1 } = win(r, kind);
    expect(r.autoHits(A, w0 + 0.05, w1 - 0.05).length).toBe(0);
    expect(r.autoHits(A, w1 + 0.1, 7).length, "autos resume").toBeGreaterThanOrEqual(1);
  });
});

describe("Lock freezes movement; Root blocks movement, not casting/autos (spec L145, L458)", () => {
  it("control: the scripted walk moves ≥2 tiles in 1 s", () => {
    const r = run(base()); expect(dist(r.posAt(A, 1.2), r.posAt(A, 0.2))).toBeGreaterThan(2.0);
  });
  for (const kind of FROZEN) it(`${kind}: position is frozen for the whole window`, () => {
    const r = run(base({ cc: [{ tick: 5, target: A, kind, duration: 3.0, source: B }] }));
    const { w0, w1 } = win(r, kind);
    const p0 = r.posAt(A, w0 + 0.2);
    for (const t of [w0 + 0.7, w0 + 1.2, w1 - 0.2]) expect(dist(r.posAt(A, t), p0)).toBeLessThan(0.02);
    expect(dist(r.posAt(A, 6.9), p0), "walks again afterwards").toBeGreaterThan(0.3);
  });
  it("root: position frozen, but autos continue and a cast is accepted", () => {
    const r = run(base({ cc: [{ tick: 5, target: A, kind: "root", duration: 3.0, source: B }], casts: [{ tick: 12, by: A, key: "Q", aim: [11, 8] }] }));
    const { w0, w1 } = win(r, "root");
    const p0 = r.posAt(A, w0 + 0.2);
    for (const t of [w0 + 0.7, w0 + 1.2, w1 - 0.2]) expect(dist(r.posAt(A, t), p0)).toBeLessThan(0.02);
    expect(r.casts(A, "Q").length, "root does not stop casting").toBe(1);
    expect(r.autoHits(A, w0 + 0.05, w1).length, "root does not stop autos").toBeGreaterThanOrEqual(1);
  });
  it("root: a dash is blocked ('cannot move or dash') but the skill still applies (Maelis W still shields, L512)", () => {
    const r = run({ T: 4, pos: true, units: { [A]: { champ: "maelis", level: 7, x: 8, y: 8 } },
      cc: [{ tick: 2, target: A, kind: "root", duration: 3.0, source: B }], casts: [{ tick: 8, by: A, key: "W", aim: [14, 8] }] });
    expect(dist(r.posAt(A, 3.9), { x: 8, y: 8 })).toBeLessThan(0.05);
    expect(r.shields(A, A).length, "shield still applied").toBe(1);
  });
});

describe("Silence blocks casts, not autos; Disarm blocks autos, not casts (spec L458)", () => {
  it("silence: no cast inside the window, autos continue", () => {
    const r = run(base({ cc: [{ tick: 5, target: A, kind: "silence", duration: 3.0, source: B }], casts: [{ tick: 12, by: A, key: "Q", aim: [11, 8] }, { tick: 55, by: A, key: "Q", aim: [11, 8] }] }));
    const { w0, w1 } = win(r, "silence");
    expect(r.casts(A, "Q").filter((c) => c.t > w0 - 1e-9 && c.t < w1 - 0.05).length).toBe(0);
    expect(r.casts(A, "Q").filter((c) => c.t >= w1).length).toBe(1);
    expect(r.autoHits(A, w0 + 0.05, w1).length).toBeGreaterThanOrEqual(1);
  });
  it("disarm: zero autos inside the window, casts accepted", () => {
    const r = run(base({ cc: [{ tick: 5, target: A, kind: "disarm", duration: 3.0, source: B }], casts: [{ tick: 12, by: A, key: "Q", aim: [11, 8] }] }));
    const { w0, w1 } = win(r, "disarm");
    expect(r.autoHits(A, w0 + 0.05, w1 - 0.05).length).toBe(0);
    expect(r.casts(A, "Q").length).toBe(1);
    expect(r.autoHits(A, w1 + 0.1, 7).length).toBeGreaterThanOrEqual(1);
  });
  it("blind: autos deal no damage ('autos miss', L342, L458), skills still work", () => {
    const r = run(base({ cc: [{ tick: 5, target: A, kind: "blind", duration: 3.0, source: B }], casts: [{ tick: 12, by: A, key: "Q", aim: [11, 8] }] }));
    const { w0, w1 } = win(r, "blind");
    for (const h of r.autoHits(A, w0 + 0.05, w1)) expect(h.mitigated).toBe(0);
    expect(r.skillHits(A, B).length).toBe(1);
  });
});

describe("Taunt: cannot use skills; forced to auto the taunter (spec L452)", () => {
  it("taunted unit cannot cast", () => {
    const r = run(base({ cc: [{ tick: 5, target: A, kind: "taunt", duration: 3.0, source: B }], casts: [{ tick: 12, by: A, key: "Q", aim: [11, 8] }] }));
    const { w0, w1 } = win(r, "taunt");
    expect(r.casts(A, "Q").filter((c) => c.t > w0 - 1e-9 && c.t < w1 - 0.05).length).toBe(0);
  });
  it("taunted unit autos only the taunter even when another enemy is nearer", () => {
    const r = run({ T: 6, pos: true, units: { [A]: { champ: "huntress", level: 7, x: 8, y: 8, auto: true }, [B]: { champ: "torun", level: 7, x: 12, y: 8 }, [C]: { champ: "torun", level: 7, x: 9.5, y: 8 } },
      cc: [{ tick: 5, target: A, kind: "taunt", duration: 2.0, source: B }] });
    const { w0, w1 } = win(r, "taunt");
    const hs = r.autoHits(A, w0 + 0.1, w1);
    expect(hs.length).toBeGreaterThanOrEqual(1);
    for (const h of hs) expect(h.target_id).toBe(B);
  });
});

describe("Windup interaction: Lock cancels an in-progress cast, Silence cancels, Root/Disarm/Slow/Blind do not (spec §4.4 cast_cancel reasons L162, L458)", () => {
  const hr = (kind: string, d = 2.0) => run({ T: 4, units: { [A]: { champ: "huntress", level: 7, x: 6, y: 8 }, [B]: { champ: "torun", level: 7, x: 9, y: 8 } },
    casts: [{ tick: 5, by: A, key: "R", aim: [9, 8] }], cc: [{ tick: 8, target: A, kind, duration: d, source: B }] });
  for (const kind of ["stun", "knockup", "sleep", "fear", "banish", "hex"]) it(`${kind} mid-windup: cast_cancel(reason lock), no hit`, () => {
    const r = hr(kind);
    const cc = r.of("cast_cancel", (e) => e.unit_id === A);
    expect(cc.length).toBe(1); expect(cc[0]!.reason).toBe("lock");
    expect(r.skillHits(A, B).length).toBe(0);
  });
  it("silence mid-windup: cast_cancel(reason silence), no hit", () => {
    const r = hr("silence"); const cc = r.of("cast_cancel", (e) => e.unit_id === A);
    expect(cc.length).toBe(1); expect(cc[0]!.reason).toBe("silence"); expect(r.skillHits(A, B).length).toBe(0);
  });
  for (const kind of ["root", "disarm", "blind"]) it(`${kind} mid-windup: the cast completes and hits`, () => {
    const r = hr(kind); expect(r.of("cast_cancel", (e) => e.unit_id === A).length).toBe(0); expect(r.skillHits(A, B).length).toBe(1);
  });
  it("caster dies mid-windup: cast_cancel(reason death), no hit", () => {
    const r = run({ T: 4, units: { [A]: { champ: "huntress", level: 7, x: 6, y: 8, hp: 5 }, [B]: { champ: "torun", level: 7, x: 9, y: 8 } },
      casts: [{ tick: 5, by: A, key: "R", aim: [9, 8] }], damage: [{ tick: 8, source: B, target: A, raw: 500 }] });
    expect(r.of("death", (e) => e.unit_id === A).length).toBe(1);
    const cc = r.of("cast_cancel", (e) => e.unit_id === A); expect(cc.length).toBe(1); expect(cc[0]!.reason).toBe("death");
    expect(r.skillHits(A, B).length).toBe(0);
  });
});

describe("Slow: move speed × (1 − slow), strongest slow wins, no additive stacking (spec L458)", () => {
  const T = "red:mid" as UId;
  const walker = { champ: "torun", level: 7, x: 8, y: 5 }; const MS = 3.22; // Torun MS (spec L630 table)
  const mk = (casters: Record<string, { champ: string; x: number }>) => {
    const units: Scenario["units"] = { [T]: walker };
    const casts: Scenario["casts"] = [];
    for (const [id, c] of Object.entries(casters)) { units[id as UId] = { champ: c.champ, level: 7, x: c.x, y: 5 }; casts.push({ tick: 5, by: id as UId, key: "Q", aim: [13, 5] }); }
    return run({ T: 6, pos: true, units, casts, motor: { [T]: { to: [[22.5, 5]] } } });
  };
  const speedIn = (r: ReturnType<typeof run>, a: number, b: number) => r.speeds(T).filter((s) => s.t >= a && s.t <= b).map((s) => s.v);
  const cases: [string, number, number][] = [["saelo", 0.3, 1.2], ["brannoch", 0.35, 1.5]];
  for (const [champ, pct, dur] of cases) it(`${champ} Q: speed is ${(1 - pct) * 100}% of MS for ${dur}s, full MS before and after`, () => {
    const r = mk({ "blue:support": { champ, x: 5 } });
    const ap = r.status(T, "slow")[0]!; expect(ap, "slow status").toBeDefined();
    for (const v of speedIn(r, 0.2, ap.t - 0.15)) expect(near(v, MS, 0.03 * MS)).toBe(true);
    const during = speedIn(r, ap.t + 0.15, ap.t + dur - 0.15); expect(during.length).toBeGreaterThan(3);
    for (const v of during) expect(near(v, MS * (1 - pct), 0.03 * MS)).toBe(true);
    const after = speedIn(r, ap.t + dur + 0.3, ap.t + dur + 1.0); expect(after.length).toBeGreaterThan(3);
    for (const v of after) expect(near(v, MS, 0.03 * MS)).toBe(true);
  });
  it("30% (Saelo, applied last) + 35% (Brannoch, applied first) overlap: speed is ×0.65 — the max, not the sum (×0.35), not the last (×0.70)", () => {
    const r = mk({ "blue:top": { champ: "brannoch", x: 6 }, "blue:support": { champ: "saelo", x: 5 } });
    const sl = r.status(T, "slow"); expect(sl.length).toBe(2);
    const lo = Math.max(...sl.map((s) => s.t)) + 0.15, hi = Math.min(...sl.map((s) => s.t + s.applied_duration)) - 0.15;
    expect(hi).toBeGreaterThan(lo);
    for (const v of speedIn(r, lo, hi)) expect(near(v, MS * 0.65, 0.03 * MS)).toBe(true);
  });
});

describe("Leash (Kerrig Q): target cannot move farther than 3.5 tiles from the caster; pulled to the ring (spec L454)", () => {
  it("leashed walker is held at ≈3.5 from Kerrig for 2.8 s, then walks free", () => {
    const r = run({ T: 7, pos: true, units: { [A]: { champ: "kerrig", level: 7, x: 6, y: 8 }, [B]: { champ: "torun", level: 7, x: 8, y: 8 } },
      casts: [{ tick: 5, by: A, key: "Q", aim: [8, 8] }], motor: { [B]: { to: [[20, 8]] } } });
    const ap = r.status(B, "leash")[0]!; expect(ap).toBeDefined();
    expect(ap.applied_duration).toBeCloseTo(2.8, 6);
    const K = { x: 6, y: 8 };
    for (let t = ap.t + 0.3; t < ap.t + 2.7; t += 0.2) { const d = dist(r.posAt(B, t), K); expect(d).toBeLessThanOrEqual(3.5 + 0.1); }
    expect(dist(r.posAt(B, ap.t + 1.5), K)).toBeGreaterThan(3.3);
    expect(dist(r.posAt(B, ap.t + 2.8 + 0.8), K)).toBeGreaterThan(4.0);
  });
});
