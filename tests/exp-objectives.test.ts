/**
 * exp/objectives — alternative objective layouts (not build-spec acceptance).
 */
import { describe, expect, it } from "vitest";
import { simulate } from "../sim/index.js";
import { evenOvrConfig } from "../sim/match_config.js";
import { pitOpen, pitOpensIn } from "../sim/objectives.js";

describe("exp objectives", () => {
  it.each(["points", "pulse"] as const)("%s changes the match, scores, and stays deterministic", (mode) => {
    const base = evenOvrConfig(20261122);
    const cfg = { ...base, objectives: { mode } };
    const r = simulate(cfg);
    expect(r.digest).not.toBe(simulate(base).digest);
    expect(simulate(cfg).digest).toBe(r.digest);
    expect(r.events.some((e: { type: string }) => e.type === "point_capture")).toBe(true);
  });

  it("pulse pit opens 30 s of every 50 s", () => {
    expect(pitOpen(0)).toBe(true);
    expect(pitOpen(29.9)).toBe(true);
    expect(pitOpen(30)).toBe(false);
    expect(pitOpensIn(44)).toBeCloseTo(6);
    expect(pitOpen(50)).toBe(true);
  });
});
