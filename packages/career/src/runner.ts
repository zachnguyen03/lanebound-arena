import {
  validateSeriesResult,
  type MatchConfig,
  type MatchResult,
  type SeriesContext,
  type SeriesResult,
} from "@lanebound/match-contract";
import { finalFixture, matchdayPlayOrder, regularSeasonFixtures, seedRankMap, semiFixtures, type Fixture } from "./calendar.js";
import { generateFakeMatch } from "./fake.js";
import { aiTactics, selectPicks, standinLoadout, toContractPlayer } from "./lineup.js";
import { gameSeed, seriesSeed } from "./rng.js";
import { seriesDuration, seriesGameScore, seriesMvp, winsTarget } from "./series.js";
import { assignFinish, computeStandings, rankClubs, type StandingRow } from "./standings.js";
import { openingWorld, selectStarters, type CareerPlayer, type OpeningWorld } from "./world.js";

export interface CircuitResult {
  world: OpeningWorld;
  career_seed: number;
  player_club_id: string;
  regular_fixtures: Fixture[];
  playoff_fixtures: Fixture[];
  series: SeriesResult[];
  standings: Array<StandingRow & { finish: number }>;
  frozen_seeds: [string, string, string, string, string, string, string, string];
}

function startersOf(world: OpeningWorld): Map<string, CareerPlayer[]> {
  const map = new Map<string, CareerPlayer[]>();
  for (const club of world.clubs) map.set(club.id, selectStarters(world.players, club.id));
  return map;
}

export function playSeries(args: {
  careerSeed: number;
  fixture: Fixture;
  world: OpeningWorld;
  starters: Map<string, CareerPlayer[]>;
}): SeriesResult {
  const { fixture, world } = args;
  const blue = args.starters.get(fixture.team_ids[0]);
  const red = args.starters.get(fixture.team_ids[1]);
  if (!blue || !red) throw new Error(`missing starters for ${fixture.id}`);
  const tactics = aiTactics();
  const blueCards = standinLoadout(blue);
  const redCards = standinLoadout(red);
  const seed = seriesSeed(args.careerSeed, fixture.ordinal);
  const target = winsTarget(fixture.format);
  const games: MatchResult[] = [];
  let score: [number, number] = [0, 0];
  const used: [string[], string[]] = [[], []];
  let gameIndex = 1;
  while (score[0] < target && score[1] < target) {
    const fearless = fixture.format !== "bo1" && gameIndex <= 2;
    const usedNow: [string[], string[]] = fearless ? [[...used[0]], [...used[1]]] : [[], []];
    const bluePicks = selectPicks(blue, usedNow[0]);
    const redPicks = selectPicks(red, usedNow[1]);
    const context: SeriesContext = {
      contract_version: "career-match/1",
      competition_id: world.competition_id,
      season_id: world.season_id,
      series_id: `series-${fixture.id}`,
      fixture_id: fixture.id,
      stage: fixture.stage,
      format: fixture.format,
      game_index: gameIndex,
      series_score: score,
      team_ids: fixture.team_ids,
      used_picks: usedNow,
      source: "fake",
    };
    const config: MatchConfig = {
      seed: gameSeed(seed, gameIndex),
      constants: {},
      draft_mode: "fixed",
      notes: "NON-SHIPPABLE STAND-IN",
      blue: {
        players: blue.map(toContractPlayer),
        picks: bluePicks,
        tactics,
        card_loadout: blueCards,
        club_id: fixture.team_ids[0],
      },
      red: {
        players: red.map(toContractPlayer),
        picks: redPicks,
        tactics,
        card_loadout: redCards,
        club_id: fixture.team_ids[1],
      },
    };
    games.push(generateFakeMatch(context, config));
    if (fearless) {
      used[0].push(...bluePicks);
      used[1].push(...redPicks);
    }
    score = seriesGameScore(games);
    gameIndex += 1;
    if (gameIndex > 9) throw new Error(`series ${fixture.id} did not end`);
  }
  const result: SeriesResult = {
    contract_version: "career-match/1",
    competition_id: world.competition_id,
    season_id: world.season_id,
    series_id: `series-${fixture.id}`,
    fixture_id: fixture.id,
    stage: fixture.stage,
    format: fixture.format,
    team_ids: fixture.team_ids,
    winner_team_id: score[0] > score[1] ? fixture.team_ids[0] : fixture.team_ids[1],
    series_score: score,
    games,
    mvp_player_id: seriesMvp(games),
    duration_s: seriesDuration(games),
    source: "fake",
  };
  return validateSeriesResult(result);
}

export function simulateCircuit(opts: { careerSeed: number; playerClubId: string; world?: OpeningWorld }): CircuitResult {
  const world = opts.world ?? openingWorld();
  if (!world.clubs.some((club) => club.id === opts.playerClubId)) {
    throw new Error(`unknown club ${opts.playerClubId}`);
  }
  const starters = startersOf(world);
  const regular = regularSeasonFixtures();
  const series: SeriesResult[] = [];
  for (let day = 1; day <= 7; day++) {
    const dayFixtures = regular.filter((fixture) => fixture.matchday === day);
    for (const fixture of matchdayPlayOrder(dayFixtures, opts.playerClubId)) {
      series.push(playSeries({ careerSeed: opts.careerSeed, fixture, world, starters }));
    }
  }
  const clubs = world.clubs.map((club) => ({ club_id: club.id, opening_index: club.opening_index }));
  const regularRows = computeStandings(clubs, series);
  const order = rankClubs(regularRows, series);
  if (order.length !== 8) throw new Error("expected 8 seeds");
  const frozen = order as [string, string, string, string, string, string, string, string];
  const seeds = frozen.slice(0, 4) as [string, string, string, string];
  const semis = semiFixtures(seeds);
  const semiOrder = matchdayPlayOrder(semis, opts.playerClubId);
  const semiResults: SeriesResult[] = [];
  for (const fixture of semiOrder) {
    const played = playSeries({ careerSeed: opts.careerSeed, fixture, world, starters });
    semiResults.push(played);
    series.push(played);
  }
  const byId = new Map(semiResults.map((item) => [item.fixture_id, item]));
  const semiOne = byId.get("md8-semi-1v4");
  const semiTwo = byId.get("md8-semi-2v3");
  if (!semiOne || !semiTwo) throw new Error("missing semi");
  const finalFx = finalFixture(semiOne.winner_team_id, semiTwo.winner_team_id, seedRankMap(frozen));
  series.push(playSeries({ careerSeed: opts.careerSeed, fixture: finalFx, world, starters }));
  return {
    world,
    career_seed: opts.careerSeed,
    player_club_id: opts.playerClubId,
    regular_fixtures: regular,
    playoff_fixtures: [semis[0], semis[1], finalFx],
    series,
    standings: assignFinish(regularRows, frozen),
    frozen_seeds: frozen,
  };
}
