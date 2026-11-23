import { describe, expect, it } from "vitest";
import { parseSession, sessionJson, startCareer } from "./session.js";

describe("career session save", () => {
  it("starts Juniper Rush with an eight-club table and seven Bo3 matchdays", () => {
    const session = startCareer("juniper-rush");
    expect(session.player_club_id).toBe("juniper-rush");
    expect(session.clubs).toHaveLength(8);
    expect(session.standings.map((row) => row.finish).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(session.fixtures.map((fixture) => fixture.matchday)).size).toBe(7);
    expect(session.fixtures.every((fixture) => fixture.format === "bo3")).toBe(true);
    expect(session.playoff).toEqual([]);
    const loaded = parseSession(JSON.parse(sessionJson(session)));
    expect(loaded.player_club_id).toBe("juniper-rush");
    expect(loaded.standings).toEqual(session.standings);
  });

  it("rejects a save that is not the career session", () => {
    expect(() => parseSession({ save_format: 2 })).toThrow(/career save rejected/);
    expect(() => parseSession("nope")).toThrow(/career save rejected/);
    const session = startCareer("glasswing");
    const body = JSON.parse(sessionJson(session)) as { series: unknown[] };
    body.series = [{ source: "sim" }];
    expect(() => parseSession(body)).toThrow();
  });
});
