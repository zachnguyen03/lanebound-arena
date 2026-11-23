import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "@lanebound/match-contract";
import type { SeriesResult } from "@lanebound/match-contract";
import { deadeyeWinner, keepSignature, splitMvpWinner, zonekeeperScore, zonekeeperWinner } from "./awards.js";
import { tickContract } from "./contracts.js";
import { fromDisplay, glickoDisplay, glickoUpdate, initialGlicko } from "./glicko.js";
import { seasonPointTotal } from "./points.js";
import { loadSave, runSeason, saveJson } from "./season.js";
import { openingWorld } from "./world.js";

function maps(playerId: string, count: number, stats: { rating?: number; dmg?: number; peels?: number; zone?: number; denies?: number; z?: number }): SeriesResult[] {
  const out: SeriesResult[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      stage: "regular",
      series_id: `${playerId}-s${i}`,
      games: [
        {
          players: [
            {
              player_id: playerId,
              rating: stats.rating ?? 6,
              z: stats.z ?? 0,
              dmg: stats.dmg ?? 0,
              peels: stats.peels ?? 0,
              zone_seconds: stats.zone ?? 0,
              claim_denies: stats.denies ?? 0,
            },
          ],
        },
      ],
    } as unknown as SeriesResult);
  }
  return out;
}

