import { canonicalString, validateSeriesResult, type SeriesResult } from "@lanebound/match-contract";
import { seasonAwards, keepSignature, type Award, type SignatureGrant } from "./awards.js";
import { finalFixture, regularSeasonFixtures, seedRankMap, semiFixtures } from "./calendar.js";
import { tickContracts } from "./contracts.js";
import { glickoDisplay, glickoSeries, initialGlicko, type GlickoState } from "./glicko.js";
import { PLAYOFF_BONUS, placementPoints } from "./points.js";
import { simulateCircuit, type CircuitResult } from "./runner.js";
import { assignFinish, computeStandings, rankClubs } from "./standings.js";
import { openingWorld, type CareerContract, type CareerPlayer, type OpeningWorld } from "./world.js";

export const SAVE_FORMAT = 1;

export interface RankingSnapshot {
  series_id: string;
  competition_id: string;
  season_id: string;
  club_id: string;
  points: number;
  mu: number;
  phi: number;
  sigma: number;
}

export interface ClubState {
  club_id: string;
  points: number;
  mu: number;
  phi: number;
  sigma: number;
  r: number;
  rd: number;
}

export interface CareerSave {
  save_format: typeof SAVE_FORMAT;
  contract_version: "career-match/1";
  label: OpeningWorld["label"];
  non_shippable_standin: true;
  career_seed: number;
  player_club_id: string;
  competition_id: "bound_circuit";
  season_id: "s1";
  clubs: OpeningWorld["clubs"];
  players: CareerPlayer[];
  contracts: CareerContract[];
  regular_fixtures: CircuitResult["regular_fixtures"];
  playoff_fixtures: CircuitResult["playoff_fixtures"];
  series: SeriesResult[];
  standings: CircuitResult["standings"];
  frozen_seeds: CircuitResult["frozen_seeds"];
  awards: Award[];
  signature_grants: SignatureGrant[];
  ranking_log: RankingSnapshot[];
  club_state: ClubState[];
}

function loserOf(series: SeriesResult): string {
  return series.winner_team_id === series.team_ids[0] ? series.team_ids[1] : series.team_ids[0];
}

export function runSeason(opts: { careerSeed: number; playerClubId: string }): CareerSave {
  return finishSeason(simulateCircuit(opts));
}

