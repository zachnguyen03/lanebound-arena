import type { SeriesResult, Stage } from "@lanebound/match-contract";
import { CLUB_SEEDS } from "./world.js";

export interface Fixture {
  id: string;
  competition_id: "bound_circuit";
  season_id: "s1";
  stage: Stage;
  format: "bo3" | "bo5";
  matchday: number;
  ordinal: number;
  team_ids: [string, string];
}

const TAGS = CLUB_SEEDS.map((club) => club.tag);
const IDS = CLUB_SEEDS.map((club) => club.id);

function blueRedRegular(i: number, j: number): [number, number] {
  const lower = Math.min(i, j);
  const higher = Math.max(i, j);
  if ((i + j) % 2 === 1) return [lower, higher];
  return [higher, lower];
}

/**
 * Circle method, team 0 fixed. Pair (teams[i], teams[7-i]), then
 * teams = [teams[0], teams[7], ...teams[1:7]]. Parity picks blue (C-R-2).
 */
export function regularSeasonFixtures(): Fixture[] {
  let teams = [0, 1, 2, 3, 4, 5, 6, 7];
  const fixtures: Fixture[] = [];
  let ordinal = 0;
  for (let day = 1; day <= 7; day++) {
    for (let i = 0; i < 4; i++) {
      const left = teams[i]!;
      const right = teams[7 - i]!;
      const [blue, red] = blueRedRegular(left, right);
      const blueTag = TAGS[blue]!;
      const redTag = TAGS[red]!;
      fixtures.push({
        id: `md${day}-${blueTag}-${redTag}`,
        competition_id: "bound_circuit",
        season_id: "s1",
        stage: "regular",
        format: "bo3",
        matchday: day,
        ordinal,
        team_ids: [IDS[blue]!, IDS[red]!],
      });
      ordinal += 1;
    }
    const fixed = teams[0]!;
    const last = teams[7]!;
    teams = [fixed, last, ...teams.slice(1, 7)];
  }
  return fixtures;
}

/** Player's series first. The other fixtures keep C-R-2 list order. */
export function matchdayPlayOrder<T extends { team_ids: readonly [string, string] }>(
  fixtures: readonly T[],
  playerClubId: string,
): T[] {
  const idx = fixtures.findIndex((fixture) => fixture.team_ids[0] === playerClubId || fixture.team_ids[1] === playerClubId);
  if (idx <= 0) return [...fixtures];
  const chosen = fixtures[idx]!;
  return [chosen, ...fixtures.slice(0, idx), ...fixtures.slice(idx + 1)];
}

export function semiFixtures(seeds: readonly [string, string, string, string]): [Fixture, Fixture] {
  const one: Fixture = {
    id: "md8-semi-1v4",
    competition_id: "bound_circuit",
    season_id: "s1",
    stage: "semi",
    format: "bo5",
    matchday: 8,
    ordinal: 28,
    team_ids: [seeds[0], seeds[3]],
  };
  const two: Fixture = {
    id: "md8-semi-2v3",
    competition_id: "bound_circuit",
    season_id: "s1",
    stage: "semi",
    format: "bo5",
    matchday: 8,
    ordinal: 29,
    team_ids: [seeds[1], seeds[2]],
  };
  return [one, two];
}

/** 1v4 winner vs 2v3 winner. Higher regular-season seed is blue. No reseed. */
export function finalFixture(
  semiOneWinner: string,
  semiTwoWinner: string,
  seedRank: ReadonlyMap<string, number>,
): Fixture {
  const rankA = seedRank.get(semiOneWinner);
  const rankB = seedRank.get(semiTwoWinner);
  if (rankA === undefined || rankB === undefined) throw new Error("finalist missing a regular-season seed");
  const team_ids: [string, string] = rankA < rankB ? [semiOneWinner, semiTwoWinner] : [semiTwoWinner, semiOneWinner];
  return {
    id: "md9-final",
    competition_id: "bound_circuit",
    season_id: "s1",
    stage: "final",
    format: "bo5",
    matchday: 9,
    ordinal: 30,
    team_ids,
  };
}

export function seedRankMap(seeds: readonly string[]): Map<string, number> {
  return new Map(seeds.map((id, index) => [id, index + 1]));
}

export function winnerOf(series: SeriesResult): string {
  return series.winner_team_id;
}
