/** Cast / cooldown / windup / auto-cadence / attack-reset / time-stop timer pausing (spec §6.8-6.9 L506-523, §6.5 L448, §4.3 L142-144). */
import { describe, expect, it } from "vitest";
import { ABILITIES, mit } from "./_oracle.js";
import { run, type Scenario, type UId } from "./_harness.js";
import { abilityRun } from "./_scenarios.js";

describe("Cooldowns: a skill cannot be recast before its authored CD and can after it (spec §7 'CD x s'; no mana, L523)", () => {
  // Kerrig R needs a fresh mark per cast (covered in 03-marks-finishers). R is tested at L7.
  for (const a of ABILITIES.filter((x) => !x.needsMark)) it(`${a.champ} ${a.key} CD ${a.cd} s (spec L${a.line})`, () => {
    const t1 = Math.round((0.5 + a.cd - 1.0) * 10), t2 = Math.round((0.5 + a.cd + 1.0) * 10);
    const base = abilityRun(a, 7, 7, { T: a.cd + 3 });
    // re-run with two extra copies of the same cast
    const main = base.sc.casts!.find((c) => c.key === a.key)!;
    const ar = abilityRun(a, 7, 7, { T: a.cd + 3, casts: [main, { ...main, tick: t1 }, { ...main, tick: t2 }] });
    const cs = ar.r.casts(ar.casterId, a.key);
    expect(cs.length, "first accepted, the early recast refused, the late recast accepted").toBe(2);
    expect(cs[1]!.t).toBeGreaterThanOrEqual(0.5 + a.cd - 0.05);
  });
});

describe("Dead units cannot cast (spec L142 'alive')", () => {
  it("a unit killed at t≈0.5 gets no cast_start from a cast scripted afterwards", () => {
    const r = run({ T: 3, units: { "blue:mid": { champ: "huntress", level: 7, x: 6, y: 8, hp: 5 }, "red:mid": { champ: "torun", level: 7, x: 9, y: 8 } }, damage: [{ tick: 4, source: "red:mid", target: "blue:mid", raw: 500 }], casts: [{ tick: 10, by: "blue:mid", key: "Q", aim: [9, 8] }] });
    expect(r.of("death", (e) => e.unit_id === "blue:mid").length).toBe(1); expect(r.casts("blue:mid").length).toBe(0);
  });
});

describe("Auto cadence and windup (spec L506 windup=0.25/AS, L520 cadence 1/AS from the START of the previous windup, L522 skill cancels an unapplied windup)", () => {
  const A = "blue:mid" as UId, B = "red:mid" as UId;
  const mk = (extra: Partial<Scenario> = {}): Scenario => ({ T: 7, units: { [A]: { champ: "huntress", level: 7, x: 6, y: 8, auto: true, as: 0.5 }, [B]: { champ: "torun", level: 7, x: 9, y: 8 } }, ...extra });
  it("control: AS 0.5 → windup 0.5 s (first auto lands at ≈0.6-0.7) and one auto every 2.0 s", () => {
    const hs = run(mk()).autoHits(A);
    expect(hs.length).toBeGreaterThanOrEqual(3);
    expect(hs[0]!.t).toBeGreaterThanOrEqual(0.5); expect(hs[0]!.t).toBeLessThanOrEqual(0.85);
    for (let i = 1; i < 3; i++) expect(Math.abs(hs[i]!.t - hs[i - 1]!.t - 2.0)).toBeLessThanOrEqual(0.15);
  });
  it("starting a skill mid-windup cancels the auto: no auto lands from the interrupted windup; autos resume after the cooldown", () => {
    const ctl = run(mk()).autoHits(A)[0]!;
    const r = run(mk({ casts: [{ tick: 3, by: A, key: "Q", aim: [9, 8] }] }));
    expect(r.casts(A, "Q").length).toBe(1);
    expect(r.autoHits(A, 0, ctl.t + 1.4).length, "the first windup was cancelled by the cast").toBe(0);
    expect(r.autoHits(A, ctl.t + 1.5, 7).length, "autos resume").toBeGreaterThanOrEqual(1);
  });
  it("attack_reset gate: while a reset is pending no auto starts; once cleared, autos resume (spec L506)", () => {
    const r = run(mk({ attack_reset: [{ tick: 1, unit: A, pending: true }, { tick: 40, unit: A, pending: false }] }));
    expect(r.autoHits(A, 0, 4.0).length).toBe(0);
    expect(r.autoHits(A, 4.0, 7).length).toBeGreaterThanOrEqual(1);
  });
});

