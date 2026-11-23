import {
  validateSeriesResult,
  type MatchConfig,
  type MatchResult,
  type SeriesContext,
  type SeriesResult,
  type TacticPreset,
} from "@lanebound/match-contract";
import { assertLoadout } from "./cards.js";
import { generateFakeMatch } from "./fake.js";
import { selectPicks, tacticsFor, toContractPlayer } from "./lineup.js";
import { gameSeed, seriesSeed } from "./rng.js";
import { seriesDuration, seriesGameScore, seriesMvp, winsTarget } from "./series.js";
import {
  decisionsOf,
  defaultLoadout,
  seasonSchedule,
  withDecisions,
  type CareerSession,
  type CardSlot,
} from "./session.js";
import { openingWorld, selectStarters, type CareerPlayer } from "./world.js";

function locked(session: CareerSession): void {
  if (session.open_games.length > 0) throw new Error("career save rejected: series is locked");
}

export function setPreset(session: CareerSession, preset: TacticPreset): CareerSession {
  locked(session);
  if (preset !== "hold" && preset !== "hunt" && preset !== "starve") throw new Error("career save rejected: human_preset");
  return withDecisions(session, session.series, { ...decisionsOf(session), human_preset: preset });
}

export function setLoadout(session: CareerSession, cardIds: readonly string[]): CareerSession {
  locked(session);
  assertLoadout(cardIds);
  const starters = selectStarters(openingWorld().players, session.player_club_id);
  const loadout: CardSlot[] = cardIds.map((id, index) => ({ id, holder_id: starters[index]!.id }));
  return withDecisions(session, session.series, { ...decisionsOf(session), loadout });
}

export interface DraftSlot {
  player_id: string;
  name: string;
  slot: string;
  champion: string;
}

export function draftPreview(session: CareerSession): {
  fixture_id: string | null;
  game_index: number;
  fearless: boolean;
  blue: DraftSlot[];
  locked_champions: string[];
} {
  const fixture = nextFixture(session);
  const starters = starterMap();
  const gameIndex = session.open_games.length + 1;
  const fearless = gameIndex <= 2;
  if (!fixture) {
    return { fixture_id: null, game_index: gameIndex, fearless, blue: [], locked_champions: [] };
  }
  const blue = starters.get(fixture.team_ids[0]);
  if (!blue) throw new Error("career save rejected: starters");
  const used = fearless ? usedPicks(session.open_games, 0) : [];
  const picks = selectPicks(blue, used);
  return {
    fixture_id: fixture.id,
    game_index: gameIndex,
    fearless,
    blue: blue.map((player, index) => ({
      player_id: player.id,
      name: player.name,
      slot: player.primary_slot,
      champion: picks[index]!,
    })),
    locked_champions: used,
  };
}

