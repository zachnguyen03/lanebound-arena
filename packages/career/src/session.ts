import { CAREER_MATCH_VERSION, validateSeriesResult, type SeriesResult } from "@lanebound/match-contract";
import { regularSeasonFixtures, semiFixtures, type Fixture } from "./calendar.js";
import { computeStandings, rankClubs, assignFinish, type StandingRow } from "./standings.js";
import { openingWorld, STANDIN_SEED, type CareerContract, type CareerPlayer, type Club } from "./world.js";

export const SESSION_VERSION = 1;

export interface CareerSession {
  save_format: 1;
  contract_version: typeof CAREER_MATCH_VERSION;
  session_version: typeof SESSION_VERSION;
  label: string;
  non_shippable_standin: true;
  career_seed: number;
  player_club_id: string;
  clubs: Club[];
  players: CareerPlayer[];
  contracts: CareerContract[];
  fixtures: Fixture[];
  series: SeriesResult[];
  standings: Array<StandingRow & { finish: number }>;
  playoff: Fixture[];
}

function fail(message: string): never {
  throw new Error(`career save rejected: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function startCareer(playerClubId: string, careerSeed = 20261123): CareerSession {
  const world = openingWorld();
  if (!world.clubs.some((club) => club.id === playerClubId)) fail(`unknown club ${playerClubId}`);
  if (careerSeed !== STANDIN_SEED) fail("unsupported career seed");
  return view(world, playerClubId, []);
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
    series: session.series,
  });
}

/** Rebuilds clubs, ratings, and the table from the opening world. Imported series are validated, never trusted as standings. */
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
  return view(world, input.player_club_id, series);
}

function view(world: ReturnType<typeof openingWorld>, playerClubId: string, series: SeriesResult[]): CareerSession {
  const rows = computeStandings(
    world.clubs.map((club) => ({ club_id: club.id, opening_index: club.opening_index })),
    series,
  );
  const order = rankClubs(rows, series);
  const regular = series.filter((item) => item.stage === "regular");
  const seeds = regular.length >= 28 ? rankClubs(computeStandings(
    world.clubs.map((club) => ({ club_id: club.id, opening_index: club.opening_index })),
    regular,
  ), regular) : null;
  const playoff: Fixture[] = seeds
    ? [...semiFixtures(seeds.slice(0, 4) as [string, string, string, string])]
    : [];
  const club = world.clubs.find((item) => item.id === playerClubId)!;
  return {
    save_format: 1,
    contract_version: CAREER_MATCH_VERSION,
    session_version: SESSION_VERSION,
    label: `${club.tag} · Bound Circuit`,
    non_shippable_standin: true,
    career_seed: STANDIN_SEED,
    player_club_id: playerClubId,
    clubs: world.clubs,
    players: world.players,
    contracts: world.contracts,
    fixtures: regularSeasonFixtures(),
    series,
    standings: assignFinish(rows, order),
    playoff,
  };
}
