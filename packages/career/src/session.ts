import {
  CAREER_MATCH_VERSION,
  validateMatchResult,
  validateSeriesResult,
  type MatchResult,
  type SeriesResult,
  type TacticPreset,
} from "@lanebound/match-contract";
import { seasonAwards, keepSignature, type Award, type SignatureGrant } from "./awards.js";
import { finalFixture, matchdayPlayOrder, regularSeasonFixtures, seedRankMap, semiFixtures, type Fixture } from "./calendar.js";
import { ARENA_CARDS, assertLoadout } from "./cards.js";
import { tickContracts } from "./contracts.js";
import { glickoDisplay, glickoSeries, initialGlicko, type GlickoState } from "./glicko.js";
import { PLAYOFF_BONUS, placementPoints } from "./points.js";
import { assignFinish, computeStandings, rankClubs, type StandingRow } from "./standings.js";
import { openingWorld, selectStarters, STANDIN_SEED, type CareerContract, type CareerPlayer, type Club, type OpeningWorld } from "./world.js";

export const SESSION_VERSION = 1;

export interface CardSlot {
  id: string;
  holder_id: string;
}

export interface SignatureChoice {
  player_id: string;
  incoming: string;
  choice: "keep" | "replace";
}

export interface PendingSignature {
  player_id: string;
  held: string;
  incoming: string;
}

export interface SessionClubState {
  club_id: string;
  points: number;
  r: number;
  rd: number;
}

export interface CareerSession {
  save_format: 1;
  contract_version: typeof CAREER_MATCH_VERSION;
  session_version: typeof SESSION_VERSION;
  label: string;
  non_shippable_standin: true;
  career_seed: number;
  player_club_id: string;
  human_preset: TacticPreset;
  loadout: CardSlot[];
  open_fixture_id: string | null;
  open_games: MatchResult[];
  advanced: boolean;
  signature_choices: SignatureChoice[];
  clubs: Club[];
  players: CareerPlayer[];
  contracts: CareerContract[];
  fixtures: Fixture[];
  series: SeriesResult[];
  standings: Array<StandingRow & { finish: number }>;
  playoff: Fixture[];
  awards: Award[];
  signature_grants: SignatureGrant[];
  pending_signature: PendingSignature | null;
  club_state: SessionClubState[];
  schedule: Fixture[];
  maps_played: number;
}

interface Decisions {
  human_preset: TacticPreset;
  loadout: CardSlot[];
  open_fixture_id: string | null;
  open_games: MatchResult[];
  advanced: boolean;
  signature_choices: SignatureChoice[];
}

