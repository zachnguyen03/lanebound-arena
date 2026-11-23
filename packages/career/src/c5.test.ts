import { describe, expect, it } from "vitest";
import { advanceSeason, chooseSignature, playNextMap, setLoadout, skipSeries } from "./play.js";
import { seasonPointTotal } from "./points.js";
import { startCareer } from "./session.js";

describe("C5 play and skip", () => {
  it("plays a Bo3, locks the loadout, and keeps game 2 fearless", () => {
    let session = startCareer("juniper-rush");
    session = setLoadout(session, ["clear-speed", "spoils-of-war", "first-claim"]);
    session = playNextMap(session);
    expect(session.open_games[0]!.source).toBe("fake");
    expect(() => setLoadout(session, ["called-shot", "spoils-of-war", "first-claim"])).toThrow(/locked/);
    session = playNextMap(session);
    const games = session.open_games.length > 0 ? session.open_games : session.series[0]!.games;
    const blue = (ids: string[]) => ids.slice(0, 5);
    expect(blue(games[0]!.champ_ids).some((id) => blue(games[1]!.champ_ids).includes(id))).toBe(false);
    if (session.series.length === 0) session = skipSeries(session);
    expect(session.series[0]!.source).toBe("fake");
    expect(session.series[0]!.games.every((game) => game.cards.length > 0)).toBe(true);
    expect(session.open_games).toHaveLength(0);
  });

  it("rejects a loadout over 6 points or with two Signatures", () => {
    const session = startCareer("juniper-rush");
    expect(() => setLoadout(session, ["bounty-hunter", "closing-argument", "contest-fury"])).toThrow(/loadout/);
    expect(() => setLoadout(session, ["pillar-of-the-split", "finals-poise", "clear-speed"])).toThrow(/loadout/);
  });

  it("skips the year, keeps a 73-point ranking, and ticks contracts once", () => {
    let session = startCareer("juniper-rush");
    for (let guard = 0; guard < 40; guard++) {
      try {
        session = skipSeries(session);
      } catch {
        break;
      }
    }
    expect(session.series.filter((item) => item.stage === "regular")).toHaveLength(28);
    expect(session.series.filter((item) => item.stage === "final")).toHaveLength(1);
    expect(session.club_state.reduce((sum, club) => sum + club.points, 0)).toBe(seasonPointTotal());
    expect(session.awards.map((award) => award.kind)).toEqual(["split_mvp", "deadeye", "shepherd", "zonekeeper", "finals_mvp"]);
    const before = session.contracts.map((contract) => contract.years_left);
    while (session.pending_signature) session = chooseSignature(session, "keep");
    session = advanceSeason(session);
    expect(session.contracts.some((contract, index) => contract.years_left !== before[index])).toBe(true);
    expect(session.contracts.reduce((sum, contract) => sum + contract.years_left, 0)).toBeLessThan(before.reduce((sum, years) => sum + years, 0));
    expect(session.club_state.reduce((sum, club) => sum + club.points, 0)).toBe(seasonPointTotal());
  });
});
