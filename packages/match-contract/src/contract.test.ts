import { describe, expect, it } from "vitest";
import { generateFakeMatch, playSeries } from "@lanebound/career";
import { openingWorld, selectStarters } from "@lanebound/career";
import {
  FAKE_CONSTANTS_HASH,
  assertAcceptableSimReplay,
  canonicalString,
  fakeDigest,
  sha256Hex,
  validateMatchResult,
  validateSeriesContext,
  validateSeriesResult,
} from "@lanebound/match-contract";
import type { MatchConfig, SeriesContext } from "@lanebound/match-contract";

function sample(): { context: SeriesContext; config: MatchConfig } {
  const world = openingWorld();
  const blueClub = world.clubs[0]!;
  const redClub = world.clubs[1]!;
  const blue = selectStarters(world.players, blueClub.id);
  const red = selectStarters(world.players, redClub.id);
  const picks = (side: typeof blue) => side.map((player) => Object.keys(player.mastery).sort()[0]!);
  const loadout = (side: typeof blue) =>
    [0, 1, 2].map((i) => ({ id: `NONSHIPPABLE-card-${i + 1}`, holder_id: side[i]!.id }));
  const context: SeriesContext = {
    contract_version: "career-match/1",
    competition_id: "bound_circuit",
    season_id: "s1",
    series_id: "series-sample",
    fixture_id: "fx-sample",
    stage: "regular",
    format: "bo3",
    game_index: 1,
    series_score: [0, 0],
    team_ids: [blueClub.id, redClub.id],
    used_picks: [[], []],
    source: "fake",
  };
  const config: MatchConfig = {
    seed: 20261122,
    constants: {},
    draft_mode: "fixed",
    notes: "non-shippable fake",
    blue: {
      players: blue,
      picks: picks(blue),
      tactics: { primary: "hold", aggression: 0, combo_style: "auto" },
      card_loadout: loadout(blue),
      club_id: blueClub.id,
    },
    red: {
      players: red,
      picks: picks(red),
      tactics: { primary: "hunt", aggression: 0, combo_style: "auto" },
      card_loadout: loadout(red),
      club_id: redClub.id,
    },
  };
  return { context, config };
}

describe("career-match/1", () => {
  it("rejects a fake: digest as a sim replay", () => {
    expect(() => assertAcceptableSimReplay("fake:abcd")).toThrow(/sim replay/);
    expect(() => assertAcceptableSimReplay("deadbeef")).not.toThrow();
  });

  it("fake constants_hash is the canonical stand-in object", () => {
    const expected = sha256Hex(
      canonicalString({ contract_version: "career-match/1", source: "fake" }),
    );
    expect(FAKE_CONSTANTS_HASH).toBe(expected);
    expect(canonicalString({ source: "fake", contract_version: "career-match/1" })).toBe(
      '{"contract_version":"career-match/1","source":"fake"}',
    );
  });

  it("missing claim_denies is 0", () => {
    const { context, config } = sample();
    const result = generateFakeMatch(context, config);
    const raw = structuredClone(result) as typeof result;
    for (const player of raw.players) player.claim_denies = 0;
    raw.digest = fakeDigest(raw);
    for (const player of raw.players) delete player.claim_denies;
    const parsed = validateMatchResult(raw);
    expect(parsed.players.every((player) => player.claim_denies === 0)).toBe(true);
  });

  it("a sim result cannot carry a fake digest", () => {
    const { context, config } = sample();
    const result = generateFakeMatch(context, config);
    const raw = structuredClone(result);
    raw.source = "sim";
    expect(() => validateMatchResult(raw)).toThrow(/sim replay/);
  });

  it("rejects a series that mixes sim and fake sources", () => {
    const world = openingWorld();
    const starters = new Map(world.clubs.map((club) => [club.id, selectStarters(world.players, club.id)]));
    const series = playSeries({
      careerSeed: 20261123,
      world,
      starters,
      humanClubId: "juniper-rush",
      fixture: {
        id: "mix-source",
        competition_id: "bound_circuit",
        season_id: "s1",
        stage: "regular",
        format: "bo3",
        matchday: 1,
        ordinal: 0,
        team_ids: ["juniper-rush", "vanta-owls"],
      },
    });
    const mixed = {
      ...series,
      games: series.games.map((game, index) => (index === 0 ? { ...game, source: "sim" as const, digest: "simdigest" } : game)),
    };
    expect(() => validateSeriesResult(mixed)).toThrow(/series mixes sim and fake/);
  });

  it("validates a series context", () => {
    const { context } = sample();
    expect(validateSeriesContext(context).source).toBe("fake");
    expect(() => validateSeriesContext({ ...context, contract_version: "career-match/2" })).toThrow();
  });
});