function fail(message: string): never {
  throw new Error(`career save rejected: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function defaultLoadout(players: readonly CareerPlayer[], clubId: string): CardSlot[] {
  const starters = selectStarters(players, clubId);
  const commons = ARENA_CARDS.filter((card) => card.rarity === "Common").slice(0, 3);
  if (commons.length !== 3) fail("card catalogue");
  return commons.map((card, index) => ({ id: card.id, holder_id: starters[index]!.id }));
}

export function startCareer(playerClubId: string, careerSeed = 20261123): CareerSession {
  const world = openingWorld();
  if (!world.clubs.some((club) => club.id === playerClubId)) fail(`unknown club ${playerClubId}`);
  if (careerSeed !== STANDIN_SEED) fail("unsupported career seed");
  return view(world, playerClubId, [], {
    human_preset: "hold",
    loadout: defaultLoadout(world.players, playerClubId),
    open_fixture_id: null,
    open_games: [],
    advanced: false,
    signature_choices: [],
  });
}

export function sessionJson(session: CareerSession): string {
  return JSON.stringify({
    save_format: 1,
    contract_version: CAREER_MATCH_VERSION,
    session_version: SESSION_VERSION,
    label: session.label,
    non_shippable_standin: true,
    career_seed: session.career_seed,
    player_club_id: session.player_club_id,
    human_preset: session.human_preset,
    loadout: session.loadout,
    open_fixture_id: session.open_fixture_id,
    open_games: session.open_games,
    advanced: session.advanced,
    signature_choices: session.signature_choices,
    series: session.series,
  });
}

/** Rebuilds clubs, the table, points, and awards from the opening world plus validated series. */
export function parseSession(input: unknown): CareerSession {
  if (!isRecord(input)) fail("not an object");
  if (input.save_format !== 1) fail("save_format");
  if (input.contract_version !== CAREER_MATCH_VERSION) fail("contract_version");
  if (input.session_version !== SESSION_VERSION) fail("session_version");
  if (input.non_shippable_standin !== true) fail("stand-in marker");
  if (typeof input.player_club_id !== "string") fail("player_club_id");
  if (input.career_seed !== 20261123) fail("career_seed");
  if (typeof input.label !== "string" || input.label.length === 0 || input.label.length > 80) fail("label");
  if (!Array.isArray(input.series)) fail("series");
  const series = input.series.map((item) => validateSeriesResult(item));
  const world = openingWorld();
  if (!world.clubs.some((club) => club.id === input.player_club_id)) fail("unknown club");
  const known = new Set(world.clubs.map((club) => club.id));
  for (const item of series) {
    if (!known.has(item.team_ids[0]) || !known.has(item.team_ids[1])) fail("series club");
    if (item.source !== "fake") fail("series source");
  }
  const preset = input.human_preset === undefined ? "hold" : input.human_preset;
  if (preset !== "hold" && preset !== "hunt" && preset !== "starve") fail("human_preset");
  const loadout = input.loadout === undefined ? defaultLoadout(world.players, input.player_club_id) : readLoadout(input.loadout, world, input.player_club_id);
  const openGames = input.open_games === undefined ? [] : readGames(input.open_games);
  const openId = input.open_fixture_id === undefined || input.open_fixture_id === null ? null : input.open_fixture_id;
  if (openId !== null && typeof openId !== "string") fail("open_fixture_id");
  if ((openId === null) !== (openGames.length === 0) && openGames.length === 0 && openId !== null) {
    /* an open fixture with no maps yet is the series about to start; allowed */
  }
  if (openId === null && openGames.length > 0) fail("open_games");
  const advanced = input.advanced === undefined ? false : input.advanced;
  if (typeof advanced !== "boolean") fail("advanced");
  const choices = input.signature_choices === undefined ? [] : readChoices(input.signature_choices);
  return view(world, input.player_club_id, series, {
    human_preset: preset,
    loadout,
    open_fixture_id: openId,
    open_games: openGames,
    advanced,
    signature_choices: choices,
  });
}

function readLoadout(value: unknown, world: OpeningWorld, clubId: string): CardSlot[] {
  if (!Array.isArray(value)) fail("loadout");
  const roster = new Set(world.players.filter((player) => player.club_id === clubId).map((player) => player.id));
  const slots = value.map((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.holder_id !== "string") fail("loadout");
    if (!roster.has(item.holder_id)) fail("loadout holder");
    return { id: item.id, holder_id: item.holder_id };
  });
  assertLoadout(slots.map((slot) => slot.id));
  return slots;
}

function readGames(value: unknown): MatchResult[] {
  if (!Array.isArray(value)) fail("open_games");
  return value.map((item) => {
    try {
      return validateMatchResult(item);
    } catch (error) {
      fail(error instanceof Error ? error.message : "open_games");
    }
  });
}

function readChoices(value: unknown): SignatureChoice[] {
  if (!Array.isArray(value)) fail("signature_choices");
  return value.map((item) => {
    if (!isRecord(item) || typeof item.player_id !== "string" || typeof item.incoming !== "string") fail("signature_choices");
    if (item.choice !== "keep" && item.choice !== "replace") fail("signature_choices");
    return { player_id: item.player_id, incoming: item.incoming, choice: item.choice };
  });
}

export function seasonSchedule(playerClubId: string, series: readonly SeriesResult[]): Fixture[] {
  const regular = regularSeasonFixtures();
  const ordered: Fixture[] = [];
  for (let day = 1; day <= 7; day++) {
    ordered.push(...matchdayPlayOrder(regular.filter((fixture) => fixture.matchday === day), playerClubId));
  }
  const regularSeries = series.filter((item) => item.stage === "regular");
  if (regularSeries.length < 28) return ordered;
  const world = openingWorld();
  const clubs = world.clubs.map((club) => ({ club_id: club.id, opening_index: club.opening_index }));
  const rows = computeStandings(clubs, regularSeries);
  const frozen = rankClubs(rows, regularSeries);
  if (frozen.length !== 8) fail("seeds");
  const seeds = frozen.slice(0, 4) as [string, string, string, string];
  const semis = semiFixtures(seeds);
  ordered.push(...matchdayPlayOrder(semis, playerClubId));
  const semiOne = series.find((item) => item.fixture_id === "md8-semi-1v4");
  const semiTwo = series.find((item) => item.fixture_id === "md8-semi-2v3");
  if (semiOne && semiTwo) {
    ordered.push(finalFixture(semiOne.winner_team_id, semiTwo.winner_team_id, seedRankMap(frozen)));
  }
  return ordered;
}

function view(world: OpeningWorld, playerClubId: string, series: SeriesResult[], decisions: Decisions): CareerSession {
  const rows = computeStandings(
    world.clubs.map((club) => ({ club_id: club.id, opening_index: club.opening_index })),
    series,
  );
  const order = rankClubs(rows, series);
  const schedule = seasonSchedule(playerClubId, series);
  const done = new Set(series.map((item) => item.fixture_id));
  if (decisions.open_fixture_id !== null) {
    const next = schedule.find((fixture) => !done.has(fixture.id));
    if (!next || next.id !== decisions.open_fixture_id) fail("open fixture");
  }
  const folded = foldClubs(world, series);
  const finalSeries = series.find((item) => item.stage === "final");
  const awarded = finalSeries ? seasonAwards(series, world.season_id) : { awards: [], grants: [] };
  const signed = applySignatures(world, playerClubId, awarded.grants, decisions.signature_choices);
  const club = world.clubs.find((item) => item.id === playerClubId)!;
  const maps = series.reduce((sum, item) => sum + item.games.length, 0) + decisions.open_games.length;
  return {
    save_format: 1,
    contract_version: CAREER_MATCH_VERSION,
    session_version: SESSION_VERSION,
    label: `${club.tag} · Bound Circuit`,
    non_shippable_standin: true,
    career_seed: STANDIN_SEED,
    player_club_id: playerClubId,
    human_preset: decisions.human_preset,
    loadout: decisions.loadout,
    open_fixture_id: decisions.open_fixture_id,
    open_games: decisions.open_games,
    advanced: decisions.advanced,
    signature_choices: decisions.signature_choices,
    clubs: world.clubs,
    players: signed.players,
    contracts: decisions.advanced ? tickContracts(world.contracts) : world.contracts,
    fixtures: regularSeasonFixtures(),
    series,
    standings: assignFinish(rows, order),
    playoff: schedule.filter((fixture) => fixture.stage !== "regular"),
    awards: awarded.awards,
    signature_grants: awarded.grants,
    pending_signature: signed.pending,
    club_state: folded,
    schedule,
    maps_played: maps,
  };
}

function foldClubs(world: OpeningWorld, series: readonly SeriesResult[]): SessionClubState[] {
  const clubs = [...world.clubs].sort((a, b) => a.opening_index - b.opening_index);
  const clubIndex = clubs.map((club) => ({ club_id: club.id, opening_index: club.opening_index }));
  const glicko = new Map<string, GlickoState>(clubs.map((club) => [club.id, initialGlicko()]));
  const bonus = new Map<string, number>(clubs.map((club) => [club.id, 0]));
  let place = new Map<string, number>(clubs.map((club) => [club.id, club.opening_index + 1]));
  const regular: SeriesResult[] = [];
  for (const item of series) {
    const blueId = item.team_ids[0];
    const redId = item.team_ids[1];
    const blue = glicko.get(blueId);
    const red = glicko.get(redId);
    if (!blue || !red) fail("glicko");
    const blueWon = item.winner_team_id === blueId;
    glicko.set(blueId, glickoSeries(blue, red, blueWon ? 1 : 0));
    glicko.set(redId, glickoSeries(red, blue, blueWon ? 0 : 1));
    if (item.stage === "regular") {
      regular.push(item);
      place = new Map(rankClubs(computeStandings(clubIndex, regular), regular).map((id, index) => [id, index + 1]));
    } else if (item.stage === "semi") {
      const loser = item.winner_team_id === blueId ? redId : blueId;
      bonus.set(loser, PLAYOFF_BONUS.semi);
    } else {
      const loser = item.winner_team_id === blueId ? redId : blueId;
      bonus.set(item.winner_team_id, PLAYOFF_BONUS.champion);
      bonus.set(loser, PLAYOFF_BONUS.runner_up);
    }
  }
  return clubs.map((club) => {
    const state = glicko.get(club.id)!;
    const display = glickoDisplay(state);
    return {
      club_id: club.id,
      points: placementPoints(place.get(club.id) ?? club.opening_index + 1, bonus.get(club.id) ?? 0),
      r: display.r,
      rd: display.rd,
    };
  });
}

function applySignatures(
  world: OpeningWorld,
  playerClubId: string,
  grants: readonly SignatureGrant[],
  choices: readonly SignatureChoice[],
): { players: CareerPlayer[]; pending: PendingSignature | null } {
  const human = new Set(world.players.filter((player) => player.club_id === playerClubId).map((player) => player.id));
  const archives = new Map<string, string[]>();
  let pending: PendingSignature | null = null;
  for (const grant of grants) {
    if (pending) break;
    const held = archives.get(grant.player_id) ?? [];
    if (held.length > 0 && held[0] !== grant.signature && human.has(grant.player_id)) {
      const choice = choices.find((item) => item.player_id === grant.player_id && item.incoming === grant.signature);
      if (!choice) {
        pending = { player_id: grant.player_id, held: held[0]!, incoming: grant.signature };
        break;
      }
      if (choice.choice === "replace") archives.set(grant.player_id, keepSignature(held, grant.signature));
      continue;
    }
    archives.set(grant.player_id, keepSignature(held, grant.signature));
  }
  for (const choice of choices) {
    const known = grants.some((grant) => grant.player_id === choice.player_id && grant.signature === choice.incoming);
    if (!known) fail("signature choice");
  }
  const players = world.players.map((player) => ({
    ...player,
    signature_archive: [...(archives.get(player.id) ?? player.signature_archive)],
  }));
  return { players, pending };
}

export function decisionsOf(session: CareerSession): Decisions {
  return {
    human_preset: session.human_preset,
    loadout: session.loadout,
    open_fixture_id: session.open_fixture_id,
    open_games: session.open_games,
    advanced: session.advanced,
    signature_choices: session.signature_choices,
  };
}

export function withDecisions(session: CareerSession, series: SeriesResult[], decisions: Decisions): CareerSession {
  return view(openingWorld(), session.player_club_id, series, decisions);
}
