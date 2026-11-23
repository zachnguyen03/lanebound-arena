import type { MatchResult, SeriesFormat } from "@lanebound/match-contract";

export function winsTarget(format: SeriesFormat): number {
  if (format === "bo1") return 1;
  if (format === "bo3") return 2;
  return 3;
}

export function seriesGameScore(games: readonly MatchResult[]): [number, number] {
  let blue = 0;
  let red = 0;
  for (const game of games) {
    if (game.winner === "blue") blue += 1;
    else red += 1;
  }
  return [blue, red];
}

export function seriesDuration(games: readonly MatchResult[]): number {
  let total = 0;
  for (const game of games) total += game.duration_s;
  return total;
}

/** Mean of a per-map sum. Series MVP, Finals MVP, and the award sorts all call this. */
export function meanMapRating(total: number, maps: number): number {
  if (maps <= 0) throw new Error("meanMapRating requires at least one map");
  return total / maps;
}

/**
 * Highest mean map rating, then more maps, then higher mean z, then lower
 * player id. §14.4 names the mean; C-R-6 supplies the tie-break used for
 * Finals MVP, and every series MVP uses that same order so the final's
 * mvp_player_id is the Finals MVP.
 */
export function seriesMvp(games: readonly MatchResult[]): string {
  const acc = new Map<string, { maps: number; rating: number; z: number }>();
  for (const game of games) {
    for (const player of game.players) {
      const row = acc.get(player.player_id) ?? { maps: 0, rating: 0, z: 0 };
      row.maps += 1;
      row.rating += player.rating;
      row.z += player.z;
      acc.set(player.player_id, row);
    }
  }
  const ranked = [...acc.entries()].sort((a, b) => {
    const am = meanMapRating(a[1].rating, a[1].maps);
    const bm = meanMapRating(b[1].rating, b[1].maps);
    if (am !== bm) return bm - am;
    if (a[1].maps !== b[1].maps) return b[1].maps - a[1].maps;
    const az = meanMapRating(a[1].z, a[1].maps);
    const bz = meanMapRating(b[1].z, b[1].maps);
    if (az !== bz) return bz - az;
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return 1;
    return 0;
  });
  const top = ranked[0];
  if (!top) throw new Error("seriesMvp requires a played map");
  return top[0];
}
