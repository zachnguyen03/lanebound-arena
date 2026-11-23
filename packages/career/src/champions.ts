import type { Slot } from "@lanebound/match-contract";

/**
 * Slot table copied from the sandbox champion list so the stand-in can pick
 * a legal fearless pair per role. Not a design-authored roster. NON-SHIPPABLE.
 */
export const CHAMPION_SLOT: Record<string, Slot> = {
  brannoch: "top",
  rhedan: "top",
  sedge: "jungle",
  tolle: "jungle",
  torun: "jungle",
  calder: "mid",
  helvar: "mid",
  kerrig: "mid",
  mirren: "mid",
  huntress: "adc",
  isra: "adc",
  maelis: "adc",
  saelo: "support",
  ysol: "support",
};

export function championsForSlot(slot: Slot): string[] {
  return Object.keys(CHAMPION_SLOT)
    .filter((id) => CHAMPION_SLOT[id] === slot)
    .sort();
}

export function championSlot(champId: string): Slot | undefined {
  return CHAMPION_SLOT[champId];
}
