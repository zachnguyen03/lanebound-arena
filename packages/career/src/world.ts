import type { PlayerAttrs, Slot } from "@lanebound/match-contract";
import { SLOTS } from "@lanebound/match-contract";
import { championsForSlot } from "./champions.js";
import { SplitMix32 } from "./rng.js";

/** Fixed seed from C-R-4. The new-career seed does not reroll this world. */
export const STANDIN_SEED = 20261123;

export const STANDIN_LABEL = "NON-SHIPPABLE STAND-IN seed 20261123";

export type Difficulty = "favourite" | "mid" | "underdog";

export interface CareerPlayer {
  id: string;
  name: string;
  club_id: string;
  primary_slot: Slot;
  attrs: PlayerAttrs;
  ovr: number;
  mastery: Record<string, number>;
  signature_archive: string[];
  last_stack_ovr: number;
  age: number;
  /** Authored rosters will be shippable. This stand-in is not. */
  shippable: false;
  potential: number;
}

export interface CareerContract {
  player_id: string;
  opening_years: number;
  years_left: number;
  wage: number;
  auto_renewed: boolean;
}

export interface Club {
  id: string;
  name: string;
  tag: string;
  opening_index: number;
  difficulty: Difficulty;
  /** Paper-model starter OVR target. The stand-in hits this exactly. */
  starter_ovr_target: number;
  /** Display-only stand-in. Not a trust-bearing number. */
  following: number;
  recommended_first_save: boolean;
  roster_ids: string[];
}

export interface OpeningWorld {
  label: typeof STANDIN_LABEL;
  non_shippable_standin: true;
  standin_seed: typeof STANDIN_SEED;
  competition_id: "bound_circuit";
  season_id: "s1";
  clubs: Club[];
  players: CareerPlayer[];
  contracts: CareerContract[];
}

interface ClubSeed {
  id: string;
  name: string;
  tag: string;
  opening_index: number;
  difficulty: Difficulty;
  starter_ovr_target: number;
  following: number;
  recommended_first_save: boolean;
}

export const CLUB_SEEDS: readonly ClubSeed[] = [
  { id: "iron-lotus", name: "Iron Lotus", tag: "ILO", opening_index: 0, difficulty: "favourite", starter_ovr_target: 76, following: 800, recommended_first_save: false },
  { id: "hanok-wolves", name: "Hanok Wolves", tag: "HKW", opening_index: 1, difficulty: "favourite", starter_ovr_target: 72, following: 700, recommended_first_save: false },
  { id: "neon-tide", name: "Neon Tide", tag: "NTD", opening_index: 2, difficulty: "favourite", starter_ovr_target: 70, following: 640, recommended_first_save: false },
  { id: "vanta-owls", name: "Vanta Owls", tag: "VNO", opening_index: 3, difficulty: "mid", starter_ovr_target: 68, following: 560, recommended_first_save: false },
  { id: "juniper-rush", name: "Juniper Rush", tag: "JNR", opening_index: 4, difficulty: "mid", starter_ovr_target: 66, following: 520, recommended_first_save: true },
  { id: "sable-comets", name: "Sable Comets", tag: "SBC", opening_index: 5, difficulty: "mid", starter_ovr_target: 64, following: 480, recommended_first_save: false },
  { id: "glasswing", name: "Glasswing", tag: "GLW", opening_index: 6, difficulty: "underdog", starter_ovr_target: 62, following: 400, recommended_first_save: false },
  { id: "kestrel-row", name: "Kestrel Row", tag: "KST", opening_index: 7, difficulty: "underdog", starter_ovr_target: 58, following: 320, recommended_first_save: false },
];

function attrsFor(ovr: number): PlayerAttrs {
  return {
    aim: ovr,
    reflexes: ovr,
    execution: ovr,
    decision: ovr,
    positioning: ovr,
    teamwork: ovr,
  };
}

function masteryFor(slot: Slot): Record<string, number> {
  const champs = championsForSlot(slot);
  const mastery: Record<string, number> = {};
  for (let i = 0; i < champs.length; i++) {
    mastery[champs[i]!] = i === 0 ? 80 : 60;
  }
  return mastery;
}

/**
 * Temporary opening world. C-R-4 asks for the paper model's opening_world at
 * seed 20261123. That Python source is not in the binding inputs, so this is
 * a labelled stand-in: OVR targets are exact, names are P####, and the seed
 * only draws contract length and wage. Not shippable.
 */
export function openingWorld(): OpeningWorld {
  const rng = new SplitMix32(STANDIN_SEED);
  const clubs: Club[] = [];
  const players: CareerPlayer[] = [];
  const contracts: CareerContract[] = [];
  let nameN = 1;
  for (const seed of CLUB_SEEDS) {
    const roster: string[] = [];
    for (const slot of SLOTS) {
      for (let depth = 0; depth < 2; depth++) {
        const id = `standin-${seed.tag.toLowerCase()}-${slot}-${depth}`;
        const name = `P${String(nameN).padStart(4, "0")}`;
        nameN += 1;
        const ovr = seed.starter_ovr_target - depth * 3;
        const length = 1 + (rng.nextU32() % 4);
        const wage = 40000 + (rng.nextU32() % 20001);
        const age = 18 + (rng.nextU32() % 10);
        roster.push(id);
        players.push({
          id,
          name,
          club_id: seed.id,
          primary_slot: slot,
          attrs: attrsFor(ovr),
          ovr,
          mastery: masteryFor(slot),
          signature_archive: [],
          last_stack_ovr: ovr,
          age,
          shippable: false,
          potential: ovr + 5,
        });
        contracts.push({
          player_id: id,
          opening_years: length,
          years_left: length,
          wage,
          auto_renewed: false,
        });
      }
    }
    clubs.push({ ...seed, roster_ids: roster });
  }
  return {
    label: STANDIN_LABEL,
    non_shippable_standin: true,
    standin_seed: STANDIN_SEED,
    competition_id: "bound_circuit",
    season_id: "s1",
    clubs,
    players,
    contracts,
  };
}

/** Highest OVR in the primary slot, else highest OVR still available. Ties: lower player id. */
export function selectStarters(players: readonly CareerPlayer[], clubId: string): CareerPlayer[] {
  const roster = players.filter((player) => player.club_id === clubId);
  const picked = new Set<string>();
  const starters: CareerPlayer[] = [];
  const byBest = (list: CareerPlayer[]): CareerPlayer | undefined => {
    const sorted = [...list].sort((a, b) => b.ovr - a.ovr || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return sorted[0];
  };
  for (const slot of SLOTS) {
    const inSlot = roster.filter((player) => player.primary_slot === slot && !picked.has(player.id));
    let choice = byBest(inSlot);
    if (!choice) {
      choice = byBest(roster.filter((player) => !picked.has(player.id)));
    }
    if (!choice) throw new Error(`no starter for ${clubId} ${slot}`);
    picked.add(choice.id);
    starters.push(choice);
  }
  return starters;
}
