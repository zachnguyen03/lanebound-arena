import { FAKE_CONSTANTS_HASH, assertAcceptableSimReplay, fakeDigest, isFakeDigest } from "./digest.js";
import {
  CAREER_MATCH_VERSION,
  COMP_ARCHETYPES,
  SLOTS,
  type CardMatchLog,
  type ContractPlayer,
  type MatchConfig,
  type MatchResult,
  type PlayerMatchStats,
  type SeriesContext,
  type SeriesResult,
  type SideConfig,
  type Slot,
  type Tactics,
} from "./types.js";

export class ContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractError";
  }
}

function fail(message: string): never {
  throw new ContractError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function reqString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.length === 0) fail(`${key} must be a non-empty string`);
  return value;
}

function reqInt(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  if (typeof value !== "number" || !Number.isInteger(value)) fail(`${key} must be an integer`);
  return value;
}

function reqNum(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  if (typeof value !== "number" || !Number.isFinite(value)) fail(`${key} must be a finite number`);
  return value;
}

function oneOf<T extends string>(value: string, allowed: readonly T[], key: string): T {
  if (!(allowed as readonly string[]).includes(value)) fail(`${key} invalid: ${value}`);
  return value as T;
}

const TACTIC_PRESETS = ["hold", "hunt", "starve"] as const;

function readSidePresets(value: unknown): { blue: (typeof TACTIC_PRESETS)[number]; red: (typeof TACTIC_PRESETS)[number] } {
  if (!isRecord(value)) fail("tactics");
  return {
    blue: oneOf(reqString(value, "blue"), TACTIC_PRESETS, "tactics.blue"),
    red: oneOf(reqString(value, "red"), TACTIC_PRESETS, "tactics.red"),
  };
}

const SLOT_SET = new Set<string>(SLOTS);

function readSlot(value: unknown, key: string): Slot {
  if (typeof value !== "string" || !SLOT_SET.has(value)) fail(`${key} invalid`);
  return value as Slot;
}

function readPlayer(value: unknown, label: string): ContractPlayer {
  if (!isRecord(value)) fail(`${label} player must be an object`);
  const attrsRaw = value.attrs;
  if (!isRecord(attrsRaw)) fail(`${label} attrs`);
  const masteryRaw = value.mastery;
  if (!isRecord(masteryRaw)) fail(`${label} mastery`);
  const mastery: Record<string, number> = {};
  for (const key of Object.keys(masteryRaw)) {
    const n = masteryRaw[key];
    if (typeof n !== "number" || !Number.isFinite(n)) fail(`${label} mastery.${key}`);
    mastery[key] = n;
  }
  const archive = value.signature_archive;
  if (!Array.isArray(archive) || archive.some((item) => typeof item !== "string")) {
    fail(`${label} signature_archive`);
  }
  return {
    id: reqString(value, "id"),
    name: reqString(value, "name"),
    club_id: reqString(value, "club_id"),
    primary_slot: readSlot(value.primary_slot, `${label} primary_slot`),
    attrs: {
      aim: reqNum(attrsRaw, "aim"),
      reflexes: reqNum(attrsRaw, "reflexes"),
      execution: reqNum(attrsRaw, "execution"),
      decision: reqNum(attrsRaw, "decision"),
      positioning: reqNum(attrsRaw, "positioning"),
      teamwork: reqNum(attrsRaw, "teamwork"),
    },
    ovr: reqNum(value, "ovr"),
    mastery,
    signature_archive: archive as string[],
    last_stack_ovr: reqNum(value, "last_stack_ovr"),
    age: reqNum(value, "age"),
  };
}

function readTactics(value: unknown): Tactics {
  if (!isRecord(value)) fail("tactics");
  const primary = oneOf(reqString(value, "primary"), ["hold", "hunt", "starve"] as const, "primary");
  const aggression = reqInt(value, "aggression");
  if (aggression !== -1 && aggression !== 0 && aggression !== 1) fail("aggression");
  const combo = oneOf(reqString(value, "combo_style"), ["auto", "hold_R"] as const, "combo_style");
  const tactics: Tactics = { primary, aggression, combo_style: combo };
  if (value.secondary !== undefined) {
    tactics.secondary = oneOf(String(value.secondary), ["hold", "hunt", "starve"] as const, "secondary");
  }
  if (value.focus !== undefined) tactics.focus = reqString(value, "focus");
  if (value.protect !== undefined) tactics.protect = reqString(value, "protect");
  return tactics;
}

