import { describe, expect, it } from "vitest";
import { CLUB_PROMISE, clubPromise } from "../apps/career/src/promises";
import { CLUB_SEEDS } from "../packages/career/src/world";

describe("club promise lines", () => {
  it("gives every club a non-empty line", () => {
    expect(CLUB_SEEDS.length).toBe(8);
    expect(Object.keys(CLUB_PROMISE).sort()).toEqual(CLUB_SEEDS.map((club) => club.id).sort());
    for (const club of CLUB_SEEDS) {
      const line = clubPromise(club.id);
      expect(line).toBeTruthy();
      expect(line!.trim().length).toBeGreaterThan(0);
    }
    expect(clubPromise("missing-club")).toBeUndefined();
    expect(CLUB_PROMISE).toEqual({
      "iron-lotus": "Win this year, or close.",
      "juniper-rush": "Build toward a title in three to five seasons.",
      "kestrel-row": "A long climb, first title around season six or seven.",
      "hanok-wolves": "Contend from day one, with Neon Tide in the way.",
      "neon-tide": "A title team, if you can get past the Wolves.",
      "vanta-owls": "Close to the top. Beat Iron Lotus and people listen.",
      "sable-comets": "A steady climb, with Juniper Rush as the yardstick.",
      glasswing: "A long climb. Start by beating Kestrel Row.",
    });
  });
});
