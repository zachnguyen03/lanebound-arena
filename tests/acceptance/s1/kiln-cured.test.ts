/**
 * Mirren Kiln-Cured (spec L743, L397, L456, M1 test 14 L1719).
 * Part 1 is unambiguous. Part 2 ("whose Break?") is AMBIGUOUS in the spec and needs a Game Designer ruling — see README §Open questions OQ-1.
 *
 *   L743  "Passive — Kiln-Cured (L1, off under Break). Enemies hexed by Mirren take +12% damage from all sources for as long as the hex lasts."
 *   L397  "Mirren Kiln-Cured: if the target is hexed by Mirren, raw *= 1.12 from ALL sources, off under Break"
 *   L456  "Break: disables passives listed as 'off under Break' (…Mirren Kiln-Cured…)."  [does not say whose passives / whose Break]
 *   L456  "Kerrig R lists 'Break 2.8 s' on Kerrig himself … a self-Break for 2.8 s (passives off; he has no such passive…)"  [supports: Break on the passive's OWNER]
 *   L1719 "14. Mirren Kiln-Cured: a hexed target takes +12% from a third party's packet; the amp drops when the hex ends; off under Break (unit test with a forced Break)."  [does not say on whom]
 */
import { describe, expect, it } from "vitest";
import { mit, rawDamage, ab } from "./_oracle.js";
import { lazy, occupyTeamAt, run, skillIs, type Scenario, type UId } from "./_harness.js";

const MI = "blue:mid" as UId, V = "red:mid" as UId, H = "blue:adc" as UId, MA = "blue:jungle" as UId, MA2 = "blue:top" as UId;
const hq = 190 * mit(66);                       // Huntress Q L7 vs Torun L7 PRes 66, no amp
const mq = (160 + 1.35 * 84) * mit(60);         // Maelis Q L7 vs Torun L7 MRes 60, no amp
function scn(extra: Partial<Scenario> = {}, mirrenLevel = 7, tl = 7): Scenario {
  const units: Scenario["units"] = { [MI]: { champ: "mirren", level: mirrenLevel, x: 6, y: 8 }, [V]: { champ: "torun", level: tl, x: 9, y: 8 }, [H]: { champ: "huntress", level: 7, x: 6, y: 9, auto: true }, [MA]: { champ: "maelis", level: 7, x: 6, y: 7 }, [MA2]: { champ: "maelis", level: 7, x: 6, y: 6.2 },
    // L1899: occupy unused red slots so V is not yanked toward spawn fillers. Aims stay [9,8].
    ...occupyTeamAt("red", [9, 8], { [V]: { champ: "torun", x: 9, y: 8 } }) };
  return { T: 7, casts: [{ tick: 3, by: MI, key: "W", target: V }, { tick: 10, by: H, key: "Q", aim: [9, 8] }, { tick: 11, by: MA, key: "Q", aim: [9, 8] }, { tick: 45, by: MA2, key: "Q", aim: [9, 8] }, { tick: 60, by: H, key: "R", aim: [9, 8] }], ...extra, units: { ...units, ...(extra.units ?? {}) } };
}

