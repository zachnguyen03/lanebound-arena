/**
 * S1 ACCEPTANCE ORACLE — every number below is transcribed from the build spec
 * (gdd/lanebound-arena-build-spec-v1.md), with the spec line it came from.
 * It is NEVER derived from data/champions/kits.ts or from sim code.
 * "L<n>" in comments = spec line number. Stat tables live in _oracle-stats.ts (generated from the spec).
 */
import { SPEC_STATS } from "./_oracle-stats.js";

export type Key = "Q" | "W" | "R";
export type School = "physical" | "magic";
export type Category = "lock" | "bind" | "handicap";

/** §6.2 class growth table (L370-377): per-level growth, exact fractions (Mid pack / 6). */
export const CLASS_GROWTH: Record<string, { hp: number; atk: number; pow: number; pres: number; mres: number; as_: number; crit: number; regen: number }> = {
  Marksman: { hp: 200 / 6, atk: 28 / 6, pow: 4 / 6, pres: 10 / 6, mres: 8 / 6, as_: 0.12 / 6, crit: 0.06 / 6, regen: 0.12 },
  Mage: { hp: 180 / 6, atk: 6 / 6, pow: 30 / 6, pres: 8 / 6, mres: 10 / 6, as_: 0.06 / 6, crit: 0, regen: 0.1 },
  Assassin: { hp: 180 / 6, atk: 26 / 6, pow: 12 / 6, pres: 8 / 6, mres: 8 / 6, as_: 0.14 / 6, crit: 0.05 / 6, regen: 0.12 },
  Fighter: { hp: 260 / 6, atk: 22 / 6, pow: 4 / 6, pres: 16 / 6, mres: 12 / 6, as_: 0.08 / 6, crit: 0.03 / 6, regen: 0.18 },
  Tank: { hp: 420 / 6, atk: 10 / 6, pow: 6 / 6, pres: 22 / 6, mres: 20 / 6, as_: 0.04 / 6, crit: 0, regen: 0.25 },
  Enchanter: { hp: 180 / 6, atk: 6 / 6, pow: 22 / 6, pres: 8 / 6, mres: 10 / 6, as_: 0.05 / 6, crit: 0, regen: 0.1 },
};

export const CHAMPS = ["huntress", "maelis", "isra", "sedge", "torun", "tolle", "helvar", "calder", "kerrig", "mirren", "rhedan", "brannoch", "ysol", "saelo"] as const;
export type Champ = (typeof CHAMPS)[number];

export interface Stats { hp: number; regen: number; atk: number; pow: number; pres: number; mres: number; as_: number; crit: number; range: number; ms: number }

/** stat(L) = base_L1 + growth*(L-1)  (L355). L1/L7/L10 are also the printed §7 rows; those rows are used verbatim. */
export function statAt(champ: string, L: number): Stats {
  const c = SPEC_STATS[champ]!;
  const r1 = c.rows["1"];
  const g = CLASS_GROWTH[c.class]!;
  const out: Stats = {
    hp: r1.hp + g.hp * (L - 1), regen: r1.regen + g.regen * (L - 1), atk: r1.atk + g.atk * (L - 1), pow: r1.pow + g.pow * (L - 1),
    pres: r1.pres + g.pres * (L - 1), mres: r1.mres + g.mres * (L - 1), as_: r1.as_ + g.as_ * (L - 1), crit: Math.min(0.8, r1.crit + g.crit * (L - 1)),
    range: r1.range, ms: r1.ms,
  };
  const row = (c.rows as any)[String(L)];
  if (row) { out.hp = row.hp; out.regen = row.regen; out.atk = row.atk; out.pow = row.pow; out.pres = row.pres; out.mres = row.mres; out.as_ = row.as_; out.crit = row.crit; }
  return out;
}
/** L359: skill_scale(L) = 1 + 0.05*(L-7). */
export const skillScale = (L: number) => 1 + 0.05 * (L - 7);
/** L335: mit(resist) = 100/(100+max(0,resist)). */
export const mit = (res: number) => 100 / (100 + Math.max(0, res));

