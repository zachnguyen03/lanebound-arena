/** M1 tests 10, 11, 12, 18, 19 + sleep-break, dispels, banish, time-stop (spec §6.5-6.7 L432-502, M1 L1718-1724). */
import { describe, expect, it } from "vitest";
import { ab, rawDamage } from "./_oracle.js";
import { dist, lazy, run, skillIs, type Scenario, type UId } from "./_harness.js";

const V = "red:mid" as UId, S1 = "blue:mid" as UId;
const cc = (tick: number, kind: string, duration: number, source: UId = "blue:support") => ({ tick, target: V, kind, duration, source });
const applies = (r: ReturnType<typeof run>, kind?: string | string[]) => r.status(V, kind);
const vic = (extra: Partial<Scenario> = {}): Scenario => ({ T: 12, units: { [V]: { champ: "torun", level: 7, x: 12, y: 8 } }, ...extra });

describe("M1-18 DR: three stuns in 5 s apply d, 0.70d, 0.49d (spec L466-475, L1723)", () => {
  it("scripted: raw 2.0 each at t≈1,2,3 → applied 2.0, 1.4, 0.98", () => {
    const r = run(vic({ cc: [cc(10, "stun", 2.0), cc(20, "stun", 2.0), cc(30, "stun", 2.0)] }));
    const a = applies(r, "stun"); expect(a.length).toBe(3);
    expect(a.map((e) => e.raw_duration)).toEqual([2.0, 2.0, 2.0]);
    expect(a[0]!.applied_duration).toBeCloseTo(2.0, 6); expect(a[1]!.applied_duration).toBeCloseTo(1.4, 6); expect(a[2]!.applied_duration).toBeCloseTo(0.98, 6);
    expect(a.every((e) => e.category === "lock")).toBe(true);
  });
  it("real casts: Tolle Q (stun 0.9) → Torun R (stun 1.25) → Brannoch R (stun 1.6) within 5 s: 1.0, 0.70, 0.49 × raw", () => {
    const mk = (id: UId, champ: string, x: number, y: number) => ({ champ, level: 7, x, y });
    const r = run({ T: 8, units: { [V]: mk(V, "huntress", 12, 8), "blue:jungle": mk("blue:jungle", "tolle", 10.4, 8), "blue:top": mk("blue:top", "torun", 9, 8), "blue:support": mk("blue:support", "brannoch", 11, 9.2) },
      casts: [{ tick: 5, by: "blue:jungle", key: "Q", target: V }, { tick: 15, by: "blue:top", key: "R", aim: [12, 8] }, { tick: 25, by: "blue:support", key: "R", aim: [12, 8] }] });
    const a = applies(r, ["stun", "petrify"]); expect(a.length).toBe(3);
    const raws = [0.9, 1.25, 1.6], f = [1, 0.7, 0.49];
    a.forEach((e, i) => { expect(e.raw_duration).toBeCloseTo(raws[i]!, 6); expect(e.applied_duration).toBeCloseTo(raws[i]! * f[i]!, 6); });
  });
  it("DR is per category: Lock, Bind, Handicap each start at factor 1 (L466)", () => {
    const r = run(vic({ cc: [cc(10, "stun", 2.0), cc(12, "root", 2.0), cc(14, "silence", 2.0)] }));
    for (const k of ["stun", "root", "silence"]) expect(applies(r, k)[0]!.applied_duration).toBeCloseTo(2.0, 6);
  });
  it("factor floors at 0.35: five handicaps in 5 s → 2.0, 1.4, 0.98, 0.70, 0.70 (max(0.35, 0.7^n), L471)", () => {
    const r = run(vic({ cc: [10, 15, 20, 25, 30].map((t) => cc(t, "silence", 2.0)) }));
    expect(applies(r, "silence").map((e) => +e.applied_duration.toFixed(4))).toEqual([2.0, 1.4, 0.98, 0.7, 0.7]);
  });
  it("the DR window is 5.0 s: a stun 5.2 s after the first counts as n=0 again; one 1 s later is n=1 (0.70)", () => {
    const r = run(vic({ T: 10, cc: [cc(1, "stun", 1.0), cc(53, "stun", 1.0), cc(63, "stun", 1.0)] }));
    const a = applies(r, "stun");
    expect(a.map((e) => +e.applied_duration.toFixed(4))).toEqual([1.0, 1.0, 0.7]);
  });
  it("same-kind overlap: remaining becomes max(remaining, new), not the sum (L489)", () => {
    const r = run(vic({ cc: [cc(10, "stun", 2.0), cc(20, "stun", 2.0)] }));
    const [a1, a2] = applies(r, "stun");
    const ex = r.expires(V, "stun"); expect(ex.length).toBeGreaterThanOrEqual(1);
    const expectedEnd = Math.max(a1!.t + a1!.applied_duration, a2!.t + a2!.applied_duration);
    expect(Math.abs(ex[ex.length - 1]!.t - expectedEnd), "the stun ends at max(remaining, new), not at their sum").toBeLessThanOrEqual(0.15);
  });
  it("Knockback/pull are displacements and do not consume DR (L460): Helvar R then two stuns still get factor 1, 0.7", () => {
    const r = run({ T: 8, units: { [V]: { champ: "torun", level: 7, x: 10, y: 8 }, "blue:mid": { champ: "helvar", level: 7, x: 6, y: 8 } }, casts: [{ tick: 5, by: "blue:mid", key: "R", aim: [10, 8] }],
      cc: [cc(30, "stun", 2.0, "blue:support"), cc(40, "stun", 2.0, "blue:support")] });
    expect(applies(r, "stun").map((e) => +e.applied_duration.toFixed(4))).toEqual([2.0, 1.4]);
  });
});