describe("Kiln-Cured — unambiguous (spec L743, L397)", () => {
  const R = lazy(() => run(scn()));
  const HX = () => { const h = R().status(V, "hex")[0]; expect(h, "Mirren W must hex the target (status_apply kind hex)").toBeDefined(); return { hex: h!, end: h!.t + h!.applied_duration, r: R() }; };
  it("Mirren W hexes the target for 1.6 s (Lock)", () => { const { hex } = HX(); expect(hex).toBeDefined(); expect(hex.applied_duration).toBeCloseTo(1.6, 6); expect(hex.category).toBe("lock"); });
  it("a third party's Huntress Q (physical) during the hex deals +12%", () => { const { hex, end, r } = HX();
    const h = r.skillHits(H, V).find((e) => e.t > hex.t && e.t < end)!; expect(h, "Q lands inside the hex").toBeDefined();
    expect(Math.abs(h.mitigated - hq * 1.12)).toBeLessThanOrEqual(0.02);
  });
  it("…and a second source's Maelis Q (magic) in the same window: +12% from ALL sources", () => { const { hex, end, r } = HX();
    const h = r.skillHits(MA, V).find((e) => e.t > hex.t && e.t < end)!; expect(h).toBeDefined();
    expect(Math.abs(h.mitigated - mq * 1.12)).toBeLessThanOrEqual(0.02);
  });
  it("…and autos too: a non-crit Huntress auto inside the hex = ATK 100 × 1.12 × mit(66); the pre-hex auto has no amp", () => { const { hex, end, r } = HX();
    const autos = r.autoHits(H, 0, 7, V).filter((h) => !h.crit);
    const inHex = autos.find((h) => h.t > hex.t + 0.05 && h.t < end - 0.05)!; expect(inHex, "an auto inside the hex window").toBeDefined();
    expect(Math.abs(inHex.mitigated - 100 * 1.12 * mit(66))).toBeLessThanOrEqual(0.02);
    const pre = autos.find((h) => h.t < hex.t)!; if (pre) expect(Math.abs(pre.mitigated - 100 * mit(66))).toBeLessThanOrEqual(0.02);
  });
  it("the amp drops when the hex ends: Maelis Q at ≈4.5 s and Huntress R at ≈6 s are plain", () => { const { end, r } = HX();
    const late = r.skillHits(MA2, V).find((e) => e.t > end + 1.0)!; expect(Math.abs(late.mitigated - mq)).toBeLessThanOrEqual(0.02);
    const hr = r.skillHits(H, V).find((e) => e.t > end + 1.0)!; expect(Math.abs(hr.mitigated - (230 + 1.05 * 100) * mit(66))).toBeLessThanOrEqual(0.02);
  });
  it("Mirren's OWN later Q on the hexed target is amped too ('all sources')", () => {
    const rr = run(scn({ casts: [{ tick: 3, by: MI, key: "W", target: V }, { tick: 10, by: MI, key: "Q", target: V }] }));
    const hx = rr.status(V, "hex")[0]!; const q = rr.skillHits(MI, V)[0]!;
    expect(q.t).toBeGreaterThan(hx.t); expect(q.t).toBeLessThan(hx.t + hx.applied_duration);
    expect(Math.abs(q.mitigated - (115 + 0.9 * 100) * 1.12 * mit(60))).toBeLessThanOrEqual(0.02);
  });
  it("not skill-scaled: with Mirren at L1 the amp is still exactly +12% (spec L359)", () => {
    const rr = run(scn({}, 1, 7)); const hx = rr.status(V, "hex")[0]!;
    const h = rr.skillHits(H, V).find((e) => e.t > hx.t && e.t < hx.t + hx.applied_duration)!;
    expect(Math.abs(h.mitigated - hq * 1.12)).toBeLessThanOrEqual(0.02);
  });
  it("Mirren R's hex (1.5 s) also carries Kiln-Cured (spec L751): a Huntress Q inside it is +12%", () => {
    const rr = run({ T: 5, units: { [MI]: { champ: "mirren", level: 7, x: 6, y: 8 }, [V]: { champ: "torun", level: 7, x: 9, y: 8 }, [H]: { champ: "huntress", level: 7, x: 6, y: 9 } }, casts: [{ tick: 3, by: MI, key: "R", aim: [9, 8] }, { tick: 14, by: H, key: "Q", aim: [9, 8] }] });
    const hx = rr.status(V, "hex")[0]!; expect(hx.applied_duration).toBeCloseTo(1.5, 6);
    const h = rr.skillHits(H, V)[0]!; expect(h.t).toBeGreaterThan(hx.t); expect(h.t).toBeLessThan(hx.t + 1.5);
    expect(Math.abs(h.mitigated - hq * 1.12)).toBeLessThanOrEqual(0.02);
  });
  it("Mirren R's OWN damage is not amped by its own hex: damage resolves (phase 8) before the hex lands (phase 9) (spec L143-144; interpretation OQ-2)", () => {
    const rr = run({ T: 4, units: { [MI]: { champ: "mirren", level: 7, x: 6, y: 8 }, [V]: { champ: "torun", level: 7, x: 9, y: 8 } }, casts: [{ tick: 3, by: MI, key: "R", aim: [9, 8] }] });
    expect(Math.abs(rr.skillHits(MI, V)[0]!.mitigated - rawDamage(ab("mirren", "R"), 7) * mit(60))).toBeLessThanOrEqual(0.02);
  });
  it("a unit NOT hexed takes no amp: one Huntress R (point circle) during the hex hits the hexed Torun and an un-hexed Torun in the same cast", () => {
    const rr = run(scn({ units: { ...scn().units, "red:adc": { champ: "torun", level: 7, x: 9, y: 9.3 } },
      casts: [{ tick: 3, by: MI, key: "W", target: V }, { tick: 10, by: H, key: "R", aim: [9, 8.65] }] }));
    const hx = rr.status(V, "hex")[0]!; expect(hx, "Mirren W hexes the target").toBeDefined();
    const pk = (id: UId) => rr.skillHits(H, id).filter((e) => skillIs(e, "huntress", "R"));
    expect(pk("red:adc" as UId).length).toBe(1); expect(pk(V).length).toBe(1);
    expect(pk(V)[0]!.t, "the R packet lands inside the hex").toBeLessThan(hx.t + hx.applied_duration);
    const base = rawDamage(ab("huntress", "R"), 7) * mit(66);
    expect(Math.abs(pk("red:adc" as UId)[0]!.mitigated - base)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(pk(V)[0]!.mitigated - base * 1.12)).toBeLessThanOrEqual(0.02);
    expect(rr.status("red:adc" as UId, "hex").length).toBe(0);
  });
});

/**
 * AMBIGUOUS — OQ-1. Which Break turns the amp off? Three candidate readings; each test below states ONE reading and asserts it.
 * They are not mutually exclusive as assertions, but the spec text does not say which holds. Ask the Game Designer, then keep
 * the test(s) for the chosen reading(s) and DELETE the others. The default reading (A) follows L456's Kerrig self-Break sentence.
 */
describe("Kiln-Cured — AMBIGUOUS: whose Break? (needs GD ruling, see README OQ-1)", () => {
  const withBreak = (target: UId) => run(scn({ cc: [{ tick: 1, target, kind: "break", duration: 10, source: V }] }));
  const ampOf = (r: ReturnType<typeof run>) => { const hx = r.status(V, "hex")[0]; expect(hx, "hex still lands under Break").toBeDefined(); return r.skillHits(H, V).find((e) => e.t > hx!.t && e.t < hx!.t + hx!.applied_duration)!.mitigated; };
  it("[Reading A — Break on MIRREN (the passive's owner)] amp is off; the hex itself still lands", () => {
    expect(Math.abs(ampOf(withBreak(MI)) - hq)).toBeLessThanOrEqual(0.02);
  });
  it("[sanity, all readings] with NO Break the same scenario is amped ×1.12", () => {
    expect(Math.abs(ampOf(run(scn())) - hq * 1.12)).toBeLessThanOrEqual(0.02);
  });
});
