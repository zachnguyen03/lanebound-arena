/** M1 tests 6, 7, 8, 15 (spec L1714-1720): worked packet, Huntress mark, finishers, Kerrig R. All through the real loop. */
import { describe, expect, it } from "vitest";
import { ab, mit, rawDamage, statAt } from "./_oracle.js";
import { dist, maxHp, run, skillIs, type UId } from "./_harness.js";

const B = "blue:mid" as UId, E1 = "red:mid" as UId, E2 = "red:adc" as UId, E3 = "red:top" as UId;

describe("M1-6 Huntress Q worked packet (spec L413-421)", () => {
  it("L7 vs 36 PRes: mitigated = 139.706 ± 0.02", () => {
    const r = run({ T: 3, units: { [B]: { champ: "huntress", level: 7, x: 6, y: 8 }, [E1]: { champ: "huntress", level: 7, x: 9, y: 8 } }, casts: [{ tick: 5, by: B, key: "Q", aim: [9, 8] }] });
    const h = r.skillHits(B, E1)[0]!;
    expect(h, "a hit").toBeDefined();
    expect(Math.abs(h.mitigated - 139.706)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(h.raw - 190)).toBeLessThanOrEqual(0.02);
  });
  it("L1: skill_scale 0.70, ATK 72: raw = (110+0.80×72)×0.70 = 117.32 (L421)", () => {
    const r = run({ T: 3, units: { [B]: { champ: "huntress", level: 1, x: 6, y: 8 }, [E1]: { champ: "huntress", level: 1, x: 9, y: 8 } }, casts: [{ tick: 5, by: B, key: "Q", aim: [9, 8] }] });
    const h = r.skillHits(B, E1)[0]!;
    expect(Math.abs(h.raw - 117.32)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(h.mitigated - 117.32 * mit(26))).toBeLessThanOrEqual(0.02);
  });
});

describe("M1-7 Huntress R mark: +35% then consume (spec L393, L556, L1715)", () => {
  const hr = ab("huntress", "R"), hq = ab("huntress", "Q");
  const baseR = rawDamage(hr, 7);
  it("R on a marked target deals ×1.35; mitigated includes it", () => {
    const r = run({ T: 4, units: { [B]: { champ: "huntress", x: 6, y: 8 }, [E1]: { champ: "torun", x: 9, y: 8 } },
      casts: [{ tick: 2, by: B, key: "Q", aim: [9, 8] }, { tick: 10, by: B, key: "R", aim: [9, 8] }] });
    const h = r.skillHits(B, E1).find((e) => skillIs(e, "huntress", "R"))!;
    expect(Math.abs(h.raw - baseR * 1.35)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(h.mitigated - baseR * 1.35 * mit(66))).toBeLessThanOrEqual(0.02);
  });
  it("R with no mark deals the unmarked amount", () => {
    const r = run({ T: 3, units: { [B]: { champ: "huntress", x: 6, y: 8 }, [E1]: { champ: "torun", x: 9, y: 8 } }, casts: [{ tick: 5, by: B, key: "R", aim: [9, 8] }] });
    expect(Math.abs(r.skillHits(B, E1)[0]!.raw - baseR)).toBeLessThanOrEqual(0.02);
  });
  it("a second R without a remake does not get the bonus (mark consumed)", () => {
    const r = run({ T: 62, units: { [B]: { champ: "huntress", x: 6, y: 8 }, [E1]: { champ: "torun", x: 9, y: 8 } },
      casts: [{ tick: 2, by: B, key: "Q", aim: [9, 8] }, { tick: 10, by: B, key: "R", aim: [9, 8] }, { tick: 600, by: B, key: "R", aim: [9, 8] }] });
    const hs = r.skillHits(B, E1).filter((e) => skillIs(e, "huntress", "R"));
    expect(hs.length).toBe(2);
    expect(Math.abs(hs[0]!.raw - baseR * 1.35)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(hs[1]!.raw - baseR)).toBeLessThanOrEqual(0.02);
  });
  it("Q does not consume the mark: Q, Q again after its CD, then R still gets +35%", () => {
    const r = run({ T: 14, units: { [B]: { champ: "huntress", x: 6, y: 8 }, [E1]: { champ: "torun", x: 9, y: 8 } },
      casts: [{ tick: 2, by: B, key: "Q", aim: [9, 8] }, { tick: 90, by: B, key: "Q", aim: [9, 8] }, { tick: 100, by: B, key: "R", aim: [9, 8] }] });
    const rr = r.skillHits(B, E1).find((e) => skillIs(e, "huntress", "R"))!;
    expect(Math.abs(rr.raw - baseR * 1.35)).toBeLessThanOrEqual(0.02);
  });
  it("mark lasts 4 s (L552): R 3 s after Q gets the bonus; R 5 s after Q does not", () => {
    const mk = (rTick: number) => run({ T: 8, units: { [B]: { champ: "huntress", x: 6, y: 8 }, [E1]: { champ: "torun", x: 9, y: 8 } },
      casts: [{ tick: 2, by: B, key: "Q", aim: [9, 8] }, { tick: rTick, by: B, key: "R", aim: [9, 8] }] }).skillHits(B, E1).find((e) => skillIs(e, "huntress", "R"))!;
    expect(Math.abs(mk(32).raw - baseR * 1.35)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(mk(52).raw - baseR)).toBeLessThanOrEqual(0.02);
  });
  it("only the marked target gets the bonus in a multi-target R (mark is per target)", () => {
    const r = run({ T: 4, units: { [B]: { champ: "huntress", x: 6, y: 8 }, [E1]: { champ: "torun", x: 9, y: 8 }, [E2]: { champ: "torun", x: 9, y: 9.5 } },
      casts: [{ tick: 2, by: B, key: "Q", aim: [9, 8] }, { tick: 10, by: B, key: "R", aim: [9, 8.7] }] });
    const rs = r.skillHits(B).filter((e) => skillIs(e, "huntress", "R"));
    expect(rs.length).toBe(2);
    expect(Math.abs(rs.find((e) => e.target_id === E1)!.raw - baseR * 1.35)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(rs.find((e) => e.target_id === E2)!.raw - baseR)).toBeLessThanOrEqual(0.02);
  });
  void hq;
});