describe("C2 glicko, points, awards, contracts", () => {
  it("matches Glickman's published worked example", () => {
    const player = fromDisplay(1500, 200, 0.06);
    const opponents = [
      { ...fromDisplay(1400, 30, 0.06), score: 1 as const },
      { ...fromDisplay(1550, 100, 0.06), score: 0 as const },
      { ...fromDisplay(1700, 300, 0.06), score: 0 as const },
    ];
    const next = glickoUpdate(player, opponents, 0.5);
    const shown = glickoDisplay(next);
    expect(shown.r).toBeCloseTo(1464.06, 1);
    expect(shown.rd).toBeCloseTo(151.52, 1);
    expect(next.sigma).toBeCloseTo(0.05999, 4);
    expect(glickoDisplay(initialGlicko()).r).toBeCloseTo(1500, 8);
    expect(glickoDisplay(initialGlicko()).rd).toBeCloseTo(350, 6);
    expect(() => glickoUpdate(initialGlicko(), [])).toThrow(/unchanged/);
  });

  it("requires four series and breaks ties toward the lower player id", () => {
    expect(zonekeeperScore(10, 2)).toBe(50);
    const tape = [
      ...maps("hot", 3, { dmg: 99999, rating: 10, peels: 99, zone: 999, denies: 99 }),
      ...maps("steady", 4, { dmg: 10, rating: 6, peels: 1, zone: 1, denies: 0 }),
      ...maps("m-b", 4, { rating: 8, z: 0.2, dmg: 5 }),
      ...maps("m-a", 4, { rating: 8, z: 0.2, dmg: 5 }),
    ];
    expect(deadeyeWinner(tape)?.player_id).toBe("steady");
    expect(splitMvpWinner(tape)?.player_id).toBe("m-a");
    const zone = [
      ...maps("z-b", 4, { zone: 100, denies: 1, rating: 9 }),
      ...maps("z-a", 4, { zone: 80, denies: 2, rating: 6 }),
    ];
    expect(zonekeeperScore(80, 2)).toBe(zonekeeperScore(100, 1));
    expect(zonekeeperWinner(zone)?.player_id).toBe("z-a");
    expect(keepSignature([], "pillar-of-the-split")).toEqual(["pillar-of-the-split"]);
    expect(keepSignature(["pillar-of-the-split"], "convergence-crown")).toEqual(["convergence-crown"]);
  });

  it("ticks contracts down and renews a zero at the stored wage", () => {
    expect(tickContract({ player_id: "a", opening_years: 3, years_left: 3, wage: 41000, auto_renewed: false })).toEqual({
      player_id: "a",
      opening_years: 3,
      years_left: 2,
      wage: 41000,
      auto_renewed: false,
    });
    expect(tickContract({ player_id: "b", opening_years: 1, years_left: 1, wage: 42000, auto_renewed: false })).toEqual({
      player_id: "b",
      opening_years: 1,
      years_left: 1,
      wage: 42000,
      auto_renewed: true,
    });
  });

  it("writes one deterministic season save with the ranking invariants", () => {
    const save = runSeason({ careerSeed: 20261123, playerClubId: "juniper-rush" });
    expect(saveJson(save)).toBe(saveJson(runSeason({ careerSeed: 20261123, playerClubId: "juniper-rush" })));
    expect(save.club_state.reduce((sum, club) => sum + club.points, 0)).toBe(seasonPointTotal());
    expect(seasonPointTotal()).toBe(73);
    const pairs = new Set(
      save.series.filter((item) => item.stage === "regular").map((item) => [...item.team_ids].sort().join("|")),
    );
    expect(pairs.size).toBe(28);
    expect(save.frozen_seeds).toEqual(save.standings.slice().sort((a, b) => a.finish - b.finish).map((row) => row.club_id));
    const byClub = new Map(save.club_state.map((club) => [club.club_id, club]));
    let previous = new Map(save.clubs.map((club) => [club.id, initialGlicko()]));
    const seen = new Set<string>();
    for (const row of save.ranking_log) {
      const key = row.series_id;
      if (!seen.has(key)) {
        const series = save.series.find((item) => item.series_id === key)!;
        for (const club of save.clubs) {
          const before = previous.get(club.id)!;
          const played = series.team_ids.includes(club.id);
          const snap = save.ranking_log.find((item) => item.series_id === key && item.club_id === club.id)!;
          if (!played) {
            expect(snap.mu).toBe(before.mu);
            expect(snap.phi).toBe(before.phi);
            expect(snap.sigma).toBe(before.sigma);
          }
        }
        seen.add(key);
        previous = new Map(
          save.clubs.map((club) => {
            const snap = save.ranking_log.find((item) => item.series_id === key && item.club_id === club.id)!;
            return [club.id, { mu: snap.mu, phi: snap.phi, sigma: snap.sigma }];
          }),
        );
      }
      expect(row.competition_id).toBe("bound_circuit");
      expect(row.season_id).toBe("s1");
    }
    for (const club of save.club_state) {
      const shown = glickoDisplay(club);
      expect(club.r).toBe(shown.r);
      expect(club.rd).toBe(shown.rd);
      expect(byClub.get(club.club_id)).toBe(club);
    }
    for (const award of save.awards) {
      if (award.kind === "finals_mvp") continue;
      const played = new Set(
        save.series
          .filter((item) => item.stage === "regular")
          .filter((item) => item.games.some((game) => game.players.some((player) => player.player_id === award.player_id)))
          .map((item) => item.series_id),
      );
      expect(played.size).toBeGreaterThanOrEqual(4);
    }
    expect(save.awards.map((award) => award.kind)).toEqual([
      "split_mvp",
      "deadeye",
      "shepherd",
      "zonekeeper",
      "finals_mvp",
    ]);
    const json = saveJson(save);
    expect(json.includes("crown-of-the-split")).toBe(false);
    expect(json.includes("Crown of the Split")).toBe(false);
    const crowns = save.signature_grants.filter((grant) => grant.signature === "convergence-crown");
    expect(crowns).toHaveLength(5);
    expect(save.signature_grants.some((grant) => grant.signature === "pillar-of-the-split")).toBe(true);
    expect(save.signature_grants.some((grant) => grant.signature === "finals-poise")).toBe(true);
    for (const player of save.players) {
      expect(player.signature_archive.length).toBeLessThanOrEqual(1);
      expect(player.shippable).toBe(false);
      expect(player.name).toMatch(/^P\d{4}$/);
    }
    const renewed = save.contracts.filter((contract) => contract.auto_renewed);
    expect(renewed.length).toBeGreaterThan(0);
    for (const contract of renewed) expect(contract.years_left).toBe(1);
    const wages = new Map(openingWorld().contracts.map((contract) => [contract.player_id, contract.wage]));
    for (const contract of save.contracts) expect(contract.wage).toBe(wages.get(contract.player_id));
    const reloaded = loadSave(json + "");
    expect(reloaded.save_format).toBe(1);
    expect(() => loadSave(JSON.stringify({ ...JSON.parse(json), extra: true, save_format: 1, contract_version: "career-match/1" }))).not.toThrow();
    expect(sha256Hex(json)).toBe(sha256Hex(saveJson(runSeason({ careerSeed: 20261123, playerClubId: "juniper-rush" }))));
  });

  it("is byte-identical across two processes", () => {
    const tsx = "node_modules/.bin/tsx";
    const run = () => {
      const result = spawnSync(tsx, ["apps/lab/career-season.ts", "--seed", "20261123", "--club", "juniper-rush"], {
        encoding: "utf8",
      });
      expect(result.status).toBe(0);
      return result.stdout;
    };
    const a = run();
    const b = run();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(1000);
    expect(sha256Hex(a)).toBe(sha256Hex(saveJson(runSeason({ careerSeed: 20261123, playerClubId: "juniper-rush" }))));
  });
});
