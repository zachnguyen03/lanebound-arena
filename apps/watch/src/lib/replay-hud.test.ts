import { describe, expect, it } from "vitest";
import { simulate } from "@sim/index";
import { evenOvrConfig } from "@sim/match_config";
import { SANDBOX_CONSTANTS } from "@sim/cadence";
import { summarizeMatch } from "../../../lab/lib/summary";
import { ReplayEngine } from "./replay";
import type { SimEvent } from "./types";

describe("top HUD replay feed (points mode)", () => {
  const base = evenOvrConfig(20261122);
  const res = simulate({ ...base, objectives: { mode: "points" }, constants: { ...base.constants, ...SANDBOX_CONSTANTS } });
  const eng = new ReplayEngine(res.events as unknown as SimEvent[]);
  const end = eng.stateAt(eng.maxTick);

  it("splits each team's score into kills + objectives", () => {
    expect(end.split.blue.kills + end.split.blue.obj).toBe(end.scoreBlue);
    expect(end.split.red.kills + end.split.red.obj).toBe(end.scoreRed);
    expect(end.split.blue.obj + end.split.red.obj).toBeGreaterThan(0);
  });

  it("knows tactics, target and majority countdown", () => {
    expect(end.tactics.blue?.preset).toBeTruthy();
    expect(end.scoreToWin).toBe(SANDBOX_CONSTANTS.SCORE_TO_WIN);
    let seen = false;
    for (let t = 0; t <= eng.maxTick && !seen; t += 20) seen = eng.stateAt(t).majority !== null;
    expect(seen).toBe(true);
  });

  it("rail K/D/A matches the lab summary", () => {
    const sum = summarizeMatch(base.seed, res);
    const ids = ["blue:top", "blue:jungle", "blue:mid", "blue:adc", "blue:support", "red:top", "red:jungle", "red:mid", "red:adc", "red:support"] as const;
    const got = ids.map((id) => end.units[id].kda);
    expect(got.map((x) => [x.k, x.d, x.a])).toEqual(sum.kda.map((x: { k: number; d: number; a: number }) => [x.k, x.d, x.a]));
  });
});
