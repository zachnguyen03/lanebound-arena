/**
 * Kiln-Cured after GD ruling OQ-1 / OQ-2 (Appendix R #2, 23 Nov 2026).
 * Additive replacement for the AMBIGUOUS block in kiln-cured.test.ts. Do not edit that file
 * except to delete the superseded tests named in GD-RULINGS.md (Anh's permission required).
 *
 *   L1897 OQ-1: "Off under Break" is a Break on the passive's OWNER (Mirren). A Break on the
 *               victim or the attacker has no effect. M1 test 14 breaks Mirren.
 *   L1898 OQ-2: CC or amps applied this tick never modify packets resolved this tick.
 *               A skill's own packet resolves before its own CC. Kiln-Cured amps packets
 *               from the next tick on.
 *   L743 / L397 / L456 / L1719 as originally cited, now settled by L1897–L1898.
 */
import { describe, expect, it } from "vitest";
import { mit, rawDamage, ab } from "./_oracle.js";
import { run, skillIs, type Scenario, type UId } from "./_harness.js";

const MI = "blue:mid" as UId, V = "red:mid" as UId, H = "blue:adc" as UId, MA = "blue:jungle" as UId;
const hq = 190 * mit(66); // Huntress Q L7 vs Torun L7 PRes 66, no amp

function scn(extra: Partial<Scenario> = {}): Scenario {
  return { T: 7, units: { [MI]: { champ: "mirren", level: 7, x: 6, y: 8 }, [V]: { champ: "torun", level: 7, x: 9, y: 8 }, [H]: { champ: "huntress", level: 7, x: 6, y: 9 }, [MA]: { champ: "maelis", level: 7, x: 6, y: 7 } },
    casts: [{ tick: 3, by: MI, key: "W", target: V }, { tick: 10, by: H, key: "Q", aim: [9, 8] }], ...extra };
}
const ampOf = (r: ReturnType<typeof run>) => {
  const hx = r.status(V, "hex")[0];
  expect(hx, "hex still lands").toBeDefined();
  const h = r.skillHits(H, V).find((e) => skillIs(e, "huntress", "Q") && e.t > hx!.t && e.t < hx!.t + hx!.applied_duration);
  expect(h, "a Huntress Q lands inside the hex").toBeDefined();
  return h!.mitigated;
};

describe("OQ-1 reading A is binding (Appendix R #2 L1897): Break on Mirren, not the victim or the attacker (M1 test 14)", () => {
  it("forced Break on MIRREN (the owner): hex still lands, the third-party Huntress Q is NOT amped (plain 190×mit(66))", () => {
    expect(Math.abs(ampOf(run(scn({ cc: [{ tick: 1, target: MI, kind: "break", duration: 10, source: V }] }))) - hq)).toBeLessThanOrEqual(0.02);
  });
  it("forced Break on the HEXED TARGET (victim): amp is still +12% (Break on the victim does nothing)", () => {
    expect(Math.abs(ampOf(run(scn({ cc: [{ tick: 1, target: V, kind: "break", duration: 10, source: MI }] }))) - hq * 1.12)).toBeLessThanOrEqual(0.02);
  });
  it("forced Break on the ATTACKER (Huntress, whose packet would be amped): amp is still +12% (Break on the attacker does nothing)", () => {
    expect(Math.abs(ampOf(run(scn({ cc: [{ tick: 1, target: H, kind: "break", duration: 10, source: V }] }))) - hq * 1.12)).toBeLessThanOrEqual(0.02);
  });
  it("sanity: with no Break the same third-party Q is amped ×1.12", () => {
    expect(Math.abs(ampOf(run(scn())) - hq * 1.12)).toBeLessThanOrEqual(0.02);
  });
});

describe("OQ-2 (Appendix R #2 L1898): same-tick packets are not amped; Kiln-Cured starts on the next tick; a skill's own packet is never amped by the hex it applies", () => {
  it("a scripted 190-raw physical packet landing on the SAME tick the hex is applied is plain; one landing on the NEXT tick is ×1.12", () => {
    const r = run({ T: 4, units: { [MI]: { champ: "mirren", level: 7, x: 6, y: 8 }, [V]: { champ: "torun", level: 7, x: 9, y: 8 }, [H]: { champ: "huntress", level: 7, x: 6, y: 9 } },
      casts: [{ tick: 3, by: MI, key: "W", target: V }],
      // ticks 3–12 cover the 0.25 s W windup; the test keys off the observed hex tick
      damage: Array.from({ length: 10 }, (_, i) => ({ tick: 3 + i, source: H, target: V, raw: 190 })) });
    const hx = r.status(V, "hex")[0]!; expect(hx, "Mirren W hexes the target").toBeDefined();
    const pk = r.skillHits(H, V).filter((e) => e.skill_id === "scripted");
    const same = pk.find((e) => e.tick === hx.tick);
    const next = pk.find((e) => e.tick === hx.tick + 1);
    expect(same, "a packet resolved on the hex tick").toBeDefined();
    expect(next, "a packet resolved on the next tick").toBeDefined();
    expect(Math.abs(same!.mitigated - 190 * mit(66)), "same tick: no amp").toBeLessThanOrEqual(0.02);
    expect(Math.abs(next!.mitigated - 190 * 1.12 * mit(66)), "next tick: +12%").toBeLessThanOrEqual(0.02);
  });
  it("Mirren R's OWN packet is not amped by the hex it applies this tick (own packet before own CC)", () => {
    const r = run({ T: 4, units: { [MI]: { champ: "mirren", level: 7, x: 6, y: 8 }, [V]: { champ: "torun", level: 7, x: 9, y: 8 } }, casts: [{ tick: 3, by: MI, key: "R", aim: [9, 8] }] });
    expect(Math.abs(r.skillHits(MI, V)[0]!.mitigated - rawDamage(ab("mirren", "R"), 7) * mit(60))).toBeLessThanOrEqual(0.02);
  });
});
