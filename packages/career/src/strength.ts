import type { ContractPlayer, TacticPreset } from "@lanebound/match-contract";
import { championSlot } from "./champions.js";

/** Logistic k from §14.5. There is no human-coach +1.2 term (C-R-3). */
export const STRENGTH_K = 0.1;

const BEATS: Record<TacticPreset, TacticPreset> = {
  hold: "hunt",
  hunt: "starve",
  starve: "hold",
};

/**
 * Tactic edge added to strength_blue once. Same preset is 0.
 * Hold > Hunt > Starve > Hold, ±2.0 (C-R-3).
 */
export function tacticEdge(blue: TacticPreset, red: TacticPreset): number {
  if (blue === red) return 0;
  if (BEATS[blue] === red) return 2;
  if (BEATS[red] === blue) return -2;
  return 0;
}

/**
 * Missing mastery: 70 in-slot, 40 off-slot (C-R-3 / build-spec baseline).
 * Unknown champion ids count as off-slot.
 */
export function pickedMastery(player: ContractPlayer, champId: string): number {
  const listed = player.mastery[champId];
  if (listed !== undefined) return listed;
  const slot = championSlot(champId);
  if (slot !== undefined && slot === player.primary_slot) return 70;
  return 40;
}

/** mean starter OVR + 0.015 * (mean picked mastery - 75). */
export function sideBase(players: readonly ContractPlayer[], picks: readonly string[]): number {
  if (players.length !== 5 || picks.length !== 5) {
    throw new Error("sideBase requires five players and five picks");
  }
  let ovr = 0;
  let mastery = 0;
  for (let i = 0; i < 5; i++) {
    ovr += players[i]!.ovr;
    mastery += pickedMastery(players[i]!, picks[i]!);
  }
  return ovr / 5 + 0.015 * (mastery / 5 - 75);
}

export function teamStrength(args: {
  players: readonly ContractPlayer[];
  picks: readonly string[];
  preset: TacticPreset;
  opponentPreset: TacticPreset;
  side: "blue" | "red";
}): number {
  const base = sideBase(args.players, args.picks);
  if (args.side === "red") return base;
  return base + tacticEdge(args.preset, args.opponentPreset);
}

export function winProbabilityBlue(strengthBlue: number, strengthRed: number): number {
  return 1 / (1 + Math.exp(-STRENGTH_K * (strengthBlue - strengthRed)));
}
