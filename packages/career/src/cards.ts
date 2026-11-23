import manifest from "../data/arena-manifest.json";

export interface ArenaCard {
  id: string;
  name: string;
  cost: number;
  rarity: string;
}

export const ARENA_CARDS: readonly ArenaCard[] = (manifest.cards as ArenaCard[]).map((card) => ({
  id: card.id,
  name: card.name,
  cost: card.cost,
  rarity: card.rarity,
}));

const BY_ID = new Map(ARENA_CARDS.map((card) => [card.id, card]));

export function arenaCard(id: string): ArenaCard | undefined {
  return BY_ID.get(id);
}

export interface LoadoutReport {
  cost: number;
  cards: number;
  signatures: number;
  ok: boolean;
}

/** 3 cards, 6 points, at most one Signature. */
export function loadoutReport(ids: readonly string[]): LoadoutReport {
  const cards = ids.map((id) => BY_ID.get(id));
  const known = cards.every((card) => card !== undefined);
  const cost = cards.reduce((sum, card) => sum + (card?.cost ?? 0), 0);
  const signatures = cards.filter((card) => card?.rarity === "Signature").length;
  const unique = new Set(ids).size === ids.length;
  return {
    cost,
    cards: ids.length,
    signatures,
    ok: known && unique && ids.length === 3 && cost <= 6 && signatures <= 1,
  };
}

export function assertLoadout(ids: readonly string[]): void {
  const report = loadoutReport(ids);
  if (!report.ok) throw new Error("career save rejected: card loadout");
}