function readSide(value: unknown, label: string): SideConfig {
  if (!isRecord(value)) fail(label);
  const playersRaw = value.players;
  const picksRaw = value.picks;
  const cardsRaw = value.card_loadout;
  if (!Array.isArray(playersRaw) || playersRaw.length !== 5) fail(`${label}.players`);
  if (!Array.isArray(picksRaw) || picksRaw.length !== 5 || picksRaw.some((p) => typeof p !== "string")) {
    fail(`${label}.picks`);
  }
  if (!Array.isArray(cardsRaw) || cardsRaw.length !== 3) fail(`${label}.card_loadout`);
  const card_loadout = cardsRaw.map((card, i) => {
    if (!isRecord(card)) fail(`${label}.card_loadout[${i}]`);
    return { id: reqString(card, "id"), holder_id: reqString(card, "holder_id") };
  });
  const side: SideConfig = {
    players: playersRaw.map((player, i) => readPlayer(player, `${label}.players[${i}]`)),
    picks: picksRaw as string[],
    tactics: readTactics(value.tactics),
    card_loadout,
  };
  if (value.club_id !== undefined) side.club_id = reqString(value, "club_id");
  return side;
}

export function validateSeriesContext(input: unknown): SeriesContext {
  if (!isRecord(input)) fail("SeriesContext");
  const version = reqString(input, "contract_version");
  if (version !== CAREER_MATCH_VERSION) fail(`contract_version ${version}`);
  const score = input.series_score;
  if (!Array.isArray(score) || score.length !== 2) fail("series_score");
  const teams = input.team_ids;
  if (!Array.isArray(teams) || teams.length !== 2) fail("team_ids");
  const used = input.used_picks;
  if (!Array.isArray(used) || used.length !== 2) fail("used_picks");
  const readIds = (value: unknown, key: string): string[] => {
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) fail(key);
    return value as string[];
  };
  const ctx: SeriesContext = {
    contract_version: CAREER_MATCH_VERSION,
    competition_id: reqString(input, "competition_id"),
    season_id: reqString(input, "season_id"),
    series_id: reqString(input, "series_id"),
    stage: oneOf(reqString(input, "stage"), ["regular", "semi", "final"] as const, "stage"),
    format: oneOf(reqString(input, "format"), ["bo1", "bo3", "bo5"] as const, "format"),
    game_index: reqInt(input, "game_index"),
    series_score: [reqInt({ series_score: score[0] }, "series_score"), reqInt({ series_score: score[1] }, "series_score")],
    team_ids: [reqString({ team_ids: teams[0] }, "team_ids"), reqString({ team_ids: teams[1] }, "team_ids")],
    used_picks: [readIds(used[0], "used_picks[0]"), readIds(used[1], "used_picks[1]")],
    source: oneOf(reqString(input, "source"), ["sim", "fake"] as const, "source"),
  };
  if (ctx.game_index < 1) fail("game_index");
  if (input.fixture_id !== undefined) ctx.fixture_id = reqString(input, "fixture_id");
  return ctx;
}

export function validateMatchConfig(input: unknown): MatchConfig {
  if (!isRecord(input)) fail("MatchConfig");
  const seed = reqInt(input, "seed");
  if (seed < 0 || seed > 0xffffffff) fail("seed");
  if (!isRecord(input.constants)) fail("constants");
  const config: MatchConfig = {
    seed,
    constants: input.constants,
    blue: readSide(input.blue, "blue"),
    red: readSide(input.red, "red"),
    draft_mode: oneOf(reqString(input, "draft_mode"), ["quick", "full", "fixed"] as const, "draft_mode"),
  };
  if (input.notes !== undefined) config.notes = String(input.notes);
  if (config.draft_mode === "fixed") {
    if (config.blue.picks.some((pick) => pick.length === 0) || config.red.picks.some((pick) => pick.length === 0)) {
      fail("fixed draft requires picks");
    }
  }
  return config;
}

function readScoreParts(value: unknown, key: string): { kills: number; ticks: number; claims: number } {
  if (!isRecord(value)) fail(key);
  return { kills: reqInt(value, "kills"), ticks: reqInt(value, "ticks"), claims: reqInt(value, "claims") };
}

