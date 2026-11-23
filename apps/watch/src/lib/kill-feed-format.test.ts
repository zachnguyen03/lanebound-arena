import { describe, expect, it } from "vitest";
import {
  formatDeathRow,
  formatKillFeedRow,
  formatTakedownScoreRow,
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
});