describe("Time-stop pauses windups, cast times, CC durations, buffs and regen on the stopped unit (spec L448, L144)", () => {
  const A = "blue:mid" as UId, B = "red:mid" as UId;
  it("auto windup: AS 0.5 auto begun at 0.1, time-stop at 0.3 for 2.0 s → lands ≈ 2.6 not 0.6", () => {
    const r = run({ T: 4, units: { [A]: { champ: "huntress", level: 7, x: 6, y: 8, auto: true, as: 0.5 }, [B]: { champ: "torun", level: 7, x: 9, y: 8 } }, cc: [{ tick: 3, target: A, kind: "timestop", duration: 2.0, source: B }] });
    const ts = r.status(A, "timestop")[0]!; expect(ts.applied_duration).toBeCloseTo(2.0, 6);
    const h = r.autoHits(A)[0]!; expect(h.t).toBeGreaterThan(ts.t + 1.5); expect(h.t).toBeLessThan(ts.t + 2.0 + 0.6);
  });
  it("cast windup: Huntress R (0.6 s) begun at 0.5, time-stop at 0.8 for 2.0 s → resolves ≈ 3.1 not 1.1, and is NOT cancelled", () => {
    const r = run({ T: 5, units: { [A]: { champ: "huntress", level: 7, x: 6, y: 8 }, [B]: { champ: "torun", level: 7, x: 9, y: 8 } }, casts: [{ tick: 5, by: A, key: "R", aim: [9, 8] }], cc: [{ tick: 8, target: A, kind: "timestop", duration: 2.0, source: B }] });
    expect(r.of("cast_cancel", (e) => e.unit_id === A).length).toBe(0);
    const h = r.skillHits(A, B)[0]!; expect(h.t).toBeGreaterThanOrEqual(2.9); expect(h.t).toBeLessThanOrEqual(3.4);
  });
  it("cooldown: Huntress Q (CD 8) cast at 0.5, time-stop 2.0 s at t=2.0 → NOT ready at 9.5 (would be without the pause), ready at 11.5", () => {
    const r = run({ T: 12.5, units: { [A]: { champ: "huntress", level: 7, x: 6, y: 8 }, [B]: { champ: "torun", level: 7, x: 9, y: 8 } },
      casts: [{ tick: 5, by: A, key: "Q", aim: [9, 8] }, { tick: 95, by: A, key: "Q", aim: [9, 8] }, { tick: 115, by: A, key: "Q", aim: [9, 8] }], cc: [{ tick: 20, target: A, kind: "timestop", duration: 2.0, source: B }] });
    const cs = r.casts(A, "Q"); expect(cs.length).toBe(2); expect(cs[1]!.t).toBeGreaterThanOrEqual(11.0);
  });
  it("CC durations on the stopped unit pause: stun 3.0 at 0.2, time-stop at 1.2 → the stun ends at stun.t + 3.0 + time-stop.applied", () => {
    const r = run({ T: 9, units: { [A]: { champ: "huntress", level: 7, x: 6, y: 8 }, [B]: { champ: "torun", level: 7, x: 9, y: 8 } }, cc: [{ tick: 2, target: A, kind: "stun", duration: 3.0, source: B }, { tick: 12, target: A, kind: "timestop", duration: 2.0, source: B }] });
    const st = r.status(A, "stun")[0]!, ts = r.status(A, "timestop")[0]!;
    const ex = r.expires(A, "stun")[0]!; expect(Math.abs(ex.t - (st.t + st.applied_duration + ts.applied_duration))).toBeLessThanOrEqual(0.2);
  });
  it("buffs pause: Maelis W shield (2.5 s) + time-stop 2.0 s → still absorbing at ≈ +3.4 s after the cast", () => {
    const r = run({ T: 6, units: { [A]: { champ: "maelis", level: 7, x: 6, y: 8 }, [B]: { champ: "huntress", level: 7, x: 11, y: 8 } }, casts: [{ tick: 5, by: A, key: "W", aim: [6, 14] }, { tick: 33, by: B, key: "Q", aim: [6, 8] }], cc: [{ tick: 10, target: A, kind: "timestop", duration: 2.0, source: B }] });
    const sh = r.shields(A, A)[0]!; const h = r.skillHits(B, A)[0]!;
    expect(h.t).toBeGreaterThan(sh.t + 2.5); expect(h.shield_absorbed, "shield timer was paused with the unit").toBeGreaterThan(0);
  });
  it("regen pauses: time-stopped for the whole run, HP is unchanged; without it HP rises", () => {
    const mk = (cc: boolean) => run({ T: 2, units: { [A]: { champ: "torun", level: 7, x: 6, y: 8, hp: 800 } }, ...(cc ? { cc: [{ tick: 1, target: A, kind: "timestop", duration: 4.0, source: B }] } : {}) }).unit(A).hp;
    expect(mk(false)).toBeGreaterThan(815); expect(Math.abs(mk(true) - 800)).toBeLessThanOrEqual(1.0);
  });
});