describe("M1-19 Lock budget: lock_owed ≥ 7.5 (applied Lock in the trailing 7.5 s) multiplies the new apply by 0.35 after DR (spec L477-487, L1724)", () => {
  it("stun 4.0 @0.1, stun 4.0 @5.3 (no DR, owed 4.0 < 7.5 → no taper), stun 4.0 @6.3 (DR 0.7, owed 8.0 ≥ 7.5 → ×0.35): 4.0, 4.0, 0.98", () => {
    const r = run(vic({ T: 14, cc: [cc(1, "stun", 4.0), cc(53, "stun", 4.0), cc(63, "stun", 4.0)] }));
    const a = applies(r, "stun"); expect(a.length).toBe(3);
    expect(a[0]!.applied_duration).toBeCloseTo(4.0, 6); expect(a[0]!.lock_taper).toBe(false);
    expect(a[1]!.applied_duration).toBeCloseTo(4.0, 6); expect(a[1]!.lock_taper).toBe(false);
    expect(a[2]!.applied_duration).toBeCloseTo(4.0 * 0.7 * 0.35, 6); expect(a[2]!.lock_taper).toBe(true);
  });
  it("different Lock kinds share the budget (stun + fear + knockup + sleep all count, L485)", () => {
    // owed: stun 4.0 (t=.1) then fear 4.0 at t=5.3 → 4.0 → owed 8.0; knockup at 6.3 → DR n=1 (0.7), taper ×0.35
    const r = run(vic({ T: 14, cc: [cc(1, "stun", 4.0), cc(53, "fear", 4.0), cc(63, "knockup", 4.0)] }));
    const a = applies(r, ["stun", "fear", "knockup"]);
    expect(a.map((e) => +e.applied_duration.toFixed(4))).toEqual([4.0, 4.0, +(4.0 * 0.7 * 0.35).toFixed(4)]);
    expect(a[2]!.lock_taper).toBe(true);
  });
  it("Bind and Handicap do not feed the Lock budget (L485)", () => {
    const r = run(vic({ T: 14, cc: [cc(1, "root", 4.0), cc(53, "silence", 4.0), cc(63, "stun", 4.0)] }));
    const s = applies(r, "stun")[0]!; expect(s.applied_duration).toBeCloseTo(4.0, 6); expect(s.lock_taper).toBe(false);
  });
});