describe("M1-8 finishers: raw × (1 + coef × missing-HP fraction), evaluated per target, ±0.02 (spec L390-392, L577, L728, L1716)", () => {
  const mr = ab("maelis", "R"), kr = ab("kerrig", "R");
  it("Maelis R, three targets at 0%, 40% and 75% missing HP, each gets its own coefficient (1.00, 1.08, 1.15)", () => {
    const L = 7;
    const r = run({ T: 4, units: {
      [B]: { champ: "maelis", level: L, x: 6, y: 8 },
      [E1]: { champ: "torun", x: 10, y: 8 },
      [E2]: { champ: "torun", x: 10.8, y: 8.6, hp: { frac: 0.6 } },
      [E3]: { champ: "torun", x: 9.4, y: 7.3, hp: { frac: 0.25 } } },
      casts: [{ tick: 5, by: B, key: "R", aim: [10, 8] }] });
    const base = rawDamage(mr, L);
    for (const [id, m] of [[E1, 0], [E2, 0.4], [E3, 0.75]] as const) {
      const h = r.skillHits(B, id)[0]!;
      expect(h, `hit on ${id}`).toBeDefined();
      const hpBefore = h.hp_after + h.mitigated + (h.shield_absorbed ?? 0);
      const missing = (maxHp("torun", 7) - hpBefore) / maxHp("torun", 7);
      expect(missing).toBeGreaterThanOrEqual(m - 0.03); // sanity: regen over <1 s is tiny
      const slack = 0.02 + base * 0.2 / maxHp("torun", 7); // hp_before recovered from floored hp_after (spec L124)
      expect(Math.abs(h.raw - base * (1 + 0.2 * missing))).toBeLessThanOrEqual(slack);
      expect(Math.abs(h.mitigated - base * (1 + 0.2 * missing) * mit(60))).toBeLessThanOrEqual(slack);
    }
  });
  it("Kerrig R at 0%, 30% and 60% missing HP: ×(1+0.35·missing)", () => {
    const base = rawDamage(kr, 7);
    for (const frac of [1.0, 0.7, 0.4]) {
      const r = run({ T: 4, units: { [B]: { champ: "kerrig", x: 6, y: 8 }, [E1]: { champ: "torun", x: 9, y: 8, hp: { frac } } },
        casts: [{ tick: 2, by: B, key: "Q", aim: [9, 8] }, { tick: 8, by: B, key: "R", target: E1 }] });
      const h = r.skillHits(B, E1).find((e) => skillIs(e, "kerrig", "R"))!;
      expect(h, `R hit at frac ${frac}`).toBeDefined();
      const hpBefore = h.hp_after + h.mitigated + (h.shield_absorbed ?? 0);
      const missing = (maxHp("torun", 7) - hpBefore) / maxHp("torun", 7);
      expect(Math.abs(h.raw - base * (1 + 0.35 * missing))).toBeLessThanOrEqual(0.02 + base * 0.35 / maxHp("torun", 7));
      expect(missing).toBeGreaterThan(1 - frac - 0.01); // finisher actually saw the wounded HP
    }
  });
});