export interface CcSpec { kind: string; category: Category; dur: number; school: School; note?: string }

export interface Ability {
  champ: Champ; key: Key; name: string; line: number; unlock: 1 | 5;
  /** geometry class used by the shape tests */
  shape: "line" | "cone_skill" | "cone_target" | "circle_point" | "circle_target" | "circle_self" | "circle_ally" | "target" | "ally_target" | "self" | "self_dash" | "streak";
  range: number; radius?: number; width?: number; angle?: number;
  pierce?: "all" | "first";
  school?: School;
  /** L7 base and ratios (L383-405 §6.3: authored numbers are L7 bases) */
  base?: number; atk?: number; pow?: number;
  cd: number; cast: number; land_delay?: number;
  cc?: CcSpec[];
  /** slow as separate handicap: pct of speed removed, seconds */
  slow?: { pct: number; dur: number; school: School };
  heal?: { base: number; pow: number };
  shield?: { base: number; pow: number; dur: number };
  dash?: number;
  finisher?: number;       // missing-HP coefficient
  markDur?: number;        // applies a mark of this duration
  markBonus?: number;      // consumes a live mark for this multiplier
  needsMark?: boolean;
  knockback?: number;      // tiles away from caster
  pull?: number;           // tiles toward caster
  hitsAllies?: boolean;    // enemies AND allies except caster
  dispel?: "basic" | "strong";
}