export function playNextMap(session: CareerSession): CareerSession {
  const fixture = nextFixture(session);
  if (!fixture) throw new Error("career save rejected: season is complete");
  const world = openingWorld();
  const starters = starterMap();
  const blueStarters = starters.get(fixture.team_ids[0]);
  const redStarters = starters.get(fixture.team_ids[1]);
  const blueClub = world.clubs.find((club) => club.id === fixture.team_ids[0]);
  const redClub = world.clubs.find((club) => club.id === fixture.team_ids[1]);
  if (!blueStarters || !redStarters || !blueClub || !redClub) throw new Error("career save rejected: fixture");
  const games = [...session.open_games];
  const gameIndex = games.length + 1;
  const fearless = gameIndex <= 2;
  const usedNow: [string[], string[]] = fearless ? [usedPicks(games, 0), usedPicks(games, 1)] : [[], []];
  const bluePicks = selectPicks(blueStarters, usedNow[0]);
  const redPicks = selectPicks(redStarters, usedNow[1]);
  const humanBlue = fixture.team_ids[0] === session.player_club_id;
  const humanRed = fixture.team_ids[1] === session.player_club_id;
  const context: SeriesContext = {
    contract_version: "career-match/1",
    competition_id: world.competition_id,
    season_id: world.season_id,
    series_id: `series-${fixture.id}`,
    fixture_id: fixture.id,
    stage: fixture.stage,
    format: fixture.format,
    game_index: gameIndex,
    series_score: seriesGameScore(games),
    team_ids: fixture.team_ids,
    used_picks: usedNow,
    source: "fake",
  };
  const config: MatchConfig = {
    seed: gameSeed(seriesSeed(session.career_seed, fixture.ordinal), gameIndex),
    constants: {},
    draft_mode: "fixed",
    notes: "NON-SHIPPABLE STAND-IN",
    blue: side(blueStarters, bluePicks, tacticsFor(blueClub, session.player_club_id, session.human_preset), humanBlue ? session.loadout : defaultLoadout(world.players, blueClub.id), blueClub.id),
    red: side(redStarters, redPicks, tacticsFor(redClub, session.player_club_id, session.human_preset), humanRed ? session.loadout : defaultLoadout(world.players, redClub.id), redClub.id),
  };
  games.push(generateFakeMatch(context, config));
  const target = winsTarget(fixture.format);
  const score = seriesGameScore(games);
  if (score[0] < target && score[1] < target) {
    return withDecisions(session, session.series, { ...decisionsOf(session), open_fixture_id: fixture.id, open_games: games });
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
  return withDecisions(session, [...session.series, validateSeriesResult(result)], {
    ...decisionsOf(session),
    open_fixture_id: null,
    open_games: [],
  });
}

export function skipSeries(session: CareerSession): CareerSession {
  const fixture = nextFixture(session);
  if (!fixture) throw new Error("career save rejected: season is complete");
  let current = session.open_fixture_id === fixture.id ? session : withDecisions(session, session.series, { ...decisionsOf(session), open_fixture_id: fixture.id, open_games: session.open_games });
  let guard = 0;
  while (current.open_fixture_id !== null || nextFixture(current)?.id === fixture.id) {
    current = playNextMap(current);
    guard += 1;
    if (guard > 9) throw new Error("career save rejected: series did not end");
    if (current.series.some((item) => item.fixture_id === fixture.id)) break;
  }
  return current;
}

export function chooseSignature(session: CareerSession, choice: "keep" | "replace"): CareerSession {
  const pending = session.pending_signature;
  if (!pending) throw new Error("career save rejected: no signature choice");
  return withDecisions(session, session.series, {
    ...decisionsOf(session),
    signature_choices: [...session.signature_choices, { player_id: pending.player_id, incoming: pending.incoming, choice }],
  });
}

export function advanceSeason(session: CareerSession): CareerSession {
  if (session.pending_signature) throw new Error("career save rejected: signature choice is open");
  if (!session.series.some((item) => item.stage === "final")) throw new Error("career save rejected: season is not over");
  if (nextFixture(session)) throw new Error("career save rejected: season is not over");
  return withDecisions(session, session.series, { ...decisionsOf(session), advanced: true });
}

export function latestMap(session: CareerSession): MatchResult | null {
  const open = session.open_games[session.open_games.length - 1];
  if (open) return open;
  const last = session.series[session.series.length - 1];
  return last?.games[last.games.length - 1] ?? null;
}

function nextFixture(session: CareerSession): CareerSession["schedule"][number] | null {
  const done = new Set(session.series.map((item) => item.fixture_id));
  if (session.open_fixture_id) {
    return seasonSchedule(session.player_club_id, session.series).find((fixture) => fixture.id === session.open_fixture_id) ?? null;
  }
  return session.schedule.find((fixture) => fixture.id && !done.has(fixture.id)) ?? null;
}

function usedPicks(games: readonly MatchResult[], side: 0 | 1): string[] {
  const used: string[] = [];
  for (const game of games) {
    if (game.game_index > 2) continue;
    const champs = side === 0 ? game.champ_ids.slice(0, 5) : game.champ_ids.slice(5);
    used.push(...champs);
  }
  return used;
}

function starterMap(): Map<string, CareerPlayer[]> {
  const world = openingWorld();
  return new Map(world.clubs.map((club) => [club.id, selectStarters(world.players, club.id)]));
}

function side(
  starters: CareerPlayer[],
  picks: string[],
  tactics: ReturnType<typeof tacticsFor>,
  loadout: CardSlot[],
  clubId: string,
): MatchConfig["blue"] {
  return {
    players: starters.map(toContractPlayer),
    picks,
    tactics,
    card_loadout: loadout,
    club_id: clubId,
  };
}
