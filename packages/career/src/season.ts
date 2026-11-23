import { canonicalString, type SeriesResult } from "@lanebound/match-contract";
import { seasonAwards, keepSignature, type Award, type SignatureGrant } from "./awards.js";
import { tickContracts } from "./contracts.js";
import { glickoDisplay, glickoSeries, initialGlicko, type GlickoState } from "./glicko.js";
import { PLAYOFF_BONUS, placementPoints } from "./points.js";
import { simulateCircuit, type CircuitResult } from "./runner.js";
import { computeStandings, rankClubs } from "./standings.js";
import type { CareerContract, CareerPlayer, OpeningWorld } from "./world.js";

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
  const circuit = simulateCircuit(opts);
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
    career_seed: opts.careerSeed,
    player_club_id: opts.playerClubId,
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

export function loadSave(json: string): CareerSave {
  const value: unknown = JSON.parse(json);
  if (typeof value !== "object" || value === null) throw new Error("save is not an object");
  const record = value as Record<string, unknown>;
  if (record.save_format !== SAVE_FORMAT) throw new Error(`unsupported save_format ${String(record.save_format)}`);
  if (record.contract_version !== "career-match/1") throw new Error("unsupported contract_version");
  return record as unknown as CareerSave;
}