describe("M1-10 Sedge R sleeps allies except the caster; Ysol W strong-dispels; Saelo W basic-dispel does not remove sleep (spec L619, L498-500, L1711)", () => {
  const units = (): Scenario["units"] => ({
    "blue:jungle": { champ: "sedge", level: 7, x: 6, y: 8 },
    "blue:mid": { champ: "torun", level: 7, x: 10, y: 8 },      // ally in radius
    "blue:adc": { champ: "torun", level: 7, x: 10.8, y: 9 },    // ally in radius
    "red:mid": { champ: "torun", level: 7, x: 10, y: 7 },       // enemy in radius
    "blue:support": { champ: "ysol", level: 7, x: 7, y: 11 },
    "blue:top": { champ: "saelo", level: 7, x: 7, y: 5 },
  });
  const R = (extra: Partial<Scenario> = {}) => run({ T: 8, units: units(), casts: [{ tick: 5, by: "blue:jungle", key: "R", aim: [7, 8] }, ...(extra.casts ?? [])], ...(extra.cc ? { cc: extra.cc } : {}) });
  it("sleeps both allies and the enemy in r=3.8 (2.8 s, Lock) and never the caster", () => {
    const r = R();
    for (const id of ["blue:mid", "blue:adc", "red:mid"] as UId[]) { const a = r.status(id, "sleep"); expect(a.length, id).toBe(1); expect(a[0]!.raw_duration).toBeCloseTo(2.8, 6); }
    expect(r.status("blue:jungle").length).toBe(0);
  });
  it("Ysol W (strong dispel) removes the sleep early: dispel event strength=strong lists sleep; sleep ends before 2.8 s", () => {
    const r = R({ casts: [{ tick: 15, by: "blue:support", key: "W", target: "blue:mid" }] });
    const d = r.of("dispel", (e) => e.target_id === "blue:mid"); expect(d.length).toBeGreaterThanOrEqual(1);
    expect(d[0]!.strength).toBe("strong"); expect(d[0]!.removed).toContain("sleep");
    const ap = r.status("blue:mid", "sleep")[0]!; const ex = r.expires("blue:mid", "sleep")[0]!;
    expect(ex.t - ap.t).toBeLessThan(2.0);
  });
  it("Saelo W (basic dispel) does NOT remove the sleep: it runs its natural 2.8 s", () => {
    const r = R({ casts: [{ tick: 15, by: "blue:top", key: "W", target: "blue:mid" }] });
    const d = r.of("dispel", (e) => e.target_id === "blue:mid"); expect(d.length).toBeGreaterThanOrEqual(1);
    expect(d[0]!.strength).toBe("basic"); expect(d[0]!.removed).not.toContain("sleep");
    const ap = r.status("blue:mid", "sleep")[0]!; const ex = r.expires("blue:mid", "sleep")[0]!;
    expect(Math.abs(ex.t - ap.t - 2.8)).toBeLessThanOrEqual(0.15);
  });
});