describe("M1-15 Kerrig R (spec L728, L456, L1720)", () => {
  const dashed = (r: ReturnType<typeof run>) => r.posAt(B, 6).x - 6;
  it("without a mark: no dash, no damage", () => {
    const r = run({ T: 6, pos: true, units: { [B]: { champ: "kerrig", x: 6, y: 8 }, [E1]: { champ: "torun", x: 9, y: 8 } }, casts: [{ tick: 5, by: B, key: "R", target: E1 }] });
    expect(r.skillHits(B, E1).filter((e) => skillIs(e, "kerrig", "R")).length).toBe(0);
    expect(Math.abs(dashed(r))).toBeLessThan(0.05);
  });
  it("with a mark: dashes toward the target (≤5 tiles) and hits", () => {
    const r = run({ T: 6, pos: true, units: { [B]: { champ: "kerrig", x: 6, y: 8 }, [E1]: { champ: "torun", x: 9, y: 8 } },
      casts: [{ tick: 2, by: B, key: "Q", aim: [9, 8] }, { tick: 8, by: B, key: "R", target: E1 }] });
    expect(r.skillHits(B, E1).filter((e) => skillIs(e, "kerrig", "R")).length).toBe(1);
    const p = r.posAt(B, 5.9);
    expect(dist(p, { x: 6, y: 8 })).toBeGreaterThan(1.0); expect(dist(p, { x: 6, y: 8 })).toBeLessThanOrEqual(5.0 + 1e-6);
    expect(dist(p, { x: 9, y: 8 })).toBeLessThan(3.0);
  });
  it("mark lasts 2.8 s (L724): R cast ≈1 s after Q dashes; R cast ≈3.6 s after Q does not", () => {
    const mk = (rTick: number) => run({ T: 8, pos: true, units: { [B]: { champ: "kerrig", x: 6, y: 8 }, [E1]: { champ: "torun", x: 9, y: 8 } },
      casts: [{ tick: 2, by: B, key: "Q", aim: [9, 8] }, { tick: rTick, by: B, key: "R", target: E1 }] });
    expect(mk(12).skillHits(B, E1).filter((e) => skillIs(e, "kerrig", "R")).length).toBe(1);
    expect(mk(40).skillHits(B, E1).filter((e) => skillIs(e, "kerrig", "R")).length).toBe(0);
  });
  it("cooldown starts on the windup even if the dash is cancelled (CD 42 s): stun mid-windup, then R is still on cooldown 5 s later", () => {
    const r = run({ T: 9, pos: true, units: { [B]: { champ: "kerrig", x: 6, y: 8 }, [E1]: { champ: "torun", x: 9, y: 8 } },
      casts: [{ tick: 2, by: B, key: "Q", aim: [9, 8] }, { tick: 8, by: B, key: "R", target: E1 }, { tick: 70, by: B, key: "R", target: E1 }],
      cc: [{ tick: 11, target: B, kind: "stun", duration: 1.0 }] });
    expect(r.of("cast_cancel", (e) => e.unit_id === B && e.skill_id !== undefined).length).toBeGreaterThanOrEqual(1);
    expect(r.skillHits(B, E1).filter((e) => skillIs(e, "kerrig", "R")).length).toBe(0);
    expect(r.casts(B, "R").length, "second R must be refused: CD started on the first windup").toBe(1);
  });
  it("landed hit: 2.8 s self-Break (Handicap) on Kerrig, no second 1.5 s commitment, Kerrig can still cast W right after", () => {
    const r = run({ T: 8, pos: true, units: { [B]: { champ: "kerrig", x: 6, y: 8 }, [E1]: { champ: "torun", x: 9, y: 8 } },
      casts: [{ tick: 2, by: B, key: "Q", aim: [9, 8] }, { tick: 8, by: B, key: "R", target: E1 }, { tick: 30, by: B, key: "W", target: E1 }] });
    const h = r.skillHits(B, E1).find((e) => skillIs(e, "kerrig", "R"))!;
    const br = r.status(B, "break");
    expect(br.length).toBe(1);
    expect(br[0]!.category).toBe("handicap");
    expect(br[0]!.raw_duration).toBeCloseTo(2.8, 6);
    expect(br[0]!.t).toBeGreaterThanOrEqual(h.t - 0.2); expect(br[0]!.t).toBeLessThanOrEqual(h.t + 0.3);
    const ex = r.expires(B, "break"); expect(ex.length).toBe(1);
    expect(ex[0]!.t - br[0]!.t).toBeGreaterThan(2.6); expect(ex[0]!.t - br[0]!.t).toBeLessThan(3.0);
    expect(r.status(B).filter((e) => e.kind !== "break").length, "no other status (no 1.5 s tax)").toBe(0);
    expect(r.casts(B, "W").length, "W is a normal cast, not blocked by the commitment").toBe(1);
  });
});