function finishSeason(circuit: CircuitResult): CareerSave {
  const clubs = [...circuit.world.clubs].sort((a, b) => a.opening_index - b.opening_index);
  const clubIndex = clubs.map((club) => ({ club_id: club.id, opening_index: club.opening_index }));
  const glicko = new Map<string, GlickoState>(clubs.map((club) => [club.id, initialGlicko()]));
  const bonus = new Map<string, number>(clubs.map((club) => [club.id, 0]));
  let place = new Map<string, number>();
  const regular: SeriesResult[] = [];
  const ranking_log: RankingSnapshot[] = [];

  for (const series of circuit.series) {
    const blueId = series.team_ids[0];
    const redId = series.team_ids[1];
    const blue = glicko.get(blueId);
    const red = glicko.get(redId);
    if (!blue || !red) throw new Error("missing glicko");
    const blueWon = series.winner_team_id === blueId;
    glicko.set(blueId, glickoSeries(blue, red, blueWon ? 1 : 0));
    glicko.set(redId, glickoSeries(red, blue, blueWon ? 0 : 1));

    if (series.stage === "regular") {
      regular.push(series);
      const rows = computeStandings(clubIndex, regular);
      place = new Map(rankClubs(rows, regular).map((id, index) => [id, index + 1]));
    } else if (series.stage === "semi") {
      bonus.set(loserOf(series), PLAYOFF_BONUS.semi);
    } else {
      bonus.set(series.winner_team_id, PLAYOFF_BONUS.champion);
      bonus.set(loserOf(series), PLAYOFF_BONUS.runner_up);
    }

    for (const club of clubs) {
      const current = glicko.get(club.id)!;
      const clubPlace = place.get(club.id);
      if (clubPlace === undefined) throw new Error("place missing");
      ranking_log.push({
        series_id: series.series_id,
        competition_id: series.competition_id,
        season_id: series.season_id,
        club_id: club.id,
        points: placementPoints(clubPlace, bonus.get(club.id) ?? 0),
        mu: current.mu,
        phi: current.phi,
        sigma: current.sigma,
      });
    }
  }

  const { awards, grants } = seasonAwards(circuit.series, circuit.world.season_id);
  const archives = new Map<string, string[]>(circuit.world.players.map((player) => [player.id, [...player.signature_archive]]));
  for (const grant of grants) {
    archives.set(grant.player_id, keepSignature(archives.get(grant.player_id) ?? [], grant.signature));
  }
  const players = circuit.world.players
    .map((player) => ({ ...player, signature_archive: archives.get(player.id) ?? [] }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const contracts = tickContracts(circuit.world.contracts).sort((a, b) => (a.player_id < b.player_id ? -1 : 1));
  const club_state: ClubState[] = clubs.map((club) => {
    const state = glicko.get(club.id)!;
    const display = glickoDisplay(state);
    const clubPlace = place.get(club.id)!;
    return {
      club_id: club.id,
      points: placementPoints(clubPlace, bonus.get(club.id) ?? 0),
      mu: state.mu,
      phi: state.phi,
      sigma: state.sigma,
      r: display.r,
      rd: display.rd,
    };
  });

  return {
    save_format: SAVE_FORMAT,
    contract_version: "career-match/1",
    label: circuit.world.label,
    non_shippable_standin: true,
    career_seed: circuit.career_seed,
    player_club_id: circuit.player_club_id,
    competition_id: "bound_circuit",
    season_id: "s1",
    clubs,
    players,
    contracts,
    regular_fixtures: circuit.regular_fixtures,
    playoff_fixtures: circuit.playoff_fixtures,
    series: circuit.series,
    standings: circuit.standings,
    frozen_seeds: circuit.frozen_seeds,
    awards,
    signature_grants: grants,
    ranking_log,
    club_state,
  };
}

export function saveJson(save: CareerSave): string {
  return canonicalString(save);
}

const SAVE_KEYS = [
  "save_format",
  "contract_version",
  "label",
  "non_shippable_standin",
  "career_seed",
  "player_club_id",
  "competition_id",
  "season_id",
  "clubs",
  "players",
  "contracts",
  "regular_fixtures",
  "playoff_fixtures",
  "series",
  "standings",
  "frozen_seeds",
  "awards",
  "signature_grants",
  "ranking_log",
  "club_state",
] as const;

function reject(message: string): never {
  throw new Error(`career save rejected: ${message}`);
}

/** Rebuild fixtures, the table, Glicko, points, and awards from validated series. */
function replayCircuit(careerSeed: number, playerClubId: string, series: SeriesResult[]): CircuitResult {
  const world = openingWorld();
  if (!world.clubs.some((club) => club.id === playerClubId)) reject("unknown club");
  const regularSeries = series.filter((item) => item.stage === "regular");
  const semiSeries = series.filter((item) => item.stage === "semi");
  const finalSeries = series.filter((item) => item.stage === "final");
  if (regularSeries.length !== 28 || semiSeries.length !== 2 || finalSeries.length !== 1) reject("series shape");
  const clubs = world.clubs.map((club) => ({ club_id: club.id, opening_index: club.opening_index }));
  const regularRows = computeStandings(clubs, regularSeries);
  const order = rankClubs(regularRows, regularSeries);
  if (order.length !== 8) reject("seeds");
  const frozen = order as [string, string, string, string, string, string, string, string];
  const seeds = frozen.slice(0, 4) as [string, string, string, string];
  const semis = semiFixtures(seeds);
  const semiOne = semiSeries.find((item) => item.fixture_id === "md8-semi-1v4");
  const semiTwo = semiSeries.find((item) => item.fixture_id === "md8-semi-2v3");
  if (!semiOne || !semiTwo || !finalSeries[0]) reject("playoff series");
  const finalFx = finalFixture(semiOne.winner_team_id, semiTwo.winner_team_id, seedRankMap(frozen));
  return {
    world,
    career_seed: careerSeed,
    player_club_id: playerClubId,
    regular_fixtures: regularSeasonFixtures(),
    playoff_fixtures: [semis[0], semis[1], finalFx],
    series,
    standings: assignFinish(regularRows, frozen),
    frozen_seeds: frozen,
  };
}

export function loadSave(json: string): CareerSave {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    reject("not json");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) reject("not an object");
  const record = value as Record<string, unknown>;
  if (record.save_format !== SAVE_FORMAT) reject(`save_format`);
  if (record.contract_version !== "career-match/1") reject("contract_version");
  if (!Array.isArray(record.series)) reject("series");
  let series: SeriesResult[];
  try {
    series = record.series.map((item) => validateSeriesResult(item));
  } catch (error) {
    reject(error instanceof Error ? error.message : "series");
  }
  if (typeof record.career_seed !== "number" || typeof record.player_club_id !== "string") reject("identity");
  const replayed = finishSeason(replayCircuit(record.career_seed, record.player_club_id, series));
  const projected: Record<string, unknown> = {};
  for (const key of SAVE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) reject(`missing ${key}`);
    projected[key] = key === "series" ? series : record[key];
  }
  if (canonicalString(projected) !== canonicalString(replayed)) reject("does not replay");
  return replayed;
}
