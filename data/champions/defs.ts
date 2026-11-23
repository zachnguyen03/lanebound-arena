/**
 * Authored champion L1 bases and skill numbers from build-spec §7.
 * Do not edit a kit number to pass a test — report disagreements.
 */

export type ChampClass =
  | "Marksman"
  | "Mage"
  | "Assassin"
  | "Fighter"
  | "Tank"
  | "Enchanter";

export type Slot = "top" | "jungle" | "mid" | "adc" | "support";
export type School = "physical" | "magic";

export interface L1Stats {
  hp: number;
  regen: number;
  atk: number;
  pow: number;
  pres: number;
  mres: number;
  as: number;
  crit: number; // fraction
  range: number;
  ms: number;
}

export interface ChampDef {
  id: string;
  class: ChampClass;
  default_slot: Slot;
  l1: L1Stats;
}

/** Class Mid-pack / 6 growth (§6.2). Exact binary64 fractions. */
export const CLASS_GROWTH: Record<
  ChampClass,
  { hp: number; atk: number; pow: number; pres: number; mres: number; as: number; crit: number; regen: number }
> = {
  Marksman: { hp: 200 / 6, atk: 28 / 6, pow: 4 / 6, pres: 10 / 6, mres: 8 / 6, as: 0.12 / 6, crit: 0.06 / 6, regen: 0.12 },
  Mage: { hp: 180 / 6, atk: 6 / 6, pow: 30 / 6, pres: 8 / 6, mres: 10 / 6, as: 0.06 / 6, crit: 0, regen: 0.1 },
  Assassin: { hp: 180 / 6, atk: 26 / 6, pow: 12 / 6, pres: 8 / 6, mres: 8 / 6, as: 0.14 / 6, crit: 0.05 / 6, regen: 0.12 },
  Fighter: { hp: 260 / 6, atk: 22 / 6, pow: 4 / 6, pres: 16 / 6, mres: 12 / 6, as: 0.08 / 6, crit: 0.03 / 6, regen: 0.18 },
  Tank: { hp: 420 / 6, atk: 10 / 6, pow: 6 / 6, pres: 22 / 6, mres: 20 / 6, as: 0.04 / 6, crit: 0, regen: 0.25 },
  Enchanter: { hp: 180 / 6, atk: 6 / 6, pow: 22 / 6, pres: 8 / 6, mres: 10 / 6, as: 0.05 / 6, crit: 0, regen: 0.1 },
};

