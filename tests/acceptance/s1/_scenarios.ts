import { ALLY, CASTER, CX, CY, FOE, run, testDist, type CastSpec, type Run, type Scenario } from "./_harness.js";
import type { Ability } from "./_oracle.js";

export const TARGET_CHAMP = "torun";
export const MAIN_TICK = 5;

export interface AbilityRun { r: Run; a: Ability; L: number; tl: number; casterId: typeof CASTER; foe: typeof FOE; ally: typeof ALLY; castTick: number; d: number; sc: Scenario }

/** One isolated cast of ability `a` by a level-L caster against a level-`tl` Torun (resists from the spec table). */
export function abilityRun(a: Ability, L: number, tl = L, extra: Partial<Scenario> = {}): AbilityRun {
  const d = testDist(a);
  const targetsAlly = a.shape === "ally_target" || a.shape === "circle_ally";
  const units: Scenario["units"] = {
    [CASTER]: { champ: a.champ, level: L, x: CX, y: CY, ...(a.shape === "self" ? { hp: { frac: 0.5 } } : {}) },
    [FOE]: { champ: TARGET_CHAMP, level: tl, x: CX + d, y: targetsAlly && a.champ !== "tolle" ? CY + 6 : CY },
    [ALLY]: { champ: TARGET_CHAMP, level: tl, x: targetsAlly ? CX + d : CX, y: targetsAlly ? CY : CY + 6, hp: { frac: 0.5 } },
  };
  const castTick = a.needsMark ? 8 : MAIN_TICK;
  const casts: CastSpec[] = [];
  if (a.needsMark) casts.push({ tick: 2, by: CASTER, key: "Q", aim: [CX + d, CY] });
  const c: CastSpec = { tick: castTick, by: CASTER, key: a.key };
  switch (a.shape) {
    case "line": case "cone_skill": case "circle_point": c.aim = [CX + d, CY]; break;
    case "circle_self": c.aim = [CX, CY]; break;
    case "self_dash": c.aim = [CX + 6, CY]; break;
    case "circle_target": case "cone_target": case "target": case "streak": c.target = FOE; break;
    case "ally_target": case "circle_ally": c.target = ALLY; break;
    case "self": break;
  }
  if (a.shape === "streak" && a.champ === "kerrig") c.target = FOE;
  casts.push(c);
  const sc: Scenario = { T: 6, pos: true, ...extra, units: { ...units, ...(extra.units ?? {}) }, casts: extra.casts ?? casts };
  return { r: run(sc), a, L, tl, casterId: CASTER, foe: FOE, ally: ALLY, castTick, d, sc };
}
