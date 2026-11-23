import type { SeriesResult } from "@lanebound/match-contract";
import { meanMapRating, seriesMvp } from "./series.js";

export type AwardKind = "split_mvp" | "deadeye" | "shepherd" | "zonekeeper" | "finals_mvp";

export interface Award {
  kind: AwardKind;
  season_id: string;
  player_id: string;
  statistic: number;
  signature: string | null;
}

export interface SignatureGrant {
  player_id: string;
  signature: "pillar-of-the-split" | "finals-poise" | "convergence-crown";
  reason: string;
}

interface Totals {
  player_id: string;
  maps: number;
  series: number;
  rating: number;
  z: number;
  dmg: number;
  peels: number;
  zone_seconds: number;
  claim_denies: number;
}

/** Zonekeeper score. One deny is worth 20 seconds (C-R-5). */
export function zonekeeperScore(zoneSeconds: number, claimDenies: number): number {
  return zoneSeconds + 20 * claimDenies;
}

function regularTotals(series: readonly SeriesResult[]): Totals[] {
  const map = new Map<string, Totals>();
  for (const item of series) {
    if (item.stage !== "regular") continue;
    const seen = new Set<string>();
    for (const game of item.games) {
      for (const player of game.players) {
        const row = map.get(player.player_id) ?? {
          player_id: player.player_id,
          maps: 0,
          series: 0,
          rating: 0,
          z: 0,
          dmg: 0,
          peels: 0,
          zone_seconds: 0,
          claim_denies: 0,
        };
        row.maps += 1;
        row.rating += player.rating;
        row.z += player.z;
        row.dmg += player.dmg;
        row.peels += player.peels;
        row.zone_seconds += player.zone_seconds;
        row.claim_denies += player.claim_denies ?? 0;
        map.set(player.player_id, row);
        seen.add(player.player_id);
      }
    }
    for (const id of seen) {
      const row = map.get(id);
      if (row) row.series += 1;
    }
  }
  return [...map.values()];
}

function eligible(rows: readonly Totals[]): Totals[] {
  return rows.filter((row) => row.series >= 4 && row.maps >= 1);
}

function idCmp(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}


export function splitMvpWinner(series: readonly SeriesResult[]): Totals | null {
  const rows = eligible(regularTotals(series));
  rows.sort((a, b) => {
    const ar = meanMapRating(a.rating, a.maps);
    const br = meanMapRating(b.rating, b.maps);
    if (ar !== br) return br - ar;
    if (a.maps !== b.maps) return b.maps - a.maps;
    const az = meanMapRating(a.z, a.maps);
    const bz = meanMapRating(b.z, b.maps);
    if (az !== bz) return bz - az;
    return idCmp(a.player_id, b.player_id);
  });
  return rows[0] ?? null;
}

export function deadeyeWinner(series: readonly SeriesResult[]): Totals | null {
  const rows = eligible(regularTotals(series));
  rows.sort((a, b) => {
    if (a.dmg !== b.dmg) return b.dmg - a.dmg;
    const ar = meanMapRating(a.rating, a.maps);
    const br = meanMapRating(b.rating, b.maps);
    if (ar !== br) return br - ar;
    if (a.maps !== b.maps) return b.maps - a.maps;
    return idCmp(a.player_id, b.player_id);
  });
  return rows[0] ?? null;
}

export function shepherdWinner(series: readonly SeriesResult[]): Totals | null {
  const rows = eligible(regularTotals(series));
  rows.sort((a, b) => {
    if (a.peels !== b.peels) return b.peels - a.peels;
    const ar = meanMapRating(a.rating, a.maps);
    const br = meanMapRating(b.rating, b.maps);
    if (ar !== br) return br - ar;
    if (a.maps !== b.maps) return b.maps - a.maps;
    return idCmp(a.player_id, b.player_id);
  });
  return rows[0] ?? null;
}

export function zonekeeperWinner(series: readonly SeriesResult[]): Totals | null {
  const rows = eligible(regularTotals(series));
  rows.sort((a, b) => {
    const as = zonekeeperScore(a.zone_seconds, a.claim_denies);
    const bs = zonekeeperScore(b.zone_seconds, b.claim_denies);
    if (as !== bs) return bs - as;
    if (a.claim_denies !== b.claim_denies) return b.claim_denies - a.claim_denies;
    const ar = meanMapRating(a.rating, a.maps);
    const br = meanMapRating(b.rating, b.maps);
    if (ar !== br) return br - ar;
    return idCmp(a.player_id, b.player_id);
  });
  return rows[0] ?? null;
}

/** Starters of game 1 on the winning side of the championship series. */
export function championshipStarters(finalSeries: SeriesResult): string[] {
  const game = finalSeries.games[0];
  if (!game) throw new Error("championship series has no maps");
  const side = finalSeries.winner_team_id === finalSeries.team_ids[0] ? "blue" : "red";
  return game.players.filter((player) => player.side === side).map((player) => player.player_id);
}

/** 1-Signature cap. Headless default keeps the new signature (C-R-6). */
export function keepSignature(archive: readonly string[], incoming: string): string[] {
  if (archive.includes(incoming)) return [...archive];
  if (archive.length === 0) return [incoming];
  return [incoming];
}

export function seasonAwards(series: readonly SeriesResult[], seasonId: string): { awards: Award[]; grants: SignatureGrant[] } {
  const finalSeries = series.find((item) => item.stage === "final");
  if (!finalSeries) throw new Error("no championship series");
  const split = splitMvpWinner(series);
  const deadeye = deadeyeWinner(series);
  const shepherd = shepherdWinner(series);
  const zone = zonekeeperWinner(series);
  if (!split || !deadeye || !shepherd || !zone) throw new Error("regular-season award pool was empty");
  const finalsId = seriesMvp(finalSeries.games);
  if (finalsId !== finalSeries.mvp_player_id) {
    throw new Error("Finals MVP must be SeriesResult.mvp_player_id");
  }
  const awards: Award[] = [
    {
      kind: "split_mvp",
      season_id: seasonId,
      player_id: split.player_id,
      statistic: meanMapRating(split.rating, split.maps),
      signature: "pillar-of-the-split",
    },
    {
      kind: "deadeye",
      season_id: seasonId,
      player_id: deadeye.player_id,
      statistic: deadeye.dmg,
      signature: null,
    },
    {
      kind: "shepherd",
      season_id: seasonId,
      player_id: shepherd.player_id,
      statistic: shepherd.peels,
      signature: null,
    },
    {
      kind: "zonekeeper",
      season_id: seasonId,
      player_id: zone.player_id,
      statistic: zonekeeperScore(zone.zone_seconds, zone.claim_denies),
      signature: null,
    },
    {
      kind: "finals_mvp",
      season_id: seasonId,
      player_id: finalsId,
      statistic: (() => {
        const lines = finalSeries.games.flatMap((game) => game.players).filter((player) => player.player_id === finalsId);
        return meanMapRating(
          lines.reduce((sum, player) => sum + player.rating, 0),
          lines.length,
        );
      })(),
      signature: "finals-poise",
    },
  ];
  const grants: SignatureGrant[] = [
    { player_id: split.player_id, signature: "pillar-of-the-split", reason: "split_mvp" },
  ];
  for (const playerId of championshipStarters(finalSeries)) {
    grants.push({ player_id: playerId, signature: "convergence-crown", reason: "championship_starter" });
  }
  grants.push({ player_id: finalsId, signature: "finals-poise", reason: "finals_mvp" });
  return { awards, grants };
}
