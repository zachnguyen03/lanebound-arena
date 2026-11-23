import type { CompArchetype } from "@lanebound/match-contract";

/**
 * Class of each stand-in champion. A utility mage (Saelo) can count as a mage
 * or as a soft support. An enchanter counts as soft support. Sandbox §6.5.1.
 */
const CLASS = {
  brannoch: "tank",
  rhedan: "fighter",
  sedge: "mage",
  tolle: "tank",
  torun: "tank",
  calder: "mage",
  helvar: "mage",
  kerrig: "assassin",
  mirren: "mage",
  huntress: "marksman",
  isra: "marksman",
  maelis: "marksman",
  saelo: "utility",
  ysol: "enchanter",
} as const;

type Kind = (typeof CLASS)[keyof typeof CLASS];
type Bucket = "tank" | "fighter" | "assassin" | "mage" | "marksman" | "support";
type Counts = Record<Bucket, number>;

/** Prototypes of the §6.5.1 shapes. Dive's 2 assassin/fighter is the recommended 1 and 1. */
const TARGETS: Record<CompArchetype, Counts> = {
  Dive: { tank: 0, fighter: 1, assassin: 1, mage: 1, marksman: 1, support: 1 },
  Peel: { tank: 2, fighter: 0, assassin: 0, mage: 1, marksman: 1, support: 1 },
  Poke: { tank: 1, fighter: 0, assassin: 0, mage: 2, marksman: 1, support: 1 },
  Balanced: { tank: 1, fighter: 1, assassin: 1, mage: 1, marksman: 1, support: 0 },
};

/** Ties break Balanced, then Dive, then Peel, then Poke. */
const TIE: readonly CompArchetype[] = ["Balanced", "Dive", "Peel", "Poke"];
const BUCKETS: readonly Bucket[] = ["tank", "fighter", "assassin", "mage", "marksman", "support"];

function empty(): Counts {
  return { tank: 0, fighter: 0, assassin: 0, mage: 0, marksman: 0, support: 0 };
}

function distance(left: Counts, right: Counts): number {
  let total = 0;
  for (const key of BUCKETS) {
    const delta = left[key] - right[key];
    total += delta < 0 ? -delta : delta;
  }
  return total;
}

function countsFor(picks: readonly string[], utilityAsMage: number): Counts {
  const counts = empty();
  let seen = 0;
  for (const id of picks) {
    const kind: Kind | undefined = CLASS[id as keyof typeof CLASS];
    if (!kind) throw new Error(`no class for ${id}`);
    if (kind === "utility") {
      if (seen < utilityAsMage) counts.mage += 1;
      else counts.support += 1;
      seen += 1;
    } else if (kind === "enchanter") counts.support += 1;
    else counts[kind] += 1;
  }
  return counts;
}

/** Nearest §6.5.1 composition tag. The fake generator calls this. There is no second copy. */
export function compArchetype(picks: readonly string[]): CompArchetype {
  const flex = picks.filter((id) => CLASS[id as keyof typeof CLASS] === "utility").length;
  let best: CompArchetype = "Balanced";
  let bestDistance = 99;
  for (let asMage = 0; asMage <= flex; asMage++) {
    const counts = countsFor(picks, asMage);
    for (const tag of TIE) {
      const next = distance(counts, TARGETS[tag]);
      const closer = next < bestDistance;
      const tie = next === bestDistance && TIE.indexOf(tag) < TIE.indexOf(best);
      if (closer || tie) {
        bestDistance = next;
        best = tag;
      }
    }
  }
  return best;
}
