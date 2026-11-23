import type { ContractPlayer, TacticPreset, Tactics } from "@lanebound/match-contract";
import { championSlot } from "./champions.js";
import type { CareerPlayer } from "./world.js";

export function toContractPlayer(player: CareerPlayer): ContractPlayer {
  return {
    id: player.id,
    name: player.name,
    club_id: player.club_id,
    primary_slot: player.primary_slot,
    attrs: player.attrs,
    ovr: player.ovr,
    mastery: player.mastery,
    signature_archive: [...player.signature_archive],
    last_stack_ovr: player.last_stack_ovr,
    age: player.age,
  };
}

/**
 * Highest mastery among remaining in-slot champions, then lower champ id.
 * Fixed draft, no bans (C-R2-5). Off-slot only when every in-slot champion is already used.
 * Fearless is the caller's used-picks list (games 1–2).
 */
export function selectPicks(starters: readonly CareerPlayer[], used: readonly string[]): string[] {
  const usedSet = new Set(used);
  return starters.map((player) => {
    const known = Object.keys(player.mastery).sort();
    const inSlot = known.filter((id) => !usedSet.has(id) && championSlot(id) === player.primary_slot);
    const pool = inSlot.length > 0 ? inSlot : known.filter((id) => !usedSet.has(id));
    const choice = [...pool].sort((a, b) => {
      const ma = player.mastery[a] ?? 0;
      const mb = player.mastery[b] ?? 0;
      if (ma !== mb) return mb - ma;
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    })[0];
    if (!choice) throw new Error(`no champion left for ${player.id}`);
    return choice;
  });
}

/**
 * AI season identity from opening index (C-R2-5). i % 3: Hold, Hunt, Starve.
 * The new-career seed does not reroll this.
 */
export const AI_PRESETS = ["hold", "hunt", "starve", "hold", "hunt", "starve", "hold", "hunt"] as const satisfies readonly TacticPreset[];

export function aiPreset(openingIndex: number): TacticPreset {
  const preset = AI_PRESETS[openingIndex];
  if (!preset) throw new Error(`no AI tactic for opening index ${openingIndex}`);
  return preset;
}

/** Human club uses the chosen preset, default Hold. AI clubs use AI_PRESETS. */
export function tacticsFor(club: { id: string; opening_index: number }, humanClubId: string, humanPreset: TacticPreset = "hold"): Tactics {
  const primary = club.id === humanClubId ? humanPreset : aiPreset(club.opening_index);
  return { primary, aggression: 0, combo_style: "auto" };
}

/** Placeholder loadout. No card catalog was in the binding sources, so points are not priced. */
export function standinLoadout(starters: readonly CareerPlayer[]): { id: string; holder_id: string }[] {
  return [0, 1, 2].map((i) => ({
    id: `NONSHIPPABLE-card-${i + 1}`,
    holder_id: starters[i]!.id,
  }));
}
