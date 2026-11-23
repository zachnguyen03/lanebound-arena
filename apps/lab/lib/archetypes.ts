/**
 * Sandbox §6.5.1 archetype tags (proposal — implement and flag).
 * Class counts → nearest neighbour to GDD shapes; else Other.
 */
import { CHAMPIONS, type ChampClass } from "../../../data/champions/defs.js";
import type { ArchetypeTag } from "./types.js";

export const ARCHETYPE_LINEUPS: Record<
  Exclude<ArchetypeTag, "Other">,
  string[]
> = {
  Dive: ["kerrig", "rhedan", "helvar", "huntress", "saelo"],
  Peel: ["torun", "brannoch", "ysol", "mirren", "huntress"],
  Poke: ["tolle", "isra", "helvar", "huntress", "sedge"],
  Balanced: ["brannoch", "rhedan", "kerrig", "helvar", "huntress"],
};

/** Target class mixes (§6.5.1). Soft support = Enchanter or utility Mage. */
const TARGETS: Record<
  Exclude<ArchetypeTag, "Other">,
  Partial<Record<ChampClass | "soft_support" | "utility", number>>
> = {
  Dive: { Assassin: 1, Fighter: 1, Mage: 1, Marksman: 1, soft_support: 1 },
  Peel: { Tank: 2, Enchanter: 1, Mage: 1, Marksman: 1 },
  Poke: { Tank: 1, Mage: 2, Marksman: 1, utility: 1 },
  Balanced: { Tank: 1, Fighter: 1, Assassin: 1, Mage: 1, Marksman: 1 },
};

function classCounts(picks: string[]): Record<ChampClass, number> {
  const out: Record<ChampClass, number> = {
    Marksman: 0,
    Mage: 0,
    Assassin: 0,
    Fighter: 0,
    Tank: 0,
    Enchanter: 0,
  };
  for (const id of picks) {
    const def = CHAMPIONS[id];
    if (!def) continue;
    out[def.class] += 1;
  }
  return out;
}

function scoreAgainst(
  counts: Record<ChampClass, number>,
  target: Partial<Record<ChampClass | "soft_support" | "utility", number>>,
): number {
  // Soft/utility slots consume Enchanter first, else leftover Mage.
  const used = { ...counts };
  let err = 0;
  for (const [key, want] of Object.entries(target)) {
    const w = want ?? 0;
    if (key === "soft_support" || key === "utility") {
      let need = w;
      const takeEnc = Math.min(need, used.Enchanter);
      used.Enchanter -= takeEnc;
      need -= takeEnc;
      const takeMage = Math.min(need, used.Mage);
      used.Mage -= takeMage;
      need -= takeMage;
      err += need;
      continue;
    }
    const k = key as ChampClass;
    const have = used[k] ?? 0;
    err += Math.abs(have - w);
    used[k] = Math.max(0, have - w);
  }
  // Leftover classes not in the target also count as mismatch.
  for (const v of Object.values(used)) err += v;
  return err;
}

/**
 * Nearest neighbour; ties prefer Dive > Peel > Poke > Balanced.
 * INVENTION: distance > 2 → Other (exclude from edge math). Spec §6.5.1 is
 * silent on the cutoff; flagged in lab/s5/REPORT.md.
 */
export function tagArchetype(picks: string[]): ArchetypeTag {
  const counts = classCounts(picks);
  const order: Exclude<ArchetypeTag, "Other">[] = [
    "Dive",
    "Peel",
    "Poke",
    "Balanced",
  ];
  let best: ArchetypeTag = "Other";
  let bestErr = Infinity;
  for (const tag of order) {
    const err = scoreAgainst(counts, TARGETS[tag]);
    if (err < bestErr) {
      bestErr = err;
      best = tag;
    }
  }
  if (bestErr > 2) return "Other";
  return best;
}