function readStats(value: unknown, index: number): PlayerMatchStats {
  if (!isRecord(value)) fail(`players[${index}]`);
  const denies = value.claim_denies === undefined ? 0 : reqInt(value, "claim_denies");
  return {
    player_id: reqString(value, "player_id"),
    slot: readSlot(value.slot, `players[${index}].slot`),
    champ_id: reqString(value, "champ_id"),
    side: oneOf(reqString(value, "side"), ["blue", "red"] as const, "side"),
    k: reqInt(value, "k"),
    d: reqInt(value, "d"),
    a: reqInt(value, "a"),
    dmg: reqNum(value, "dmg"),
    heals: reqNum(value, "heals"),
    zone_seconds: reqNum(value, "zone_seconds"),
    orbs: reqInt(value, "orbs"),
    peels: reqInt(value, "peels"),
    claim_denies: denies,
    rating: reqNum(value, "rating"),
    z: reqNum(value, "z"),
  };
}

function readCardLog(value: unknown, index: number): CardMatchLog {
  if (!isRecord(value)) fail(`cards[${index}]`);
  const outcome = oneOf(reqString(value, "outcome"), ["fired", "expired_unmet"] as const, "outcome");
  const card: CardMatchLog = {
    card_id: reqString(value, "card_id"),
    holder_id: reqString(value, "holder_id"),
    side: oneOf(reqString(value, "side"), ["blue", "red"] as const, "side"),
    outcome,
  };
  if (outcome === "fired") card.t_fired = reqNum(value, "t_fired");
  return card;
}

export function validateMatchResult(input: unknown): MatchResult {
  if (!isRecord(input)) fail("MatchResult");
  const version = reqString(input, "contract_version");
  if (version !== CAREER_MATCH_VERSION) fail("contract_version");
  const parts = input.score_parts;
  if (!Array.isArray(parts) || parts.length !== 2) fail("score_parts");
  const playersRaw = input.players;
  const kdaRaw = input.kda;
  const cardsRaw = input.cards;
  const champs = input.champ_ids;
  if (!Array.isArray(playersRaw) || playersRaw.length !== 10) fail("players");
  if (!Array.isArray(kdaRaw) || kdaRaw.length !== 10) fail("kda");
  if (!Array.isArray(cardsRaw)) fail("cards");
  if (!Array.isArray(champs) || champs.length !== 10) fail("champ_ids");
  const archetypes = input.archetypes;
  if (!isRecord(archetypes)) fail("archetypes");
  const winner = oneOf(reqString(input, "winner"), ["blue", "red"] as const, "winner");
  const scoreBlue = reqInt(input, "score_blue");
  const scoreRed = reqInt(input, "score_red");
  if (scoreBlue === scoreRed) fail("drawn map is not persisted");
  if (winner === "blue" && scoreBlue < scoreRed) fail("winner/score");
  if (winner === "red" && scoreRed < scoreBlue) fail("winner/score");
  const kda = kdaRaw.map((row, i) => {
    if (!isRecord(row)) fail(`kda[${i}]`);
    return { k: reqInt(row, "k"), d: reqInt(row, "d"), a: reqInt(row, "a"), dmg: reqNum(row, "dmg") };
  });
  const result: MatchResult = {
    contract_version: CAREER_MATCH_VERSION,
    source: oneOf(reqString(input, "source"), ["sim", "fake"] as const, "source"),
    competition_id: reqString(input, "competition_id"),
    season_id: reqString(input, "season_id"),
    series_id: reqString(input, "series_id"),
    game_index: reqInt(input, "game_index"),
    seed: reqInt(input, "seed"),
    digest: reqString(input, "digest"),
    winner,
    reason: oneOf(
      reqString(input, "reason"),
      ["first_to_10", "clock", "sudden_death", "zone_time", "takedowns", "coin_flip"] as const,
      "reason",
    ),
    duration_s: reqNum(input, "duration_s"),
    score_blue: scoreBlue,
    score_red: scoreRed,
    score_parts: [readScoreParts(parts[0], "score_parts[0]"), readScoreParts(parts[1], "score_parts[1]")],
    archetypes: {
      blue: oneOf(reqString(archetypes, "blue"), COMP_ARCHETYPES, "archetypes.blue"),
      red: oneOf(reqString(archetypes, "red"), COMP_ARCHETYPES, "archetypes.red"),
    },
    tactics: readSidePresets(input.tactics),
    champ_ids: champs.map((id) => {
      if (typeof id !== "string") fail("champ_ids");
      return id;
    }),
    peel_fired: reqInt(input, "peel_fired"),
    peel_eligible: reqInt(input, "peel_eligible"),
    sanctuary_violations: reqInt(input, "sanctuary_violations"),
    claim_opened: reqInt(input, "claim_opened"),
    claim_denied: reqInt(input, "claim_denied"),
    claim_paid: reqInt(input, "claim_paid"),
    t_first_R: reqNum(input, "t_first_R"),
    t_L7: reqNum(input, "t_L7"),
    kda,
    constants_hash: reqString(input, "constants_hash"),
    players: playersRaw.map((row, i) => readStats(row, i)),
    cards: cardsRaw.map((row, i) => readCardLog(row, i)),
    mvp_player_id: reqString(input, "mvp_player_id"),
  };
  if (result.source === "fake") {
    if (!isFakeDigest(result.digest)) fail("fake result digest must start with fake:");
    if (result.constants_hash !== FAKE_CONSTANTS_HASH) fail("fake constants_hash");
    if (result.digest !== fakeDigest(result)) fail("fake digest does not match body");
  } else {
    assertAcceptableSimReplay(result.digest);
  }
  for (let i = 0; i < 10; i++) {
    const stats = result.players[i]!;
    const row = result.kda[i]!;
    if (stats.k !== row.k || stats.d !== row.d || stats.a !== row.a || stats.dmg !== row.dmg) {
      fail(`kda/players mismatch at ${i}`);
    }
  }
  return result;
}