export const CHAMPIONS: Record<string, ChampDef> = {
  huntress: {
    id: "huntress",
    class: "Marksman",
    default_slot: "adc",
    l1: { hp: 900, regen: 4, atk: 72, pow: 8, pres: 26, mres: 24, as: 0.84, crit: 0.08, range: 6.25, ms: 3.3 },
  },
  maelis: {
    id: "maelis",
    class: "Marksman",
    default_slot: "adc",
    l1: { hp: 880, regen: 3.6, atk: 48, pow: 80, pres: 24, mres: 26, as: 0.78, crit: 0.04, range: 6.5, ms: 3.25 },
  },
  isra: {
    id: "isra",
    class: "Marksman",
    default_slot: "adc",
    l1: { hp: 860, regen: 3.6, atk: 70, pow: 10, pres: 24, mres: 24, as: 0.76, crit: 0.06, range: 7, ms: 3.2 },
  },
  sedge: {
    id: "sedge",
    class: "Mage",
    default_slot: "jungle",
    l1: { hp: 980, regen: 5, atk: 50, pow: 68, pres: 30, mres: 28, as: 0.72, crit: 0.03, range: 5.25, ms: 3.45 },
  },
  torun: {
    id: "torun",
    class: "Tank",
    default_slot: "jungle",
    l1: { hp: 1300, regen: 8.2, atk: 52, pow: 26, pres: 44, mres: 40, as: 0.68, crit: 0.02, range: 1.4, ms: 3.22 },
  },
  tolle: {
    id: "tolle",
    class: "Tank",
    default_slot: "jungle",
    l1: { hp: 1340, regen: 8, atk: 52, pow: 28, pres: 44, mres: 42, as: 0.68, crit: 0.02, range: 1.5, ms: 3.25 },
  },
  helvar: {
    id: "helvar",
    class: "Mage",
    default_slot: "mid",
    l1: { hp: 1050, regen: 4.5, atk: 46, pow: 72, pres: 32, mres: 28, as: 0.7, crit: 0.02, range: 5.8, ms: 3.15 },
  },
  calder: {
    id: "calder",
    class: "Mage",
    default_slot: "mid",
    l1: { hp: 960, regen: 4.2, atk: 48, pow: 74, pres: 28, mres: 30, as: 0.74, crit: 0.02, range: 5.6, ms: 3.22 },
  },
  kerrig: {
    id: "kerrig",
    class: "Assassin",
    default_slot: "mid",
    l1: { hp: 870, regen: 4, atk: 70, pow: 36, pres: 24, mres: 24, as: 0.9, crit: 0.08, range: 1.5, ms: 3.5 },
  },
  mirren: {
    id: "mirren",
    class: "Mage",
    default_slot: "mid",
    l1: { hp: 920, regen: 4, atk: 44, pow: 70, pres: 26, mres: 30, as: 0.7, crit: 0.02, range: 5.5, ms: 3.2 },
  },
  rhedan: {
    id: "rhedan",
    class: "Fighter",
    default_slot: "top",
    l1: { hp: 1100, regen: 6.2, atk: 72, pow: 14, pres: 36, mres: 30, as: 0.78, crit: 0.05, range: 1.45, ms: 3.35 },
  },
  brannoch: {
    id: "brannoch",
    class: "Tank",
    default_slot: "top",
    l1: { hp: 1460, regen: 8, atk: 54, pow: 24, pres: 46, mres: 40, as: 0.68, crit: 0.02, range: 1.5, ms: 3.2 },
  },
  ysol: {
    id: "ysol",
    class: "Enchanter",
    default_slot: "support",
    l1: { hp: 860, regen: 3.8, atk: 42, pow: 68, pres: 24, mres: 28, as: 0.68, crit: 0.02, range: 5.4, ms: 3.28 },
  },
  saelo: {
    id: "saelo",
    class: "Mage",
    default_slot: "support",
    l1: { hp: 900, regen: 3.8, atk: 42, pow: 70, pres: 26, mres: 30, as: 0.68, crit: 0.02, range: 5.5, ms: 3.25 },
  },
};

export const CHAMPION_IDS = Object.keys(CHAMPIONS).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

/** Printed §7 snapshot rows for test 5 (authoritative display rounding targets). */
export const SNAPSHOT_TABLE: Record<
  string,
  Record<1 | 7 | 10, { hp: number; regen: number; atk: number; pow: number; pres: number; mres: number; as: number; crit_pct: number; range: number; ms: number; ehp_avg: number }>
