import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sha256Hex, validateMatchResult } from "@lanebound/match-contract";
import type { ContractPlayer, MatchConfig, SeriesContext } from "@lanebound/match-contract";
import { generateFakeMatch } from "./fake.js";
import { sideBase, tacticEdge, teamStrength, winProbabilityBlue } from "./strength.js";
import { OPENING_WORLD_SHA256, openingWorld, selectStarters, STANDIN_LABEL } from "./world.js";
import dump from "../data/opening-world-20261123.json";

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

  it("loads the frozen paper opening world and pins its SHA-256", () => {
    const file = new URL("../data/opening-world-20261123.json", import.meta.url);
    const bytes = readFileSync(file, "utf8");
    expect(bytes.endsWith("\n")).toBe(false);
    expect(sha256Hex(bytes)).toBe(OPENING_WORLD_SHA256);
    expect(OPENING_WORLD_SHA256).toBe("19b3fbe89aa605b8d131d8112e2790b82d5faae3e4fb395be22fcdffae7b0088");
    const world = openingWorld();
    expect(world.non_shippable_standin).toBe(true);
    expect(world.label).toBe(STANDIN_LABEL);
    expect(world.standin_seed).toBe(20261123);
    expect(world.players).toHaveLength(80);
    const first = world.players[0]!;
    expect(first).toMatchObject({
      id: "standin-1",
      name: "P1736",
      club_id: "iron-lotus",
      primary_slot: "top",
      age: 28,
      ovr: 76,
      potential: 77,
      shippable: false,
    });
    expect(first.mastery).toEqual({ brannoch: 80, rhedan: 60 });
    expect(world.contracts[0]).toMatchObject({ player_id: "standin-1", opening_years: 4, years_left: 4, wage: 138 });
    const wages = world.contracts.map((contract) => contract.wage);
    expect(Math.min(...wages)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...wages)).toBeLessThanOrEqual(400);
    expect(world.players.every((player) => player.id === `standin-${dump.find((row) => row.name === player.name)!.pid}`)).toBe(true);
    expect(world.players.some((player) => player.id.includes("-top-") || player.name === "P0001")).toBe(false);
    const paperMeans = [77.4, 70.8, 69.0, 67.8, 65.4, 63.8, 61.8, 57.2];
    for (const club of world.clubs) {
      const roster = world.players.filter((player) => player.club_id === club.id);
      expect(roster).toHaveLength(10);
      expect(club.following_floor).toBeCloseTo(0.55 * club.following, 10);
      expect(club.cash).toBe([1000, 900, 850, 800, 760, 720, 680, 640][club.opening_index]);
      expect(club.facility).toBe(club.opening_index <= 1 ? 1 : 0);
      const bySlot = new Map<string, typeof roster>();
      for (const player of roster) {
        const list = bySlot.get(player.primary_slot) ?? [];
        list.push(player);
        bySlot.set(player.primary_slot, list);
      }
      let mean = 0;
      for (const slot of ["top", "jungle", "mid", "adc", "support"]) {
        const cands = bySlot.get(slot)!;
        expect(cands).toHaveLength(2);
        const best = [...cands].sort((a, b) => b.ovr - a.ovr || a.age - b.age || Number(b.id.slice(8)) - Number(a.id.slice(8)))[0]!;
        mean += best.ovr;
      }
      expect(mean / 5).toBe(paperMeans[club.opening_index]);
    }
    expect(world.clubs.find((club) => club.id === "juniper-rush")?.recommended_first_save).toBe(true);
    expect(world.clubs[0]?.following).toBe(72);
    const again = openingWorld();
    expect(JSON.stringify(world)).toBe(JSON.stringify(again));
    expect(selectStarters(world.players, "iron-lotus")).toHaveLength(5);
  });
});
