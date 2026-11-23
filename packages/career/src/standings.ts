import type { Stage } from "@lanebound/match-contract";

export interface StandingSeries {
  stage: Stage;
  team_ids: readonly [string, string];
  series_score: readonly [number, number];
  winner_team_id: string;
}

export interface StandingRow {
  club_id: string;
  opening_index: number;
  series_wins: number;
  series_losses: number;
  maps_won: number;
  maps_lost: number;
  map_diff: number;
}

export interface ClubIndex {
  club_id: string;
  opening_index: number;
}

export function mapDifferential(mapsWon: number, mapsLost: number): number {
  return mapsWon - mapsLost;
}

export function computeStandings(clubs: readonly ClubIndex[], series: readonly StandingSeries[]): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const club of clubs) {
    rows.set(club.club_id, {
      club_id: club.club_id,
      opening_index: club.opening_index,
      series_wins: 0,
      series_losses: 0,
      maps_won: 0,
      maps_lost: 0,
      map_diff: 0,
    });
  }
  for (const item of series) {
    if (item.stage !== "regular") continue;
    const blue = rows.get(item.team_ids[0]);
    const red = rows.get(item.team_ids[1]);
    if (!blue || !red) throw new Error("series club is not in the table");
    blue.maps_won += item.series_score[0];
    blue.maps_lost += item.series_score[1];
    red.maps_won += item.series_score[1];
    red.maps_lost += item.series_score[0];
    if (item.winner_team_id === blue.club_id) {
      blue.series_wins += 1;
      red.series_losses += 1;
    } else if (item.winner_team_id === red.club_id) {
      red.series_wins += 1;
      blue.series_losses += 1;
    } else {
      throw new Error("winner is not one of the two clubs");
    }
  }
  for (const row of rows.values()) {
    row.map_diff = mapDifferential(row.maps_won, row.maps_lost);
  }
  return [...rows.values()].sort((a, b) => a.opening_index - b.opening_index);
}

interface H2H {
  wins: number;
  diff: number;
  mapsWon: number;
}

function h2h(clubId: string, group: ReadonlySet<string>, series: readonly StandingSeries[]): H2H {
  let wins = 0;
  let mapsWon = 0;
  let mapsLost = 0;
  for (const item of series) {
    if (item.stage !== "regular") continue;
    const [blue, red] = item.team_ids;
    if (!group.has(blue) || !group.has(red)) continue;
    if (blue !== clubId && red !== clubId) continue;
    const mine = blue === clubId;
    const myMaps = mine ? item.series_score[0] : item.series_score[1];
    const oppMaps = mine ? item.series_score[1] : item.series_score[0];
    mapsWon += myMaps;
    mapsLost += oppMaps;
    if (item.winner_team_id === clubId) wins += 1;
  }
  return { wins, diff: mapDifferential(mapsWon, mapsLost), mapsWon };
}

function resolveTie(group: StandingRow[], series: readonly StandingSeries[]): StandingRow[] {
  if (group.length <= 1) return group;
  const ids = new Set(group.map((row) => row.club_id));
  const keyed = group.map((row) => ({ row, h: h2h(row.club_id, ids, series) }));
  const decorated = [...keyed].sort((a, b) => {
    if (a.h.wins !== b.h.wins) return b.h.wins - a.h.wins;
    if (a.h.diff !== b.h.diff) return b.h.diff - a.h.diff;
    if (a.h.mapsWon !== b.h.mapsWon) return b.h.mapsWon - a.h.mapsWon;
    return a.row.opening_index - b.row.opening_index;
  });
  const buckets = new Map<string, StandingRow[]>();
  const bucketOrder: string[] = [];
  for (const item of decorated) {
    const key = `${item.h.wins}|${item.h.diff}|${item.h.mapsWon}`;
    const list = buckets.get(key);
    if (!list) {
      buckets.set(key, [item.row]);
      bucketOrder.push(key);
    } else {
      list.push(item.row);
    }
  }
  if (buckets.size === 1) {
    return [...group].sort((a, b) => a.opening_index - b.opening_index);
  }
  const out: StandingRow[] = [];
  for (const key of bucketOrder) {
    const sub = buckets.get(key)!;
    if (sub.length > 1) out.push(...resolveTie(sub, series));
    else out.push(sub[0]!);
  }
  return out;
}

/** C-R-1 order. OVR is not an input. */
export function rankClubs(rows: readonly StandingRow[], series: readonly StandingSeries[]): string[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.series_wins !== b.series_wins) return b.series_wins - a.series_wins;
    if (a.map_diff !== b.map_diff) return b.map_diff - a.map_diff;
    if (a.maps_won !== b.maps_won) return b.maps_won - a.maps_won;
    return a.opening_index - b.opening_index;
  });
  const groups = new Map<string, StandingRow[]>();
  const order: string[] = [];
  for (const row of sorted) {
    const key = `${row.series_wins}|${row.map_diff}|${row.maps_won}`;
    const list = groups.get(key);
    if (!list) {
      groups.set(key, [row]);
      order.push(key);
    } else {
      list.push(row);
    }
  }
  const ranked: string[] = [];
  for (const key of order) {
    const group = groups.get(key)!;
    for (const row of resolveTie(group, series)) ranked.push(row.club_id);
  }
  return ranked;
}

export function assignFinish(rows: readonly StandingRow[], order: readonly string[]): Array<StandingRow & { finish: number }> {
  const rank = new Map(order.map((id, index) => [id, index + 1]));
  return rows.map((row) => {
    const finish = rank.get(row.club_id);
    if (finish === undefined) throw new Error(`no finish for ${row.club_id}`);
    return { ...row, finish };
  });
}