describe("Dispel rules (spec L498-502)", () => {
  const dispelRun = (healer: "ysol" | "saelo", kinds: [string, number][]) => run({ T: 6, units: { "blue:support": { champ: healer, level: 7, x: 6, y: 8 }, "blue:adc": { champ: "torun", level: 7, x: 9, y: 8, hp: { frac: 0.5 } }, "red:mid": { champ: "torun", level: 7, x: 14, y: 8 } },
    cc: kinds.map(([k, d]) => ({ tick: 2, target: "blue:adc" as UId, kind: k, duration: d, source: "red:mid" as UId })), casts: [{ tick: 10, by: "blue:support", key: "W", target: "blue:adc" }] });
  it("basic removes Handicap (silence) but not Lock (stun) or Bind (root)", () => {
    const r = dispelRun("saelo", [["silence", 4], ["stun", 4], ["root", 4]]);
    const d = r.of("dispel", (e) => e.target_id === "blue:adc")[0]!; expect(d.strength).toBe("basic");
    expect(d.removed).toContain("silence"); expect(d.removed).not.toContain("stun"); expect(d.removed).not.toContain("root");
  });
  it("strong removes Lock, Bind and Handicap (stun, fear, root, silence) …", () => {
    const r = dispelRun("ysol", [["stun", 4], ["root", 4], ["silence", 4]]);
    const d = r.of("dispel", (e) => e.target_id === "blue:adc")[0]!; expect(d.strength).toBe("strong");
    for (const k of ["stun", "root", "silence"]) expect(d.removed).toContain(k);
  });
  it("… except knockup, banish and time-stop (L500)", () => {
    for (const k of ["knockup", "banish", "timestop"]) {
      const r = dispelRun("ysol", [[k, 4]]);
      const d = r.of("dispel", (e) => e.target_id === "blue:adc"); const removed = d.flatMap((e) => e.removed as string[]);
      expect(removed, k).not.toContain(k);
      const ap = r.status("blue:adc", k)[0]!; const ex = r.expires("blue:adc", k)[0];
      expect(ex && ex.t < ap.t + ap.applied_duration - 0.5, `${k} must run its natural duration`).toBeFalsy();
    }
  });
  it("a removed stun really ends: the unit can cast right after a strong dispel", () => {
    const r = run({ T: 6, units: { "blue:support": { champ: "ysol", level: 7, x: 6, y: 8 }, "blue:adc": { champ: "huntress", level: 7, x: 9, y: 8 }, "red:mid": { champ: "torun", level: 7, x: 12, y: 8 } },
      cc: [{ tick: 2, target: "blue:adc", kind: "stun", duration: 4.0, source: "red:mid" }], casts: [{ tick: 10, by: "blue:support", key: "W", target: "blue:adc" }, { tick: 20, by: "blue:adc", key: "Q", aim: [12, 8] }] });
    expect(r.casts("blue:adc", "Q").length).toBe(1);
  });
  it("basic dispel removes silence: the silenced unit can cast right after Saelo W", () => {
    const r = run({ T: 6, units: { "blue:support": { champ: "saelo", level: 7, x: 6, y: 8 }, "blue:adc": { champ: "huntress", level: 7, x: 9, y: 8 }, "red:mid": { champ: "torun", level: 7, x: 12, y: 8 } },
      cc: [{ tick: 2, target: "blue:adc", kind: "silence", duration: 4.0, source: "red:mid" }], casts: [{ tick: 10, by: "blue:support", key: "W", target: "blue:adc" }, { tick: 20, by: "blue:adc", key: "Q", aim: [12, 8] }] });
    expect(r.casts("blue:adc", "Q").length).toBe(1);
  });
});

describe("Sleep breaks when the sleeper loses HP AFTER shields; a fully absorbed hit does not (spec L442)", () => {
  const units = (): Scenario["units"] => ({ [V]: { champ: "torun", level: 7, x: 12, y: 8 }, "blue:jungle": { champ: "torun", level: 7, x: 11, y: 10 }, "blue:mid": { champ: "maelis", level: 7, x: 7, y: 8 }, "blue:adc": { champ: "huntress", level: 7, x: 7, y: 6.5 } });
  it("unshielded: the first damaging hit breaks sleep (sleep_break event, status ends)", () => {
    const r = run({ T: 4, units: units(), cc: [{ tick: 2, target: V, kind: "sleep", duration: 3.0, source: "blue:support" }], casts: [{ tick: 8, by: "blue:mid", key: "Q", aim: [12, 8] }] });
    const sb = r.of("sleep_break", (e) => e.target_id === V); expect(sb.length).toBe(1); expect(sb[0]!.source_id).toBe("blue:mid");
    const ex = r.expires(V, "sleep")[0]!; expect(ex.t).toBeLessThan(1.6);
  });
  it("shield 219.2 (Torun W) absorbs Maelis Q (171.0 mitigated) fully → no sleep_break; Huntress Q then exceeds the remaining shield → sleep_break", () => {
    const r = run({ T: 4, units: units(), cc: [{ tick: 2, target: V, kind: "sleep", duration: 3.0, source: "blue:support" }],
      casts: [{ tick: 3, by: "blue:jungle", key: "W", target: V }, { tick: 10, by: "blue:mid", key: "Q", aim: [12, 8] }, { tick: 18, by: "blue:adc", key: "Q", aim: [12, 8] }] });
    const hits = r.skillHits(undefined, V);
    const mq = hits.find((h) => h.source_id === "blue:mid")!, hq = hits.find((h) => h.source_id === "blue:adc")!;
    expect(mq.hp_after, "first hit fully absorbed").toBeCloseTo(1720, 3); expect(mq.shield_absorbed).toBeCloseTo(mq.mitigated, 6);
    const sb = r.of("sleep_break", (e) => e.target_id === V); expect(sb.length).toBe(1);
    expect(sb[0]!.t).toBeGreaterThanOrEqual(hq.t - 1e-9);
    expect(hq.hp_after).toBeLessThan(1720);
  });
});

