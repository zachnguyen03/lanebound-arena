/** Assist credit through to XP, from REAL casts (spec §6.10 L525-527, §5.3 L229-230 kill 45 / assist 20, §4.3 phase 10 L146). */
import { describe, expect, it } from "vitest";
import { ASSIST_XP, KILL_XP } from "./_oracle.js";
import { occupyTeamAt, run, type Scenario, type UId } from "./_harness.js";

const MI = "blue:mid" as UId, H = "blue:adc" as UId, MA = "blue:top" as UId, YS = "blue:support" as UId, TO = "blue:jungle" as UId, V = "red:mid" as UId;
const gain = (r: ReturnType<typeof run>, id: UId, source: string) => r.of("xp_gain", (e) => e.unit_id === id && e.source === source);

function team(extra: Partial<Scenario> = {}, victimHp = 20): Scenario {
  const units: Scenario["units"] = { [MI]: { champ: "mirren", level: 7, x: 6, y: 8 }, [H]: { champ: "huntress", level: 7, x: 6, y: 9.2, hp: { frac: 0.5 } }, [MA]: { champ: "maelis", level: 7, x: 6, y: 6.8 }, [YS]: { champ: "ysol", level: 7, x: 6, y: 10.5 }, [TO]: { champ: "torun", level: 7, x: 6, y: 5.5 },
    [V]: { champ: "torun", level: 7, x: 9, y: 8, hp: victimHp },
    // L1899: occupy unused red slots so the hexed victim is not yanked toward spawn fillers. Aims stay [9,8].
    ...occupyTeamAt("red", [9, 8], { [V]: { champ: "torun", x: 9, y: 8 } }) };
  return { T: 9, ...extra, units: { ...units, ...(extra.units ?? {}) } };
}
describe("CC assist: Mirren's hex (real W) within 6 s before the kill → assist; killer gets kill XP", () => {
  const r = run(team({ casts: [{ tick: 3, by: MI, key: "W", target: V }, { tick: 25, by: H, key: "Q", aim: [9, 8] }] }));
  it("death event: killer = Huntress, assists = [Mirren] (not the killer)", () => {
    const d = r.of("death", (e) => e.unit_id === V); expect(d.length).toBe(1);
    expect(d[0]!.killer_id).toBe(H); expect(d[0]!.assists).toEqual([MI]);
  });
  it(`xp_gain: killer +${KILL_XP} (kill), Mirren +${ASSIST_XP} (assist); nobody else gets kill/assist XP`, () => {
    expect(gain(r, H, "kill").map((e) => e.amount)).toEqual([KILL_XP]);
    expect(gain(r, MI, "assist").map((e) => e.amount)).toEqual([ASSIST_XP]);
    expect(gain(r, H, "assist").length).toBe(0); expect(gain(r, YS, "assist").length).toBe(0); expect(gain(r, MI, "kill").length).toBe(0);
  });
});
describe("Heal, shield and damage assists from real casts, all in one kill", () => {
  // victim 250 HP: Maelis Q (≈171 mitigated) leaves ≈79, Huntress Q (≈114) kills. Ysol W heals the killer, Torun W shields the killer, Mirren W hexes the victim.
  const r = run(team({ casts: [{ tick: 3, by: YS, key: "W", target: H }, { tick: 3, by: TO, key: "W", target: H }, { tick: 3, by: MI, key: "W", target: V }, { tick: 12, by: MA, key: "Q", aim: [9, 8] }, { tick: 30, by: H, key: "Q", aim: [9, 8] }] }, 250));
  it("assists are exactly the four helpers (damage, heal, shield, disable)", () => {
    const d = r.of("death", (e) => e.unit_id === V)[0]!; expect(d.killer_id).toBe(H);
    expect([...d.assists].sort()).toEqual([MA, MI, TO, YS].sort());
  });
  it(`each living assistant receives +${ASSIST_XP} once; killer +${KILL_XP}`, () => {
    for (const id of [MA, MI, TO, YS]) expect(gain(r, id, "assist").map((e) => e.amount), id).toEqual([ASSIST_XP]);
    expect(gain(r, H, "kill").map((e) => e.amount)).toEqual([KILL_XP]);
  });
  it("the heal and the shield were real (events exist), so the credit came from casts", () => {
    expect(r.heals(YS, H).length).toBe(1); expect(r.shields(TO, H).length).toBe(1); expect(r.status(V, "hex").length).toBe(1);
  });
});
describe("The 6.0 s window (spec L526)", () => {
  const kill = (tick: number) => run(team({ casts: [{ tick: 3, by: MI, key: "W", target: V }, { tick, by: H, key: "Q", aim: [9, 8] }] }));
  it("hex at ≈0.5 s, kill at ≈5.1 s → assist", () => { expect(kill(48).of("death", (e) => e.unit_id === V)[0]!.assists).toEqual([MI]); });
  it("hex at ≈0.5 s, kill at ≈7.1 s → no assist, no assist XP", () => {
    const r = kill(68); const d = r.of("death", (e) => e.unit_id === V)[0]!; expect(d.assists).toEqual([]); expect(gain(r, MI, "assist").length).toBe(0);
  });
});
describe("Dead assistants: listed in the recap, but receive no assist XP (spec L526, xp_while_dead = 0 L231)", () => {
  it("Ysol heals the killer, is then killed by the enemy, then the kill happens", () => {
    const sc = team({ casts: [{ tick: 3, by: YS, key: "W", target: H }, { tick: 3, by: MI, key: "W", target: V }, { tick: 30, by: H, key: "Q", aim: [9, 8] }], damage: [{ tick: 12, source: V, target: YS, raw: 9999 }] });
    sc.units[YS] = { champ: "ysol", level: 7, x: 6, y: 10.5, hp: 5 };
    const r = run(sc);
    expect(r.of("death", (e) => e.unit_id === YS).length).toBe(1);
    const d = r.of("death", (e) => e.unit_id === V)[0]!;
    expect(d.assists).toContain(YS); expect(d.assists).toContain(MI);
    expect(gain(r, YS, "assist").length).toBe(0); expect(gain(r, MI, "assist").length).toBe(1);
  });
});
