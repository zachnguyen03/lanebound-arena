import { describe, expect, it } from "vitest";
import { validateMatchResult } from "@lanebound/match-contract";
import type { ContractPlayer, MatchConfig, SeriesContext } from "@lanebound/match-contract";
import { generateFakeMatch } from "./fake.js";
import { sideBase, tacticEdge, teamStrength, winProbabilityBlue } from "./strength.js";
import { openingWorld, selectStarters, STANDIN_LABEL } from "./world.js";

function pair(seed: number, bluePreset: "hold" | "hunt" | "starve" = "hold", redPreset: "hold" | "hunt" | "starve" = "hold") {
  const world = openingWorld();
  const blueClub = world.clubs[4]!;
  const redClub = world.clubs[7]!;
  const blue = selectStarters(world.players, blueClub.id);
  const red = selectStarters(world.players, redClub.id);
  const picksFor = (side: ContractPlayer[]) => side.map((player) => Object.keys(player.mastery).sort()[0]!);
  const cards = (side: ContractPlayer[]) =>
    [0, 1, 2].map((i) => ({ id: `NONSHIPPABLE-card-${i + 1}`, holder_id: side[i]!.id }));
  const context: SeriesContext = {
    contract_version: "career-match/1",
    competition_id: "bound_circuit",
    season_id: "s1",
    series_id: "series-c0",
    stage: "regular",
    format: "bo3",
    game_index: 1,
    series_score: [0, 0],
    team_ids: [blueClub.id, redClub.id],
    used_picks: [[], []],
    source: "fake",
  };
  const config: MatchConfig = {
    seed,
    constants: {},
    draft_mode: "fixed",
    blue: {
      players: blue,
      picks: picksFor(blue),
      tactics: { primary: bluePreset, aggression: 0, combo_style: "auto" },
      card_loadout: cards(blue),
      club_id: blueClub.id,
    },
    red: {
      players: red,
      picks: picksFor(red),
      tactics: { primary: redPreset, aggression: 0, combo_style: "auto" },
      card_loadout: cards(red),
      club_id: redClub.id,
    },
  };
  return { context, config, blue, red };
}

describe("C0 fake runner and stand-in world", () => {
  it("is deterministic, and seed+1 differs", () => {
    const a = pair(20261122);
    const b = pair(20261122);
    const c = pair(20261123);
    const ra = generateFakeMatch(a.context, a.config);
    const rb = generateFakeMatch(b.context, b.config);
    const rc = generateFakeMatch(c.context, c.config);
    expect(JSON.stringify(ra)).toBe(JSON.stringify(rb));
    expect(ra.digest).not.toBe(rc.digest);
    expect(ra.digest.startsWith("fake:")).toBe(true);
    expect(validateMatchResult(ra).digest).toBe(ra.digest);
  });

  it("keeps score parts, deaths, and claim denies consistent", () => {
    const { context, config } = pair(7);
    const result = generateFakeMatch(context, config);
    for (const [score, parts] of [
      [result.score_blue, result.score_parts[0]],
      [result.score_red, result.score_parts[1]],
    ] as const) {
      expect(parts.kills + parts.ticks + parts.claims).toBe(score);
      expect(parts.kills).toBeGreaterThanOrEqual(0);
    }
    expect(result.score_blue).not.toBe(result.score_red);
    const sum = (side: "blue" | "red", key: "k" | "d" | "claim_denies") =>
      result.players.filter((player) => player.side === side).reduce((acc, player) => acc + (player[key] ?? 0), 0);
    expect(sum("blue", "k")).toBe(result.score_parts[0].kills);
    expect(sum("red", "k")).toBe(result.score_parts[1].kills);
    expect(sum("blue", "d")).toBe(result.score_parts[1].kills);
    expect(sum("red", "d")).toBe(result.score_parts[0].kills);
    expect(sum("blue", "claim_denies") + sum("red", "claim_denies")).toBe(result.claim_denied);
    if (result.reason === "first_to_10") expect(result.duration_s).toBeLessThan(240);
    if (result.reason === "clock") expect(result.duration_s).toBe(240);
    if (result.reason === "sudden_death") {
      expect(result.duration_s).toBeGreaterThan(240);
      expect(result.duration_s).toBeLessThanOrEqual(270);
    }
  });

  it("applies the C-R-3 strength formula and no +1.2 human edge", () => {
    expect(tacticEdge("hold", "hunt")).toBe(2);
    expect(tacticEdge("hunt", "starve")).toBe(2);
    expect(tacticEdge("starve", "hold")).toBe(2);
    expect(tacticEdge("hunt", "hold")).toBe(-2);
    expect(tacticEdge("starve", "hunt")).toBe(-2);
    expect(tacticEdge("hold", "starve")).toBe(-2);
    expect(tacticEdge("hold", "hold")).toBe(0);
    const { config } = pair(1, "hold", "hunt");
    const baseBlue = sideBase(config.blue.players, config.blue.picks);
    const baseRed = sideBase(config.red.players, config.red.picks);
    const blue = teamStrength({
      players: config.blue.players,
      picks: config.blue.picks,
      preset: "hold",
      opponentPreset: "hunt",
      side: "blue",
    });
    const red = teamStrength({
      players: config.red.players,
      picks: config.red.picks,
      preset: "hunt",
      opponentPreset: "hold",
      side: "red",
    });
    expect(blue).toBe(baseBlue + 2);
    expect(red).toBe(baseRed);
    expect(blue).not.toBe(baseBlue + 2 + 1.2);
    expect(winProbabilityBlue(blue, red)).toBeCloseTo(1 / (1 + Math.exp(-0.1 * (blue - red))), 12);
    expect(winProbabilityBlue(50, 50)).toBeCloseTo(0.5, 12);
  });

  it("marks the seed-20261123 stand-in as non-shippable and hits OVR targets", () => {
    const world = openingWorld();
    expect(world.non_shippable_standin).toBe(true);
    expect(world.label).toBe(STANDIN_LABEL);
    expect(world.standin_seed).toBe(20261123);
    expect(world.players).toHaveLength(80);
    expect(world.players.every((player) => player.shippable === false && /^P\d{4}$/.test(player.name))).toBe(true);
    expect(world.players.every((player) => player.id.startsWith("standin-"))).toBe(true);
    for (const club of world.clubs) {
      const roster = world.players.filter((player) => player.club_id === club.id);
      expect(roster).toHaveLength(10);
      for (const slot of ["top", "jungle", "mid", "adc", "support"] as const) {
        expect(roster.filter((player) => player.primary_slot === slot)).toHaveLength(2);
      }
      const starters = selectStarters(world.players, club.id);
      const mean = starters.reduce((sum, player) => sum + player.ovr, 0) / 5;
      expect(mean).toBe(club.starter_ovr_target);
    }
    expect(world.clubs.find((club) => club.id === "juniper-rush")?.recommended_first_save).toBe(true);
    const again = openingWorld();
    expect(JSON.stringify(world)).toBe(JSON.stringify(again));
  });
});