describe("M1-11 Tolle W banish: untargetable AND invulnerable for 1.8 s, radius 0 (spec L444, L659-663, L1712)", () => {
  const mk = (extra: Partial<Scenario> = {}): Scenario => ({ T: 6, units: { "blue:jungle": { champ: "tolle", level: 7, x: 6, y: 8 }, [V]: { champ: "torun", level: 7, x: 9, y: 8 }, "red:adc": { champ: "torun", level: 7, x: 9.5, y: 8 },
    "blue:mid": { champ: "mirren", level: 7, x: 6, y: 9.2 }, "blue:adc": { champ: "huntress", level: 7, x: 6, y: 6.8 } }, ...extra });
  it("banish 1.8 s Lock applied to the target only (an enemy 0.5 tiles away is untouched)", () => {
    const r = run(mk({ casts: [{ tick: 5, by: "blue:jungle", key: "W", target: V }] }));
    const a = r.status(V, "banish"); expect(a.length).toBe(1);
    expect(a[0]!.raw_duration).toBeCloseTo(1.8, 6); expect(a[0]!.applied_duration).toBeCloseTo(1.8, 6); expect(a[0]!.category).toBe("lock");
    expect(r.status("red:adc").length).toBe(0);
    const ex = r.expires(V, "banish")[0]!; expect(Math.abs(ex.t - a[0]!.t - 1.8)).toBeLessThanOrEqual(0.15);
  });
  it("invulnerable: skillshots and autos during the banish deal nothing; the same shot after expiry lands", () => {
    const r = run(mk({ casts: [{ tick: 5, by: "blue:jungle", key: "W", target: V }, { tick: 10, by: "blue:adc", key: "Q", aim: [9, 8] }, { tick: 50, by: "blue:adc", key: "R", aim: [9, 8] }] }));
    const a = r.status(V, "banish")[0]!; const end = a.t + 1.8;
    const hs = r.skillHits("blue:adc", V);
    expect(hs.filter((h) => h.t > a.t && h.t < end - 0.05).length, "no damage while banished").toBe(0);
    expect(hs.filter((h) => h.t > end).length, "damage after expiry").toBe(1);
  });
  it("untargetable: a targeted cast (Mirren W) on the banished unit is refused", () => {
    const r = run(mk({ casts: [{ tick: 5, by: "blue:jungle", key: "W", target: V }, { tick: 10, by: "blue:mid", key: "W", target: V }] }));
    expect(r.casts("blue:mid", "W").length).toBe(0); expect(r.status(V, "hex").length).toBe(0);
  });
  it("a banished unit cannot act (cast refused) — L444", () => {
    const sc = mk({ casts: [{ tick: 5, by: "blue:jungle", key: "W", target: V }, { tick: 10, by: V as UId, key: "Q", aim: [6, 8] }] });
    sc.units[V] = { champ: "maelis", level: 7, x: 9, y: 8 };
    const r = run(sc);
    expect(r.status(V, "banish").length).toBe(1);
    expect(r.casts(V, "Q").length).toBe(0);
  });
  it("Tolle W also works on an ally (ally or enemy, L659)", () => {
    const r = run(mk({ casts: [{ tick: 5, by: "blue:jungle", key: "W", target: "blue:adc" }] }));
    expect(r.status("blue:adc", "banish").length).toBe(1);
  });
});