> = {
  huntress: {
    1: { hp: 900, regen: 4, atk: 72, pow: 8, pres: 26, mres: 24, as: 0.84, crit_pct: 8.0, range: 6.25, ms: 3.3, ehp_avg: 1125 },
    7: { hp: 1100, regen: 4.72, atk: 100, pow: 12, pres: 36, mres: 32, as: 0.96, crit_pct: 14.0, range: 6.25, ms: 3.3, ehp_avg: 1474 },
    10: { hp: 1200, regen: 5.08, atk: 114, pow: 14, pres: 41, mres: 36, as: 1.02, crit_pct: 17.0, range: 6.25, ms: 3.3, ehp_avg: 1662 },
  },
  maelis: {
    1: { hp: 880, regen: 3.6, atk: 48, pow: 80, pres: 24, mres: 26, as: 0.78, crit_pct: 4.0, range: 6.5, ms: 3.25, ehp_avg: 1100 },
    7: { hp: 1080, regen: 4.32, atk: 76, pow: 84, pres: 34, mres: 34, as: 0.9, crit_pct: 10.0, range: 6.5, ms: 3.25, ehp_avg: 1447.2 },
    10: { hp: 1180, regen: 4.68, atk: 90, pow: 86, pres: 39, mres: 38, as: 0.96, crit_pct: 13.0, range: 6.5, ms: 3.25, ehp_avg: 1634.3 },
  },
  isra: {
    1: { hp: 860, regen: 3.6, atk: 70, pow: 10, pres: 24, mres: 24, as: 0.76, crit_pct: 6.0, range: 7, ms: 3.2, ehp_avg: 1066.4 },
    7: { hp: 1060, regen: 4.32, atk: 98, pow: 14, pres: 34, mres: 32, as: 0.88, crit_pct: 12.0, range: 7, ms: 3.2, ehp_avg: 1409.8 },
    10: { hp: 1160, regen: 4.68, atk: 112, pow: 16, pres: 39, mres: 36, as: 0.94, crit_pct: 15.0, range: 7, ms: 3.2, ehp_avg: 1595 },
  },
  sedge: {
    1: { hp: 980, regen: 5, atk: 50, pow: 68, pres: 30, mres: 28, as: 0.72, crit_pct: 3.0, range: 5.25, ms: 3.45, ehp_avg: 1264.2 },
    7: { hp: 1160, regen: 5.6, atk: 56, pow: 98, pres: 38, mres: 38, as: 0.78, crit_pct: 3.0, range: 5.25, ms: 3.45, ehp_avg: 1600.8 },
    10: { hp: 1250, regen: 5.9, atk: 59, pow: 113, pres: 42, mres: 43, as: 0.81, crit_pct: 3.0, range: 5.25, ms: 3.45, ehp_avg: 1781.25 },
  },
  torun: {
    1: { hp: 1300, regen: 8.2, atk: 52, pow: 26, pres: 44, mres: 40, as: 0.68, crit_pct: 2.0, range: 1.4, ms: 3.22, ehp_avg: 1846 },
    7: { hp: 1720, regen: 9.7, atk: 62, pow: 32, pres: 66, mres: 60, as: 0.72, crit_pct: 2.0, range: 1.4, ms: 3.22, ehp_avg: 2803.6 },
    10: { hp: 1930, regen: 10.45, atk: 67, pow: 35, pres: 77, mres: 70, as: 0.74, crit_pct: 2.0, range: 1.4, ms: 3.22, ehp_avg: 3348.55 },
  },
  tolle: {
    1: { hp: 1340, regen: 8, atk: 52, pow: 28, pres: 44, mres: 42, as: 0.68, crit_pct: 2.0, range: 1.5, ms: 3.25, ehp_avg: 1916.2 },
    7: { hp: 1760, regen: 9.5, atk: 62, pow: 34, pres: 66, mres: 62, as: 0.72, crit_pct: 2.0, range: 1.5, ms: 3.25, ehp_avg: 2886.4 },
    10: { hp: 1970, regen: 10.25, atk: 67, pow: 37, pres: 77, mres: 72, as: 0.74, crit_pct: 2.0, range: 1.5, ms: 3.25, ehp_avg: 3437.65 },
  },
  helvar: {
    1: { hp: 1050, regen: 4.5, atk: 46, pow: 72, pres: 32, mres: 28, as: 0.7, crit_pct: 2.0, range: 5.8, ms: 3.15, ehp_avg: 1365 },
    7: { hp: 1230, regen: 5.1, atk: 52, pow: 102, pres: 40, mres: 38, as: 0.76, crit_pct: 2.0, range: 5.8, ms: 3.15, ehp_avg: 1709.7 },
    10: { hp: 1320, regen: 5.4, atk: 55, pow: 117, pres: 44, mres: 43, as: 0.79, crit_pct: 2.0, range: 5.8, ms: 3.15, ehp_avg: 1894.2 },
  },
  calder: {
    1: { hp: 960, regen: 4.2, atk: 48, pow: 74, pres: 28, mres: 30, as: 0.74, crit_pct: 2.0, range: 5.6, ms: 3.22, ehp_avg: 1238.4 },
    7: { hp: 1140, regen: 4.8, atk: 54, pow: 104, pres: 36, mres: 40, as: 0.8, crit_pct: 2.0, range: 5.6, ms: 3.22, ehp_avg: 1573.2 },
    10: { hp: 1230, regen: 5.1, atk: 57, pow: 119, pres: 40, mres: 45, as: 0.83, crit_pct: 2.0, range: 5.6, ms: 3.22, ehp_avg: 1752.75 },
  },
  kerrig: {
    1: { hp: 870, regen: 4, atk: 70, pow: 36, pres: 24, mres: 24, as: 0.9, crit_pct: 8.0, range: 1.5, ms: 3.5, ehp_avg: 1078.8 },
    7: { hp: 1050, regen: 4.72, atk: 96, pow: 48, pres: 32, mres: 32, as: 1.04, crit_pct: 13.0, range: 1.5, ms: 3.5, ehp_avg: 1386 },
    10: { hp: 1140, regen: 5.08, atk: 109, pow: 54, pres: 36, mres: 36, as: 1.11, crit_pct: 15.5, range: 1.5, ms: 3.5, ehp_avg: 1550.4 },
  },
  mirren: {
    1: { hp: 920, regen: 4, atk: 44, pow: 70, pres: 26, mres: 30, as: 0.7, crit_pct: 2.0, range: 5.5, ms: 3.2, ehp_avg: 1177.6 },
    7: { hp: 1100, regen: 4.6, atk: 50, pow: 100, pres: 34, mres: 40, as: 0.76, crit_pct: 2.0, range: 5.5, ms: 3.2, ehp_avg: 1507 },
    10: { hp: 1190, regen: 4.9, atk: 53, pow: 115, pres: 38, mres: 45, as: 0.79, crit_pct: 2.0, range: 5.5, ms: 3.2, ehp_avg: 1683.85 },
  },
  rhedan: {
    1: { hp: 1100, regen: 6.2, atk: 72, pow: 14, pres: 36, mres: 30, as: 0.78, crit_pct: 5.0, range: 1.45, ms: 3.35, ehp_avg: 1463 },
    7: { hp: 1360, regen: 7.28, atk: 94, pow: 18, pres: 52, mres: 42, as: 0.86, crit_pct: 8.0, range: 1.45, ms: 3.35, ehp_avg: 1999.2 },
    10: { hp: 1490, regen: 7.82, atk: 105, pow: 20, pres: 60, mres: 48, as: 0.9, crit_pct: 9.5, range: 1.45, ms: 3.35, ehp_avg: 2294.6 },
  },
  brannoch: {
    1: { hp: 1460, regen: 8, atk: 54, pow: 24, pres: 46, mres: 40, as: 0.68, crit_pct: 2.0, range: 1.5, ms: 3.2, ehp_avg: 2087.8 },
    7: { hp: 1880, regen: 9.5, atk: 64, pow: 30, pres: 68, mres: 60, as: 0.72, crit_pct: 2.0, range: 1.5, ms: 3.2, ehp_avg: 3083.2 },
    10: { hp: 2090, regen: 10.25, atk: 69, pow: 33, pres: 79, mres: 70, as: 0.74, crit_pct: 2.0, range: 1.5, ms: 3.2, ehp_avg: 3647.05 },
  },
  ysol: {
    1: { hp: 860, regen: 3.8, atk: 42, pow: 68, pres: 24, mres: 28, as: 0.68, crit_pct: 2.0, range: 5.4, ms: 3.28, ehp_avg: 1083.6 },
    7: { hp: 1040, regen: 4.4, atk: 48, pow: 90, pres: 32, mres: 38, as: 0.73, crit_pct: 2.0, range: 5.4, ms: 3.28, ehp_avg: 1404 },
    10: { hp: 1130, regen: 4.7, atk: 51, pow: 101, pres: 36, mres: 43, as: 0.755, crit_pct: 2.0, range: 5.4, ms: 3.28, ehp_avg: 1576.35 },
  },
  saelo: {
    1: { hp: 900, regen: 3.8, atk: 42, pow: 70, pres: 26, mres: 30, as: 0.68, crit_pct: 2.0, range: 5.5, ms: 3.25, ehp_avg: 1152 },
    7: { hp: 1080, regen: 4.4, atk: 48, pow: 100, pres: 34, mres: 40, as: 0.74, crit_pct: 2.0, range: 5.5, ms: 3.25, ehp_avg: 1479.6 },
    10: { hp: 1170, regen: 4.7, atk: 51, pow: 115, pres: 38, mres: 45, as: 0.77, crit_pct: 2.0, range: 5.5, ms: 3.25, ehp_avg: 1655.55 },
  },
};
