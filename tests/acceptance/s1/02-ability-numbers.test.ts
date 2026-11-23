/**
 * Every ability of all 14 champions, cast through the real loop at L1 and L7 (R at L5 and L7: R unlocks at L5, L1 R is refused).
 * Expected values come from _oracle.ts (spec §7 text + §6.3 packet formula). Spec lines in each title.
 */
import { describe, expect, it } from "vitest";
import { abilityRun, type AbilityRun } from "./_scenarios.js";
import { ABILITIES, healAmount, mit, rawDamage, resistFor, shieldAmount, skillScale, statAt, type Ability } from "./_oracle.js";
import { dist, maxHp, near, skillIs, floorsTo } from "./_harness.js";

const cache = new Map<string, AbilityRun>();
const get = (a: Ability, L: number) => { const k = `${a.champ}${a.key}${L}`; if (!cache.has(k)) cache.set(k, abilityRun(a, L)); return cache.get(k)!; };
const levelsFor = (a: Ability) => (a.unlock === 5 ? [5, 7] : [1, 7]);

for (const a of ABILITIES) {
  for (const L of levelsFor(a)) {
    describe(`${a.champ} ${a.key} ${a.name} @L${L} (spec L${a.line})`, () => {
      const mine = (ar: AbilityRun) => ar.r.skillHits(ar.casterId, ar.foe).filter((e) => skillIs(e, a.champ, a.key));
      it("starts the cast with the authored cast time", () => {
        const ar = get(a, L);
        const cs = ar.r.casts(ar.casterId, a.key);
        expect(cs.length, "cast_start for the scripted cast").toBeGreaterThanOrEqual(1);
        const c = cs[cs.length - 1]!;
        expect(c.cast_time).toBeCloseTo(a.cast, 6);
      });

      if (a.base !== undefined) {
        const expectRaw = () => {
          let raw = rawDamage(a, L);
          return raw;
        };
        it(`deals raw=(${a.base} + ratios)×skill_scale(${skillScale(L).toFixed(2)}) (spec §6.3 L388)`, () => {
          const ar = get(a, L); const h = mine(ar);
          expect(h.length, "exactly one hit on the single enemy").toBe(1);
          let raw = expectRaw();
          if (a.finisher) {
            const hpBefore = h[0]!.hp_after + h[0]!.mitigated + (h[0]!.shield_absorbed ?? 0);
            const missing = (maxHp("torun", ar.tl) - hpBefore) / maxHp("torun", ar.tl);
            raw *= 1 + a.finisher * missing;
          }
          // hp_before is recovered from the floored hp_after (spec L124): error < 1 HP => finisher error < raw×coef/maxHp
          expect(Math.abs(h[0]!.raw - raw)).toBeLessThanOrEqual(0.02 + (a.finisher ? raw * a.finisher / maxHp("torun", ar.tl) : 0));
        });
        it(`mitigated = raw×100/(100+${a.school === "physical" ? "PRes" : "MRes"}) (spec §6.1 L335, §6.3 L408), hp_after consistent`, () => {
          const ar = get(a, L); const h = mine(ar)[0]!;
          const res = resistFor(a.school!, "torun", ar.tl);
          let raw = rawDamage(a, L);
          if (a.finisher) {
            const hpBefore = h.hp_after + h.mitigated + (h.shield_absorbed ?? 0);
            raw *= 1 + a.finisher * ((maxHp("torun", ar.tl) - hpBefore) / maxHp("torun", ar.tl));
          }
          const exp = raw * mit(res);
          expect(Math.abs(h.mitigated - exp)).toBeLessThanOrEqual(0.02 + (a.finisher ? exp * a.finisher / maxHp("torun", ar.tl) : 0));
          // the damage is actually taken: HP after = HP before - mitigated (target started at full HP; Kerrig R follows a Q, so use the prior hit)
          const prior = ar.r.skillHits(ar.casterId, ar.foe).filter((e) => e.seq < h.seq).reduce((s, e) => s + e.mitigated, 0);
          if (prior === 0) expect(floorsTo(h.hp_after, maxHp("torun", ar.tl) - h.mitigated), `hp_after ${h.hp_after} must be floor(${maxHp("torun", ar.tl)} - ${h.mitigated}) (spec L124)`).toBe(true);
        });
        it("is not a crit (skills do not crit, spec L339)", () => {
          const ar = get(a, L); for (const h of mine(ar)) expect(h.crit).toBe(false);
        });
      } else if (!a.heal && !a.shield) {
        it("deals no damage (authored no damage)", () => {
          const ar = get(a, L); expect(ar.r.skillHits(ar.casterId).filter((e) => skillIs(e, a.champ, a.key)).length).toBe(0);
        });
      }

      for (const cc of a.cc ?? []) {
        it(`applies ${cc.kind} ${cc.dur}s (${cc.category}, ${cc.school}) — duration does not scale with level (spec L${a.line}, L359)`, () => {
          const ar = get(a, L);
          const kinds = cc.kind === "stun" && a.champ === "brannoch" ? ["stun", "petrify"] : [cc.kind];
          const to = a.shape === "circle_ally" ? ar.ally : ar.foe;
          const ev = ar.r.status(to, kinds, ar.casterId);
          expect(ev.length, `status_apply ${cc.kind}`).toBe(1);
          expect(ev[0]!.category).toBe(cc.category);
          expect(ev[0]!.raw_duration).toBeCloseTo(cc.dur, 6);
          expect(ev[0]!.applied_duration).toBeCloseTo(cc.dur, 6); // first application: no DR, no taper
        });
      }
      if (a.slow) it(`applies a ${a.slow.pct * 100}% slow for ${a.slow.dur}s (Handicap) (spec L${a.line})`, () => {
        const ar = get(a, L); const ev = ar.r.status(ar.foe, "slow", ar.casterId);
        expect(ev.length).toBe(1); expect(ev[0]!.category).toBe("handicap");
        expect(ev[0]!.raw_duration).toBeCloseTo(a.slow!.dur, 6); expect(ev[0]!.applied_duration).toBeCloseTo(a.slow!.dur, 6);
      });
      if (a.heal) it(`heals ${a.heal.base}+${a.heal.pow * 100}% POW × skill_scale (spec §6.4 L425, L${a.line})`, () => {
        const ar = get(a, L);
        const to = a.shape === "self" ? ar.casterId : ar.ally;
        const h = ar.r.heals(ar.casterId, to).filter((e) => skillIs(e, a.champ, a.key));
        expect(h.length).toBeGreaterThanOrEqual(1);
        expect(h[0]!.raw).toBeCloseTo(healAmount(a, L), 1);
        expect(h[0]!.applied).toBeCloseTo(healAmount(a, L), 1); // out of combat, below max HP: ×1.0
        expect(h[0]!.combat_scaled).toBe(false);
      });
      if (a.shield) it(`shields ${a.shield.base}+${a.shield.pow * 100}% POW × skill_scale for ${a.shield.dur}s (spec L${a.line})`, () => {
        const ar = get(a, L);
        const to = a.shape === "self_dash" ? ar.casterId : ar.ally;
        const s = ar.r.shields(ar.casterId, to);
        expect(s.length).toBeGreaterThanOrEqual(1);
        expect(s[0]!.amount).toBeCloseTo(shieldAmount(a, L), 1);
        expect(s[0]!.expires_at - s[0]!.t).toBeGreaterThan(a.shield!.dur - 0.25); expect(s[0]!.expires_at - s[0]!.t).toBeLessThan(a.shield!.dur + 0.25);
      });
      if (a.dash && a.shape === "self_dash") it(`dashes ${a.dash} tiles (spec L${a.line})`, () => {
        const ar = get(a, L); const p = ar.r.posAt(ar.casterId, 5.9);
        expect(dist(p, { x: 6, y: 8 })).toBeCloseTo(a.dash!, 1);
        expect(ar.r.skillHits(ar.casterId).filter((e) => skillIs(e, a.champ, a.key)).length).toBe(0); // dashes deal no damage
        expect(ar.r.status(ar.foe).length).toBe(0);
      });
      if (a.knockback) it(`knocks the target back ${a.knockback} tiles away from the caster, as a displacement not a status (spec L${a.line}, L460)`, () => {
        const ar = get(a, L); const p = ar.r.posAt(ar.foe, 5.9);
        expect(dist(p, { x: 6, y: 8 })).toBeCloseTo(ar.d + a.knockback!, 1);
        expect(ar.r.status(ar.foe).length).toBe(0);
      });
      if (a.land_delay) it(`lands ${a.land_delay}s after the cast completes (spec L${a.line}, L508)`, () => {
        const ar = get(a, L); const c = ar.r.casts(ar.casterId, a.key).pop()!; const h = mine(ar)[0]!;
        const lag = h.t - c.t;
        expect(lag).toBeGreaterThanOrEqual(a.cast + a.land_delay! - 1e-6);
        expect(lag).toBeLessThanOrEqual(a.cast + a.land_delay! + 0.2 + 1e-6);
      });
      else if (a.base !== undefined && a.shape !== "streak") it(`resolves when the cast completes (instant at end of cast, spec L509/L511)`, () => {
        const ar = get(a, L); const c = ar.r.casts(ar.casterId, a.key).pop()!; const h = mine(ar)[0]!;
        const lag = h.t - c.t;
        expect(lag).toBeGreaterThanOrEqual(a.cast - 1e-6);
        expect(lag).toBeLessThanOrEqual(a.cast + 0.2 + 1e-6);
      });
    });
  }
}

describe("R is locked until level 5 (spec §5.2 L211, §7 'R (L5)')", () => {
  for (const a of ABILITIES.filter((x) => x.key === "R")) {
    for (const L of [1, 4]) it(`${a.champ} R is refused at L${L}`, () => {
      const ar = abilityRun(a, L);
      expect(ar.r.casts(ar.casterId, "R").length).toBe(0);
      expect(ar.r.skillHits(ar.casterId).length).toBe(0);
      expect(ar.r.status(ar.foe).length).toBe(0);
    });
  }
});

describe("L1 is skill_scale 0.70 — worked example (spec L418-421)", () => {
  it("Huntress Q L1: raw=(110+0.80×72)×0.70=117.32", () => {
    const ar = abilityRun(ABILITIES.find((x) => x.champ === "huntress" && x.key === "Q")!, 1);
    const h = ar.r.skillHits(ar.casterId, ar.foe)[0]!;
    expect(Math.abs(h.raw - 117.32)).toBeLessThanOrEqual(0.02);
  });
});