describe("M1-12 Saelo R Still Hour: time-stops allies and enemies in the r=2.4 circle except the caster; caster timers continue; a stopped unit's CD does not tick (spec L448, L837, L1713)", () => {
  const S = "blue:support" as UId, E = "red:mid" as UId, AL = "blue:jungle" as UId, OUT = "red:adc" as UId;
  const sc = (): Scenario => ({ T: 13, pos: true,
    units: { [S]: { champ: "saelo", level: 7, x: 6, y: 8 }, [E]: { champ: "maelis", level: 7, x: 9, y: 8 }, [AL]: { champ: "torun", level: 7, x: 9.5, y: 8.8 }, [OUT]: { champ: "torun", level: 7, x: 13.5, y: 8 } },
    casts: [{ tick: 1, by: S, key: "Q", aim: [9, 8] }, { tick: 2, by: E, key: "Q", aim: [6, 8] }, { tick: 5, by: S, key: "R", aim: [7.5, 8] },
      { tick: 82, by: E, key: "Q", aim: [6, 8] }, { tick: 105, by: E, key: "Q", aim: [6, 8] }, { tick: 84, by: S, key: "Q", aim: [9, 8] }],
    motor: { [E]: { to: [[9, 14]] } } });
  const RR = lazy(() => run(sc()));
  it("time-stop 2.0 s (Lock) on the enemy and the ally in the circle, none on the caster or on the unit outside", () => { const r = RR();
    for (const id of [E, AL]) { const a = r.status(id, "timestop"); expect(a.length, id).toBe(1); expect(a[0]!.applied_duration).toBeCloseTo(2.0, 6); }
    expect(r.status(S).length).toBe(0); expect(r.status(OUT).length).toBe(0);
  });
  it("affected units cannot move during the time-stop (and walk afterwards)", () => { const r = RR();
    const a = r.status(E, "timestop")[0]!; const p0 = r.posAt(E, a.t + 0.2);
    for (const t of [a.t + 0.8, a.t + 1.7]) expect(dist(r.posAt(E, t), p0)).toBeLessThan(0.02);
    expect(dist(r.posAt(E, 12.9), p0)).toBeGreaterThan(0.5);
  });
  it("the stopped unit's cooldown is paused: Maelis Q (CD 7 s) cast at t≈0.2 is NOT ready at t≈8.2 (paused ≈2 s) but IS ready at t≈10.5", () => { const r = RR();
    const cs = r.casts(E, "Q").map((c) => +c.t.toFixed(1));
    expect(cs.some((t) => t >= 8.0 && t < 8.6), "refused at 8.2").toBe(false);
    expect(cs.some((t) => t >= 10.4), "accepted at 10.5").toBe(true);
  });
  it("the caster's own timers continue: Saelo Q (CD 8 s) cast at t≈0.1 is ready again at t≈8.4", () => { const r = RR();
    expect(r.casts(S, "Q").some((c) => c.t >= 8.3 && c.t < 9.0)).toBe(true);
  });
  it("time-stopped units remain targetable and take damage", () => {
    const r2 = run({ T: 4, units: { ...sc().units, "blue:mid": { champ: "huntress", level: 7, x: 6, y: 12.5 } }, casts: [{ tick: 5, by: S, key: "R", aim: [7.5, 8] }, { tick: 20, by: "blue:mid", key: "Q", aim: [9, 8] }] });
    const a = r2.status(E, "timestop")[0]!; const h = r2.skillHits("blue:mid", E);
    expect(h.length).toBeGreaterThanOrEqual(1); expect(h[0]!.t).toBeGreaterThan(a.t); expect(h[0]!.t).toBeLessThan(a.t + 2.0);
    expect(h[0]!.mitigated).toBeGreaterThan(0);
  });
});