const A = (a: Ability): Ability => a;
/** Every entry cites its spec line (the `**Q — Name**` line). */
export const ABILITIES: Ability[] = [
  // 7.1 Huntress
  A({ champ: "huntress", key: "Q", name: "Keen Bolt", line: 552, unlock: 1, shape: "line", range: 8, width: 0.5, pierce: "all", school: "physical", base: 110, atk: 0.8, cd: 8, cast: 0.33, markDur: 4 }),
  A({ champ: "huntress", key: "W", name: "Switchback", line: 554, unlock: 1, shape: "self_dash", range: 0, dash: 2, cd: 11, cast: 0.15 }),
  A({ champ: "huntress", key: "R", name: "Horizon Volley", line: 556, unlock: 5, shape: "circle_point", range: 7.5, radius: 2.6, school: "physical", base: 230, atk: 1.05, cd: 55, cast: 0.6, markBonus: 1.35 }),
  // 7.2 Maelis
  A({ champ: "maelis", key: "Q", name: "Prism Split", line: 573, unlock: 1, shape: "line", range: 7.8, width: 0.55, pierce: "all", school: "magic", base: 160, pow: 1.35, cd: 7, cast: 0.3 }),
  A({ champ: "maelis", key: "W", name: "Glass Veil", line: 575, unlock: 1, shape: "self_dash", range: 0, dash: 2.5, cd: 11, cast: 0.15, shield: { base: 80, pow: 0.4, dur: 2.5 } }),
  A({ champ: "maelis", key: "R", name: "Duskburst", line: 577, unlock: 5, shape: "circle_point", range: 7.6, radius: 2.0, school: "magic", base: 350, pow: 1.7, cd: 55, cast: 0.55, finisher: 0.2 }),
  // 7.3 Isra
  A({ champ: "isra", key: "Q", name: "Fuse Shot", line: 594, unlock: 1, shape: "circle_point", range: 8.5, radius: 1.4, school: "physical", base: 90, atk: 0.7, cd: 8, cast: 0.3, land_delay: 1.0 }),
  A({ champ: "isra", key: "W", name: "Recoil Step", line: 596, unlock: 1, shape: "self_dash", range: 0, dash: 2.5, cd: 12, cast: 0.15 }),
  A({ champ: "isra", key: "R", name: "Starfall Mortar", line: 598, unlock: 5, shape: "circle_point", range: 12, radius: 3.4, school: "physical", base: 145, atk: 0.75, cd: 60, cast: 0.5, land_delay: 1.2 }),
  // 7.4 Sedge
  A({ champ: "sedge", key: "Q", name: "Lantern Sweep", line: 615, unlock: 1, shape: "circle_target", range: 5.5, radius: 2.2, school: "magic", base: 115, pow: 0.9, cd: 6.8, cast: 0.28 }),
  A({ champ: "sedge", key: "W", name: "Wickbind", line: 617, unlock: 1, shape: "line", range: 6.5, width: 0.5, pierce: "all", school: "magic", base: 55, atk: 0.1, pow: 0.5, cd: 12.5, cast: 0.3, cc: [{ kind: "root", category: "bind", dur: 0.85, school: "magic" }] }),
  A({ champ: "sedge", key: "R", name: "Mire Drowse", line: 619, unlock: 5, shape: "circle_point", range: 11, radius: 3.8, school: "magic", base: 85, pow: 0.45, cd: 60, cast: 0.55, cc: [{ kind: "sleep", category: "lock", dur: 2.8, school: "magic" }], hitsAllies: true }),
  // 7.5 Torun
  A({ champ: "torun", key: "Q", name: "Shell-Slam", line: 636, unlock: 1, shape: "circle_target", range: 2.2, radius: 1.6, school: "magic", base: 70, atk: 0.2, pow: 0.4, cd: 8.5, cast: 0.28, cc: [{ kind: "knockup", category: "lock", dur: 0.95, school: "magic" }, { kind: "taunt", category: "handicap", dur: 2.0, school: "magic" }] }),
  A({ champ: "torun", key: "W", name: "Sluice Ward", line: 638, unlock: 1, shape: "circle_ally", range: 6, radius: 1.2, cd: 12, cast: 0.2, shield: { base: 200, pow: 0.6, dur: 2.5 } }),
  A({ champ: "torun", key: "R", name: "Lock-Tide", line: 640, unlock: 5, shape: "circle_point", range: 6, radius: 3.2, school: "magic", base: 90, atk: 0.15, pow: 0.5, cd: 65, cast: 0.45, cc: [{ kind: "stun", category: "lock", dur: 1.25, school: "magic" }] }),
  // 7.6 Tolle
  A({ champ: "tolle", key: "Q", name: "Bucket Slam", line: 657, unlock: 1, shape: "circle_target", range: 2.2, radius: 1.6, school: "magic", base: 75, atk: 0.15, pow: 0.3, cd: 9, cast: 0.28, cc: [{ kind: "stun", category: "lock", dur: 0.9, school: "magic" }] }),
  A({ champ: "tolle", key: "W", name: "Draw Down", line: 659, unlock: 1, shape: "target", range: 6, radius: 0, cd: 18, cast: 0.2, cc: [{ kind: "banish", category: "lock", dur: 1.8, school: "magic" }] }),
  A({ champ: "tolle", key: "R", name: "Upwelling", line: 665, unlock: 5, shape: "circle_point", range: 7, radius: 3.4, school: "magic", base: 80, pow: 0.4, cd: 70, cast: 0.4, land_delay: 0.8, cc: [{ kind: "knockup", category: "lock", dur: 1.1, school: "magic" }] }),
  // 7.7 Helvar
  A({ champ: "helvar", key: "Q", name: "Stoneverse", line: 682, unlock: 1, shape: "line", range: 8, width: 0.6, pierce: "all", school: "magic", base: 100, pow: 0.9, cd: 6.8, cast: 0.3 }),
  A({ champ: "helvar", key: "W", name: "Faultline", line: 684, unlock: 1, shape: "line", range: 8.5, width: 2.0, pierce: "all", school: "magic", base: 65, pow: 0.5, cd: 11.5, cast: 0.4, cc: [{ kind: "root", category: "bind", dur: 0.8, school: "magic" }], slow: { pct: 0.35, dur: 1.0, school: "magic" } }),
  A({ champ: "helvar", key: "R", name: "Cliffwake", line: 686, unlock: 5, shape: "line", range: 9, width: 2.2, pierce: "all", school: "magic", base: 230, pow: 1.15, cd: 65, cast: 0.5, knockback: 2.2 }),
  // 7.8 Calder
  A({ champ: "calder", key: "Q", name: "Ashbreath", line: 703, unlock: 1, shape: "cone_skill", range: 6.4, angle: 60, school: "magic", base: 115, pow: 0.95, cd: 6.5, cast: 0.28 }),
  A({ champ: "calder", key: "W", name: "Smoke Drink", line: 705, unlock: 1, shape: "self", range: 0, radius: 0, cd: 12.5, cast: 0.2, heal: { base: 75, pow: 0.45 } }),
  A({ champ: "calder", key: "R", name: "Ash Panic", line: 707, unlock: 5, shape: "circle_point", range: 7, radius: 3.0, school: "magic", base: 215, pow: 1.1, cd: 58, cast: 0.45, cc: [{ kind: "fear", category: "lock", dur: 1.6, school: "magic" }] }),
  // 7.9 Kerrig
  A({ champ: "kerrig", key: "Q", name: "Latch Line", line: 724, unlock: 1, shape: "line", range: 6.5, width: 0.45, pierce: "first", school: "physical", base: 110, atk: 0.85, cd: 7.5, cast: 0.28, cc: [{ kind: "leash", category: "bind", dur: 2.8, school: "physical" }], markDur: 2.8 }),
  A({ champ: "kerrig", key: "W", name: "Spool Cut", line: 726, unlock: 1, shape: "circle_target", range: 1.8, radius: 1.2, school: "physical", base: 95, atk: 0.9, cd: 7, cast: 0.12, slow: { pct: 0.3, dur: 0.8, school: "physical" } }),
  A({ champ: "kerrig", key: "R", name: "Reeling Cut", line: 728, unlock: 5, shape: "streak", range: 5.5, dash: 5, school: "physical", base: 330, atk: 1.4, pow: 0.15, cd: 42, cast: 0.7, needsMark: true, finisher: 0.35 }),
  // 7.10 Mirren
  A({ champ: "mirren", key: "Q", name: "Glaze Spit", line: 745, unlock: 1, shape: "circle_target", range: 6, radius: 1.6, school: "magic", base: 115, pow: 0.9, cd: 7, cast: 0.28 }),
  A({ champ: "mirren", key: "W", name: "Jarring", line: 747, unlock: 1, shape: "target", range: 6, radius: 0, cd: 15, cast: 0.25, cc: [{ kind: "hex", category: "lock", dur: 1.6, school: "magic" }] }),
  A({ champ: "mirren", key: "R", name: "Kiln Chorus", line: 751, unlock: 5, shape: "circle_point", range: 8, radius: 2.8, school: "magic", base: 150, pow: 0.75, cd: 70, cast: 0.55, cc: [{ kind: "hex", category: "lock", dur: 1.5, school: "magic" }] }),
  // 7.11 Rhedan
  A({ champ: "rhedan", key: "Q", name: "Tide-Cleave", line: 768, unlock: 1, shape: "cone_target", range: 3, angle: 70, school: "physical", base: 90, atk: 0.75, cd: 7, cast: 0.25 }),
  A({ champ: "rhedan", key: "W", name: "Wake Hook", line: 770, unlock: 1, shape: "line", range: 5.5, width: 0.5, pierce: "first", school: "physical", base: 45, atk: 0.3, cd: 12, cast: 0.3, cc: [{ kind: "root", category: "bind", dur: 0.7, school: "physical" }], pull: 4 }),
  A({ champ: "rhedan", key: "R", name: "Keelbreak", line: 772, unlock: 5, shape: "circle_target", range: 2.8, radius: 2.4, school: "physical", base: 150, atk: 0.9, cd: 50, cast: 0.4, cc: [{ kind: "knockup", category: "lock", dur: 0.9, school: "physical" }] }),
  // 7.12 Brannoch
  A({ champ: "brannoch", key: "Q", name: "Quarry Throw", line: 789, unlock: 1, shape: "line", range: 6.5, width: 0.6, pierce: "all", school: "physical", base: 125, atk: 0.65, cd: 8, cast: 0.3, slow: { pct: 0.35, dur: 1.5, school: "physical" } }),
  A({ champ: "brannoch", key: "W", name: "Cairn Shoulder", line: 791, unlock: 1, shape: "streak", range: 3.5, school: "physical", base: 90, atk: 0.45, cd: 12, cast: 0.2, cc: [{ kind: "knockup", category: "lock", dur: 0.6, school: "physical" }] }),
  A({ champ: "brannoch", key: "R", name: "Stonefast", line: 793, unlock: 5, shape: "circle_self", range: 2.6, radius: 2.6, school: "magic", base: 170, atk: 0.2, pow: 0.45, cd: 60, cast: 0.4, cc: [{ kind: "stun", category: "lock", dur: 1.6, school: "magic", note: "petrify tag: kind may be reported as 'stun' or 'petrify' (L458 'Petrify is a stun (Lock)')" }] }),
  // 7.13 Ysol
  A({ champ: "ysol", key: "Q", name: "Kiln Bell", line: 810, unlock: 1, shape: "cone_target", range: 7.2, angle: 80, school: "magic", base: 60, pow: 0.4, cd: 12.5, cast: 0.3, cc: [{ kind: "silence", category: "handicap", dur: 1.0, school: "magic" }] }),
  A({ champ: "ysol", key: "W", name: "Ember Mending", line: 812, unlock: 1, shape: "circle_ally", range: 6.5, radius: 1.2, cd: 13, cast: 0.25, heal: { base: 95, pow: 0.45 }, dispel: "strong" }),
  A({ champ: "ysol", key: "R", name: "Vowbreak", line: 814, unlock: 5, shape: "circle_point", range: 6, radius: 2.6, school: "magic", base: 105, pow: 0.7, cd: 70, cast: 0.45, cc: [{ kind: "knockup", category: "lock", dur: 1.05, school: "magic" }] }),
  // 7.14 Saelo
  A({ champ: "saelo", key: "Q", name: "Second Hand", line: 831, unlock: 1, shape: "line", range: 7, width: 0.5, pierce: "all", school: "magic", base: 105, pow: 0.8, cd: 8, cast: 0.3, slow: { pct: 0.3, dur: 1.2, school: "magic" } }),
  A({ champ: "saelo", key: "W", name: "Unwind", line: 833, unlock: 1, shape: "ally_target", range: 6.5, radius: 0, cd: 14, cast: 0.25, heal: { base: 65, pow: 0.35 }, dispel: "basic" }),
  A({ champ: "saelo", key: "R", name: "Still Hour", line: 837, unlock: 5, shape: "circle_point", range: 8, radius: 2.4, school: "magic", base: 90, pow: 0.45, cd: 85, cast: 0.7, cc: [{ kind: "timestop", category: "lock", dur: 2.0, school: "magic" }], hitsAllies: true }),
];

