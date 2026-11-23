/**
 * M1 test 5 (spec L1709): L1/L7/L10 snapshot stats of all 14 match the §7 tables after rounding to the printed precision.
 * Plus every intermediate level from the §6.2 growth formula (exact fractions, L355-377).
 * Stats are read from the final MatchState (`state.units[i].stats`, `max_hp`) of a real simulate() call with unit_overrides.level.
 */
import { describe, expect, it } from "vitest";
import { CHAMPS, mit, statAt } from "./_oracle.js";
import { SPEC_STATS } from "./_oracle-stats.js";
import { run } from "./_harness.js";

const snapshot = (champ: string, L: number) => run({ T: 0.1, units: { "blue:mid": { champ, level: L, x: 6, y: 8 } } }).unit("blue:mid");

describe("M1-5 snapshot stats (spec §7 tables, L539-838)", () => {
  for (const champ of CHAMPS) for (const L of [1, 7, 10] as const) {
    const row = SPEC_STATS[champ]!.rows[String(L) as "1"];
    it(`${champ} L${L} matches the printed row (spec L${row.line})`, () => {
      const u = snapshot(champ, L);
      expect(u.level).toBe(L);
      expect(Math.round(u.max_hp)).toBe(row.hp);               // HP integer
      expect(Math.abs(u.stats.regen - row.regen)).toBeLessThanOrEqual(0.005);
      expect(Math.abs(u.stats.atk - row.atk)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(u.stats.pow - row.pow)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(u.stats.pres - row.pres)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(u.stats.mres - row.mres)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(u.stats.as - row.as_)).toBeLessThanOrEqual(0.0005);   // AS to 3 decimals
      expect(Math.abs(u.stats.crit - row.crit)).toBeLessThanOrEqual(0.0005); // crit to 0.1%
      expect(u.stats.range).toBeCloseTo(row.range, 6);          // range and MS do not grow (L356)
      expect(u.stats.ms).toBeCloseTo(row.ms, 6);
    });
    it(`${champ} L${L} eHP avg = 0.5*(hp*(100+PRes)/100 + hp*(100+MRes)/100) matches the printed value (spec L336-338, row L${row.line})`, () => {
      const u = snapshot(champ, L);
      const ehp = 0.5 * (u.max_hp * (100 + u.stats.pres) / 100 + u.max_hp * (100 + u.stats.mres) / 100);
      expect(Math.abs(ehp - row.ehp_avg)).toBeLessThanOrEqual(0.06);
    });
  }
});

describe("stat(L)=base_L1+growth*(L-1) with exact fractions at every level 1..10 (spec L355, L370-377; sim must not round)", () => {
  for (const champ of CHAMPS) it(`${champ} L2..L9 follow the class growth table`, () => {
    for (let L = 2; L <= 9; L++) {
      if (L === 7) continue;
      const u = snapshot(champ, L); const e = statAt(champ, L);
      expect(u.max_hp, `${champ} L${L} hp`).toBeCloseTo(e.hp, 9);
      expect(u.stats.atk).toBeCloseTo(e.atk, 9);
      expect(u.stats.pow).toBeCloseTo(e.pow, 9);
      expect(u.stats.pres).toBeCloseTo(e.pres, 9);
      expect(u.stats.mres).toBeCloseTo(e.mres, 9);
      expect(u.stats.as).toBeCloseTo(e.as_, 9);
      expect(u.stats.crit).toBeCloseTo(e.crit, 9);
      expect(u.stats.regen).toBeCloseTo(e.regen, 9);
    }
  });
});

describe("crit cap and mit() (spec L348, L335)", () => {
  it("mit(66)=100/166", () => expect(mit(66)).toBeCloseTo(0.60241, 5));
  it("no champion exceeds the 0.80 crit cap at L10", () => { for (const c of CHAMPS) expect(snapshot(c, 10).stats.crit).toBeLessThanOrEqual(0.8); });
});
