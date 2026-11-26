import { describe, expect, it } from "vitest";
import {
  formatDeathRow,
  formatKillFeedRow,
  formatTakedownScoreRow,
  scorelines,
  shortUnitId,
} from "./kill-feed-format";
import type { SimEvent } from "./types";

function ev(partial: Partial<SimEvent> & { type: string }): SimEvent {
  return {
    t: 1,
    tick: 10,
    seq: 1,
    ...partial,
  };
}

describe("kill-feed-format", () => {
  it("fills both sides of the scoreline from the running scores", () => {
    const evs = [
      ev({ seq: 1, type: "takedown_score", team: "red", score_after: 1 }),
      ev({ seq: 2, type: "zone_tick", team: "blue", point: "majority", score_after: 1 }),
      ev({ seq: 3, type: "takedown_score", team: "red", score_after: 2 }),
    ];
    const lines = scorelines(evs);
    expect(formatKillFeedRow(evs[1]!, false, lines.get(2))).toBe("BLUE majority +1 · 1–1");
    expect(formatKillFeedRow(evs[2]!, false, lines.get(3))).toBe("RED scores · 1–2");
  });

  it("shortUnitId maps unit ids, not bare team ids", () => {
    expect(shortUnitId("blue:adc")).toBe("B ADC");
    expect(shortUnitId("red:support")).toBe("R SUPPORT");
    expect(shortUnitId("blue")).toBe("B ?");
  });

  it("formats death with killer, victim, assists", () => {
    expect(
      formatDeathRow(
        ev({
          type: "death",
          unit_id: "red:adc",
          killer_id: "blue:mid",
          assists: ["blue:support", "blue:jungle"],
        }),
      ),
    ).toBe("B MID → R ADC (+B SUPPORT, B JUNGLE)");
  });

  it("formats takedown_score as team name + new scoreline", () => {
    expect(
      formatTakedownScoreRow(
        ev({
          type: "takedown_score",
          team: "blue",
          score_after: 1,
          score_blue: 1,
          score_red: 0,
        }),
      ),
    ).toBe("BLUE scores · 1–0");

    expect(
      formatTakedownScoreRow(
        ev({
          type: "takedown_score",
          team: "red",
          score_after: 2,
          score_blue: 1,
          score_red: 2,
        }),
      ),
    ).toBe("RED scores · 1–2");
  });

  it("formatKillFeedRow dispatches and never shortId-s a team", () => {
    expect(
      formatKillFeedRow(
        ev({
          type: "takedown_score",
          team: "blue",
          score_after: 1,
          score_blue: 1,
          score_red: 0,
        }),
      ),
    ).toBe("BLUE scores · 1–0");
    expect(
      formatKillFeedRow(
        ev({
          type: "takedown_score",
          team: "blue",
          score_after: 1,
          score_blue: 1,
          score_red: 0,
        }),
      ),
    ).not.toContain("B ?");
  });

  it("labels shutdowns and sweeps with the scoreline", () => {
    const evs = [
      ev({ seq: 1, type: "takedown_score", team: "blue", score_after: 1 }),
      ev({ seq: 2, type: "shutdown", team: "blue", killer_id: "blue:mid", victim_id: "red:adc", streak: 3, score_after: 2 }),
      ev({ seq: 3, type: "sweep", team: "red", score_after: 1 }),
    ];
    const lines = scorelines(evs);
    expect(formatKillFeedRow(evs[1]!, false, lines.get(2))).toBe("BLUE SHUTDOWN B MID ends R ADC's 3 streak +1 · 2–0");
    expect(formatKillFeedRow(evs[2]!, false, lines.get(3))).toBe("RED SWEEP all 3 points +1 · 2–1");
  });
});