export function validateSeriesResult(input: unknown): SeriesResult {
  if (!isRecord(input)) fail("SeriesResult");
  const version = reqString(input, "contract_version");
  if (version !== CAREER_MATCH_VERSION) fail("contract_version");
  const gamesRaw = input.games;
  if (!Array.isArray(gamesRaw) || gamesRaw.length === 0) fail("games");
  const games = gamesRaw.map((game) => validateMatchResult(game));
  const source = oneOf(reqString(input, "source"), ["sim", "fake"] as const, "source");
  if (games.some((game) => game.source !== source)) fail("series mixes sim and fake");
  const teams = input.team_ids;
  if (!Array.isArray(teams) || teams.length !== 2) fail("team_ids");
  const score = input.series_score;
  if (!Array.isArray(score) || score.length !== 2) fail("series_score");
  const result: SeriesResult = {
    contract_version: CAREER_MATCH_VERSION,
    competition_id: reqString(input, "competition_id"),
    season_id: reqString(input, "season_id"),
    series_id: reqString(input, "series_id"),
    stage: oneOf(reqString(input, "stage"), ["regular", "semi", "final"] as const, "stage"),
    format: oneOf(reqString(input, "format"), ["bo1", "bo3", "bo5"] as const, "format"),
    team_ids: [String(teams[0]), String(teams[1])],
    winner_team_id: reqString(input, "winner_team_id"),
    series_score: [Number(score[0]), Number(score[1])],
    games,
    mvp_player_id: reqString(input, "mvp_player_id"),
    duration_s: reqNum(input, "duration_s"),
    source,
  };
  if (input.fixture_id !== undefined) result.fixture_id = reqString(input, "fixture_id");
  if (input.placement_note !== undefined) result.placement_note = String(input.placement_note);
  const target = result.format === "bo1" ? 1 : result.format === "bo3" ? 2 : 3;
  const blueWins = games.filter((game) => game.winner === "blue").length;
  const redWins = games.length - blueWins;
  if (result.series_score[0] !== blueWins || result.series_score[1] !== redWins) fail("series_score");
  const top = Math.max(blueWins, redWins);
  const low = Math.min(blueWins, redWins);
  if (top !== target || low >= target) fail("series did not stop at first to target");
  const winnerId = blueWins > redWins ? result.team_ids[0] : result.team_ids[1];
  if (result.winner_team_id !== winnerId) fail("winner_team_id");
  let duration = 0;
  for (const game of games) duration += game.duration_s;
  if (result.duration_s !== duration) fail("duration_s");
  if (games.some((game) => game.series_id !== result.series_id)) fail("game series_id");
  if (games.some((game) => game.competition_id !== result.competition_id || game.season_id !== result.season_id)) {
    fail("competition_id/season_id");
  }
  return result;
}
