import { describe, expect, it } from "vitest";
import { validateSeriesResult } from "@lanebound/match-contract";
import { playSeries } from "./runner.js";
import { openingWorld, selectStarters } from "./world.js";

function startersOf() {
  const world = openingWorld();
  return {
    world,
    starters: new Map(world.clubs.map((club) => [club.id, selectStarters(world.players, club.id)])),
  };
}

describe("C3 series flow", () => {
  it("writes a SeriesResult from fake maps and keeps one runner", () => {
    const { world, starters } = startersOf();
    const series = playSeries({
      careerSeed: 20261123,
      world,
      starters,
      humanClubId: "juniper-rush",
      fixture: {
        id: "md1-proof",
        competition_id: "bound_circuit",
        season_id: "s1",
        stage: "regular",
        format: "bo3",
        matchday: 1,
        ordinal: 0,
        team_ids: ["juniper-rush", "vanta-owls"],
      },
    });
    expect(series.contract_version).toBe("career-match/1");
    expect(series.source).toBe("fake");
    expect(series.games.length).toBeGreaterThanOrEqual(2);
    expect(series.games.every((game) => game.source === "fake" && game.series_id === series.series_id)).toBe(true);
    expect(series.team_ids).toContain(series.winner_team_id);
    expect(series.mvp_player_id.length).toBeGreaterThan(0);
    expect(() => validateSeriesResult(series)).not.toThrow();
  });

  it("refuses a series that mixes sim and fake", () => {
    const { world, starters } = startersOf();
    const series = playSeries({
      careerSeed: 1,
      world,
      starters,
      humanClubId: "iron-lotus",
      fixture: {
        id: "mix",
        competition_id: "bound_circuit",
        season_id: "s1",
        stage: "regular",
        format: "bo3",
        matchday: 1,
        ordinal: 1,
        team_ids: ["iron-lotus", "kestrel-row"],
      },
    });
    const mixed = {
      ...series,
      games: series.games.map((game, index) => (index === 0 ? { ...game, source: "sim", digest: "simdigest" } : game)),
    };
    expect(() => validateSeriesResult(mixed)).toThrow(/mixes sim and fake/);
  });

  it("resets fearless at game 3 of a Bo5", () => {
    const { world, starters } = startersOf();
    const series = playSeries({
      careerSeed: 20261123,
      world,
      starters,
      humanClubId: "juniper-rush",
      fixture: {
        id: "semi-proof",
        competition_id: "bound_circuit",
        season_id: "s1",
        stage: "semi",
        format: "bo5",
        matchday: 8,
        ordinal: 28,
        team_ids: ["juniper-rush", "vanta-owls"],
      },
    });
    expect(series.games.length).toBeGreaterThanOrEqual(3);
    const [game1, game2, game3] = series.games;
    const blue = (ids: string[]) => ids.slice(0, 5);
    const red = (ids: string[]) => ids.slice(5);
    expect(blue(game1!.champ_ids).some((id) => blue(game2!.champ_ids).includes(id))).toBe(false);
    expect(red(game1!.champ_ids).some((id) => red(game2!.champ_ids).includes(id))).toBe(false);
    expect(game3!.champ_ids).toEqual(game1!.champ_ids);
  });
});
