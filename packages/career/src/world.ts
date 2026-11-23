import type { PlayerAttrs, Slot } from "@lanebound/match-contract";
import { SLOTS } from "@lanebound/match-contract";
import { championsForSlot } from "./champions.js";
import dump from "../data/opening-world-20261123.json";

/** Fixed seed from C-R-4 / C-R2-3. The new-career seed does not reroll this world. */
export const STANDIN_SEED = 20261123;

export const STANDIN_LABEL = "NON-SHIPPABLE PAPER opening_world seed 20261123";

/**
 * SHA-256 of the frozen dump: compact JSON array, 80 players, pid order,
 * ruling key order, separators (',', ':'), no trailing newline (C-R2-3).
 */
export const OPENING_WORLD_SHA256 = "19b3fbe89aa605b8d131d8112e2790b82d5faae3e4fb395be22fcdffae7b0088";

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
  /** Authored rosters will be shippable. This paper-model dump is not. */
  shippable: false;
  potential: number;
  attr_pot: PlayerAttrs;
  focus: string;
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
  /** Authored GD-15 target. The paper dump's starters are jittered around this. */
  starter_ovr_target: number;
  /** Paper following (Iron Lotus 72 … Kestrel Row 32). Not a result input. */
  following: number;
  following_floor: number;
  cash: number;
  facility: number;
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

/** Paper-model club row. Following is the paper scale, not the old 100s ladder. */
export const CLUB_SEEDS: readonly ClubSeed[] = [
  { id: "iron-lotus", name: "Iron Lotus", tag: "ILO", opening_index: 0, difficulty: "favourite", starter_ovr_target: 76, following: 72, recommended_first_save: false },
  { id: "hanok-wolves", name: "Hanok Wolves", tag: "HKW", opening_index: 1, difficulty: "favourite", starter_ovr_target: 72, following: 64, recommended_first_save: false },
  { id: "neon-tide", name: "Neon Tide", tag: "NTD", opening_index: 2, difficulty: "favourite", starter_ovr_target: 70, following: 60, recommended_first_save: false },
  { id: "vanta-owls", name: "Vanta Owls", tag: "VNO", opening_index: 3, difficulty: "mid", starter_ovr_target: 68, following: 52, recommended_first_save: false },
  { id: "juniper-rush", name: "Juniper Rush", tag: "JNR", opening_index: 4, difficulty: "mid", starter_ovr_target: 66, following: 48, recommended_first_save: true },
  { id: "sable-comets", name: "Sable Comets", tag: "SBC", opening_index: 5, difficulty: "mid", starter_ovr_target: 64, following: 44, recommended_first_save: false },
  { id: "glasswing", name: "Glasswing", tag: "GLW", opening_index: 6, difficulty: "underdog", starter_ovr_target: 62, following: 40, recommended_first_save: false },
  { id: "kestrel-row", name: "Kestrel Row", tag: "KST", opening_index: 7, difficulty: "underdog", starter_ovr_target: 58, following: 32, recommended_first_save: false },
];

/** Paper STARTING_CASH + CASH_BY_TIER_BONUS. Not drawn. */
const OPENING_CASH = [1000, 900, 850, 800, 760, 720, 680, 640] as const;

const ATTRS = ["aim", "reflexes", "execution", "decision", "positioning", "teamwork"] as const;

interface DumpPlayer {
  pid: number;
  name: string;
  role: Slot;
  age: number;
  attrs: number[];
  ovr: number;
  potential: number;
  attr_pot: number[];
  mastery_main: number;
  contract_years: number;
  wage: number;
  club: number;
  focus: string;
}

function attrsFrom(values: readonly number[]): PlayerAttrs {
  if (values.length !== ATTRS.length) throw new Error("expected six attributes");
  return {
    aim: values[0]!,
    reflexes: values[1]!,
    execution: values[2]!,
    decision: values[3]!,
    positioning: values[4]!,
    teamwork: values[5]!,
  };
}

/**
 * C-R2-3 mastery projection. Lowest in-slot champion id gets round(mastery_main).
 * Every other in-slot champion gets 60. No off-slot entries.
 */
export function projectMastery(slot: Slot, masteryMain: number): Record<string, number> {
  const champs = championsForSlot(slot);
  if (champs.length === 0) throw new Error(`no stand-in champions for ${slot}`);
  const mastery: Record<string, number> = {};
  const main = Math.round(masteryMain);
  for (let i = 0; i < champs.length; i++) {
    mastery[champs[i]!] = i === 0 ? main : 60;
  }
  return mastery;
}

/**
 * Frozen paper-model opening_world at seed 20261123 (C-R2-3).
 * Ids are standin-{pid} and names are the model's P#### placeholders.
 * shippable is false until the authored GD-15 roster replaces this dump.
 * Wages are the model's Marks scale and stay in the data; there is no roster UI.
 */
export function openingWorld(): OpeningWorld {
  const rows = dump as DumpPlayer[];
  if (rows.length !== 80) throw new Error("opening world dump must contain 80 players");
  const clubs: Club[] = CLUB_SEEDS.map((seed) => ({
    ...seed,
    following_floor: 0.55 * seed.following,
    cash: OPENING_CASH[seed.opening_index]!,
    facility: seed.opening_index <= 1 ? 1 : 0,
    roster_ids: [] as string[],
  }));
  const players: CareerPlayer[] = [];
  const contracts: CareerContract[] = [];
  for (const row of rows) {
    const club = clubs[row.club];
    if (!club) throw new Error(`bad club index ${row.club}`);
    if (!SLOTS.includes(row.role)) throw new Error(`bad role ${row.role}`);
    const id = `standin-${row.pid}`;
    club.roster_ids.push(id);
    players.push({
      id,
      name: row.name,
      club_id: club.id,
      primary_slot: row.role,
      attrs: attrsFrom(row.attrs),
      ovr: row.ovr,
      mastery: projectMastery(row.role, row.mastery_main),
      signature_archive: [],
      last_stack_ovr: row.ovr,
      age: row.age,
      shippable: false,
      potential: row.potential,
      attr_pot: attrsFrom(row.attr_pot),
      focus: row.focus,
    });
    contracts.push({
      player_id: id,
      opening_years: row.contract_years,
      years_left: row.contract_years,
      wage: row.wage,
      auto_renewed: false,
    });
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
