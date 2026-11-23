import { describe, expect, it } from "vitest";
import { finalFixture, matchdayPlayOrder, regularSeasonFixtures, seedRankMap, semiFixtures } from "./calendar.js";
import { AI_PRESETS, aiPreset, tacticsFor } from "./lineup.js";
import { simulateCircuit } from "./runner.js";
import { assignFinish, computeStandings, mapDifferential, rankClubs, type StandingSeries } from "./standings.js";
import { tacticEdge } from "./strength.js";
import { CLUB_SEEDS } from "./world.js";

const CLUBS = CLUB_SEEDS.map((club) => ({ club_id: club.id, opening_index: club.opening_index }));

function series(winner: string, loser: string, winMaps: number, loseMaps: number): StandingSeries {
  return {
    stage: "regular",
    team_ids: [winner, loser],
    series_score: [winMaps, loseMaps],
    winner_team_id: winner,
  };
}

describe("C1 calendar, standings, playoffs", () => {
  it("assigns AI tactics by opening index and leaves the human default on Hold", () => {
    expect([...AI_PRESETS]).toEqual(["hold", "hunt", "starve", "hold", "hunt", "starve", "hold", "hunt"]);
    expect(CLUB_SEEDS.map((club) => aiPreset(club.opening_index))).toEqual(["hold", "hunt", "starve", "hold", "hunt", "starve", "hold", "hunt"]);
    const club = (id: string) => CLUB_SEEDS.find((row) => row.id === id)!;
    const ilo = club("iron-lotus");
    const kst = club("kestrel-row");
    const ntd = club("neon-tide");
    const sbc = club("sable-comets");
    const jnr = club("juniper-rush");
    const vno = club("vanta-owls");
    expect(tacticsFor(ilo, "nobody").primary).toBe("hold");
    expect(tacticsFor(kst, "nobody").primary).toBe("hunt");
    expect(tacticEdge("hold", "hunt")).toBe(2);
    expect(tacticsFor(ntd, "nobody").primary).toBe("starve");
    expect(tacticsFor(sbc, "nobody").primary).toBe("starve");
    expect(tacticEdge("starve", "starve")).toBe(0);
    expect(tacticsFor(jnr, jnr.id).primary).toBe("hold");
    expect(tacticsFor(vno, jnr.id).primary).toBe("hold");
    expect(tacticEdge("hold", "hold")).toBe(0);
    expect(tacticsFor(jnr, jnr.id, "hunt").primary).toBe("hunt");
    expect(tacticEdge("hunt", "hold")).toBe(-2);
    expect(tacticsFor(ilo, "nobody")).toEqual({ primary: "hold", aggression: 0, combo_style: "auto" });
  });

  it("matches the published circle and plays every pair once", () => {
    const fixtures = regularSeasonFixtures();
    expect(fixtures).toHaveLength(28);
    const tag = (id: string) => CLUB_SEEDS.find((club) => club.id === id)!.tag;
    const day = (n: number) =>
      fixtures.filter((fixture) => fixture.matchday === n).map((fixture) => `${tag(fixture.team_ids[0])}-${tag(fixture.team_ids[1])}`);
    expect(day(1)).toEqual(["ILO-KST", "HKW-GLW", "NTD-SBC", "VNO-JNR"]);
    expect(day(2)).toEqual(["GLW-ILO", "KST-SBC", "HKW-JNR", "NTD-VNO"]);
    expect(day(3)).toEqual(["ILO-SBC", "GLW-JNR", "KST-VNO", "HKW-NTD"]);
    expect(day(4)).toEqual(["JNR-ILO", "SBC-VNO", "GLW-NTD", "KST-HKW"]);
    expect(day(5)).toEqual(["ILO-VNO", "JNR-NTD", "SBC-HKW", "GLW-KST"]);
    expect(day(6)).toEqual(["NTD-ILO", "VNO-HKW", "JNR-KST", "SBC-GLW"]);
    expect(day(7)).toEqual(["ILO-HKW", "NTD-KST", "VNO-GLW", "JNR-SBC"]);
    const pairs = new Set(fixtures.map((fixture) => [...fixture.team_ids].sort().join("|")));
    expect(pairs.size).toBe(28);
    const blueCount = new Map<number, number>();
    for (const fixture of fixtures) {
      const index = CLUB_SEEDS.find((club) => club.id === fixture.team_ids[0])!.opening_index;
      blueCount.set(index, (blueCount.get(index) ?? 0) + 1);
    }
    for (let i = 0; i < 8; i++) expect(blueCount.get(i)).toBe(i % 2 === 0 ? 4 : 3);
  });

  it("plays the player's series first and leaves the other fixtures in list order", () => {
    const day = regularSeasonFixtures().filter((fixture) => fixture.matchday === 1);
    const player = day[2]!.team_ids[1];
    const ordered = matchdayPlayOrder(day, player);
    expect(ordered[0]).toBe(day[2]);
    expect(ordered.slice(1).map((fixture) => fixture.id)).toEqual([day[0]!.id, day[1]!.id, day[3]!.id]);
    expect(matchdayPlayOrder(day, "missing-club").map((fixture) => fixture.id)).toEqual(day.map((fixture) => fixture.id));
  });

  it("ranks a better map differential above more maps won", () => {
    const neon = "neon-tide";
    const sable = "sable-comets";
    const tape: StandingSeries[] = [];
    let foil = 0;
    const nextFoil = () => `foil-${foil++}`;
    const add = (winner: string, loser: string, winMaps: number, loseMaps: number) => {
      tape.push(series(winner, loser, winMaps, loseMaps));
    };
    add(neon, nextFoil(), 2, 0);
    add(neon, nextFoil(), 2, 0);
    add(nextFoil(), neon, 2, 1);
    add(nextFoil(), neon, 2, 1);
    add(nextFoil(), neon, 2, 1);
    add(nextFoil(), neon, 2, 0);
    add(nextFoil(), neon, 2, 0);
    add(sable, nextFoil(), 2, 0);
    add(sable, nextFoil(), 2, 0);
    add(nextFoil(), sable, 2, 1);
    add(nextFoil(), sable, 2, 1);
    add(nextFoil(), sable, 2, 1);
    add(nextFoil(), sable, 2, 1);
    add(nextFoil(), sable, 2, 0);
    add(nextFoil(), sable, 2, 0);
    const clubs = [
      { club_id: neon, opening_index: 2 },
      { club_id: sable, opening_index: 5 },
      ...Array.from({ length: foil }, (_, i) => ({ club_id: `foil-${i}`, opening_index: 100 + i })),
    ];
    const rows = computeStandings(clubs, tape);
    expect(rows.find((row) => row.club_id === neon)).toMatchObject({ series_wins: 2, map_diff: -3, maps_won: 7 });
    expect(rows.find((row) => row.club_id === sable)).toMatchObject({ series_wins: 2, map_diff: -4, maps_won: 8 });
    const order = rankClubs(rows, tape);
    expect(order.indexOf(neon)).toBeLessThan(order.indexOf(sable));
  });

  it("tie-breaks series wins, map diff, maps won, head-to-head, then lower opening index, never OVR", () => {
    const [a, b, c, d] = CLUBS;
    const four = [a!, b!, c!, d!];
    const split: StandingSeries[] = [
      series(a!.club_id, b!.club_id, 2, 0),
      series(c!.club_id, d!.club_id, 2, 1),
    ];
    expect(mapDifferential(2, 0)).toBe(2);
    expect(rankClubs(computeStandings(four, split), split)).toEqual([
      a!.club_id,
      c!.club_id,
      d!.club_id,
      b!.club_id,
    ]);

    const tape: StandingSeries[] = [
      series(a!.club_id, b!.club_id, 2, 0),
      series(c!.club_id, a!.club_id, 2, 1),
      series(d!.club_id, "glasswing", 2, 1),
    ];
    const moreMaps = computeStandings(CLUBS, tape);
    const aRow = moreMaps.find((row) => row.club_id === a!.club_id)!;
    const dRow = moreMaps.find((row) => row.club_id === d!.club_id)!;
    expect(aRow.series_wins).toBe(dRow.series_wins);
    expect(aRow.map_diff).toBe(dRow.map_diff);
    expect(aRow.maps_won).toBeGreaterThan(dRow.maps_won);
    expect(rankClubs(moreMaps, tape).indexOf(a!.club_id)).toBeLessThan(rankClubs(moreMaps, tape).indexOf(d!.club_id));

    const cycle: StandingSeries[] = [
      series(a!.club_id, b!.club_id, 2, 1),
      series(b!.club_id, c!.club_id, 2, 1),
      series(c!.club_id, a!.club_id, 2, 1),
    ];
    const tied = computeStandings([a!, b!, c!], cycle);
    expect(rankClubs(tied, cycle)).toEqual([a!.club_id, b!.club_id, c!.club_id]);

    const h2hTape: StandingSeries[] = [
      series(a!.club_id, b!.club_id, 2, 1),
      series(a!.club_id, c!.club_id, 2, 1),
      series(a!.club_id, "glasswing", 1, 2),
      series(b!.club_id, "glasswing", 2, 1),
      series(b!.club_id, "kestrel-row", 2, 1),
      series(c!.club_id, "kestrel-row", 2, 1),
      series(c!.club_id, "sable-comets", 2, 1),
    ];
    const h2hRows = computeStandings(CLUBS, h2hTape);
    const top = rankClubs(h2hRows, h2hTape);
    expect(top[0]).toBe(a!.club_id);
    expect(top.indexOf(b!.club_id)).toBeLessThan(top.indexOf(c!.club_id));
    expect(top.join()).not.toContain("ovr");
  });

  it("freezes 1v4 and 2v3, then the final of those winners, higher seed blue", () => {
    const seeds = CLUBS.map((club) => club.club_id);
    const top4 = seeds.slice(0, 4) as [string, string, string, string];
    const semis = semiFixtures(top4);
    expect(semis[0].team_ids).toEqual([seeds[0], seeds[3]]);
    expect(semis[1].team_ids).toEqual([seeds[1], seeds[2]]);
    expect(semis[0].format).toBe("bo5");
    expect(semis[0].matchday).toBe(8);
    const rank = seedRankMap(seeds);
    const final = finalFixture(seeds[3]!, seeds[1]!, rank);
    expect(final.team_ids).toEqual([seeds[1], seeds[3]]);
    expect(final.matchday).toBe(9);
    expect(final.format).toBe("bo5");
    const finished = assignFinish(
      CLUBS.map((club) => ({
        ...club,
        series_wins: 0,
        series_losses: 0,
        maps_won: 0,
        maps_lost: 0,
        map_diff: 0,
      })),
      seeds,
    );
    expect(finished.find((row) => row.club_id === seeds[0])!.finish).toBe(1);
    expect(finished.find((row) => row.club_id === seeds[7])!.finish).toBe(8);
  });

  it("runs a full fake circuit twice with the same series winners", () => {
    const first = simulateCircuit({ careerSeed: 20261123, playerClubId: "juniper-rush" });
    const second = simulateCircuit({ careerSeed: 20261123, playerClubId: "juniper-rush" });
    expect(first.series).toHaveLength(31);
    expect(first.series.filter((item) => item.stage === "regular")).toHaveLength(28);
    expect(first.series.filter((item) => item.stage === "semi")).toHaveLength(2);
    expect(first.series.filter((item) => item.stage === "final")).toHaveLength(1);
    expect(first.frozen_seeds).toHaveLength(8);
    expect(new Set(first.frozen_seeds).size).toBe(8);
    const regularPairs = new Set(
      first.series
        .filter((item) => item.stage === "regular")
        .map((item) => [...item.team_ids].sort().join("|")),
    );
    expect(regularPairs.size).toBe(28);
    for (const item of first.series) {
      expect(item.competition_id).toBe("bound_circuit");
      expect(item.season_id).toBe("s1");
      expect(item.source).toBe("fake");
      const target = item.format === "bo3" ? 2 : 3;
      expect(Math.max(...item.series_score)).toBe(target);
      expect(Math.min(...item.series_score)).toBeLessThan(target);
    }
    const day1 = first.series.filter((item) => item.fixture_id?.startsWith("md1-"));
    expect(day1[0]!.team_ids).toContain("juniper-rush");
    const semis = first.series.filter((item) => item.stage === "semi");
    const juniperSemi = semis.findIndex((item) => item.team_ids.includes("juniper-rush"));
    if (juniperSemi >= 0) expect(juniperSemi).toBe(0);
    expect(JSON.stringify(first.series.map((item) => item.winner_team_id))).toBe(
      JSON.stringify(second.series.map((item) => item.winner_team_id)),
    );
    expect(first.frozen_seeds).toEqual(second.frozen_seeds);
    const final = first.series.find((item) => item.stage === "final")!;
    const rank = new Map(first.frozen_seeds.map((id, index) => [id, index]));
    const blueRank = rank.get(final.team_ids[0])!;
    const redRank = rank.get(final.team_ids[1])!;
    expect(blueRank).toBeLessThan(redRank);
  });
});
