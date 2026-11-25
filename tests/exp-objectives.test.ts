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

  it("points mode feeds the HUD: progress, contest, majority countdown", () => {
    const r = simulate({ ...evenOvrConfig(20261122), objectives: { mode: "points" as const } });
    const st = r.events.filter((e: { type: string }) => e.type === "objective_state") as unknown as Array<{
      points: Array<{ id: string; progress: number; by: string | null; contested: boolean }>;
      majority: { team: string; left_s: number } | null;
    }>;
    expect(st.length).toBeGreaterThan(100);
    expect(st[0]!.points.map((p) => p.id)).toEqual(["north", "centre", "south"]);
    expect(st.some((s) => s.points.some((p) => p.progress > 0 && p.progress < 1 && p.by))).toBe(true);
    expect(st.some((s) => s.points.some((p) => p.contested))).toBe(true);
    const m = st.filter((s) => s.majority).map((s) => s.majority!.left_s);
    expect(m.length).toBeGreaterThan(0);
    expect(Math.max(...m)).toBeLessThanOrEqual(18); // default MAJORITY_TICK_S
    expect(Math.min(...m)).toBeGreaterThan(0);
  });

  it("pulse pit opens 30 s of every 50 s", () => {
    expect(pitOpen(0)).toBe(true);
    expect(pitOpen(29.9)).toBe(true);
    expect(pitOpen(30)).toBe(false);
    expect(pitOpensIn(44)).toBeCloseTo(6);
    expect(pitOpen(50)).toBe(true);
  });
});