export const ab = (champ: string, key: Key): Ability => ABILITIES.find((a) => a.champ === champ && a.key === key)!;

/** raw = (base + ratio_atk*ATK(L) + ratio_pow*POW(L)) * skill_scale(L)   (§6.3 raw formula). Finishers/marks handled by the caller. */
export function rawDamage(a: Ability, casterLevel: number): number {
  const s = statAt(a.champ, casterLevel);
  return ((a.base ?? 0) + (a.atk ?? 0) * s.atk + (a.pow ?? 0) * s.pow) * skillScale(casterLevel);
}
export function healAmount(a: Ability, casterLevel: number): number {
  const s = statAt(a.champ, casterLevel);
  return (a.heal!.base + a.heal!.pow * s.pow) * skillScale(casterLevel);
}
export function shieldAmount(a: Ability, casterLevel: number): number {
  const s = statAt(a.champ, casterLevel);
  return (a.shield!.base + a.shield!.pow * s.pow) * skillScale(casterLevel);
}
export const resistFor = (school: School, champ: string, level: number) => (school === "physical" ? statAt(champ, level).pres : statAt(champ, level).mres);

/** §5.3 L229-230 */
export const KILL_XP = 45;
export const ASSIST_XP = 20;
/** §6.4 combat heal L425, shield cap L429 */
export const COMBAT_HEAL = 0.75, COMBAT_WINDOW = 3.0, SHIELD_CAP = 0.25;
/** §6.10 assist window (L525-527) */
export const ASSIST_WINDOW = 6.0;
