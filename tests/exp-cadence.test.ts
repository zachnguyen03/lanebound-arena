/**
 * exp/orb-buff-cadence — experiment rules (not build-spec acceptance).
 */
import { describe, expect, it } from "vitest";
import { simulate } from "../sim/index.js";
import { evenOvrConfig } from "../sim/match_config.js";
import { CADENCE_EXPERIMENT } from "../sim/cadence.js";

type Ev = Record<string, any>;
const run = (tactic: "hold_the_pit" | "starve" = "hold_the_pit", seed = 20261122) =>
  simulate({ ...evenOvrConfig(seed, tactic), ...CADENCE_EXPERIMENT });

describe("exp cadence", () => {
  it("is off by default: no cadence events", () => {
    const ev = simulate(evenOvrConfig(20261122)).events as Ev[];
    expect(ev.some((e) => e.type === "buff_soon" || e.type === "buff_share")).toBe(false);
  });

  it("is deterministic", () => {
    expect(run().digest).toBe(run().digest);
  });

  it("warns 10 s before every buff spawn", () => {
    const ev = run("starve").events as Ev[];
    const spawns = ev.filter((e) => e.type === "buff_spawn");
    expect(spawns.length).toBeGreaterThan(0);
    for (const s of spawns) {
      const soon = ev.find((e) => e.type === "buff_soon" && e.buff_id === s.buff_id && Math.abs(e.spawn_at - s.t) < 1e-6);
      expect(soon, `${s.buff_id}@${s.t}`).toBeDefined();
      expect(s.t - soon!.t).toBeCloseTo(10, 6);
    }
  });

  it("respawns orbs on 20 s wave boundaries", () => {
    const ev = run("starve").events as Ev[];
    const respawns = ev.filter((e) => e.type === "orb_spawn" && e.t > 8 + 1e-6);
    expect(respawns.length).toBeGreaterThan(0);
    for (const e of respawns) expect(Math.abs(e.t / 20 - Math.round(e.t / 20))).toBeLessThan(1e-6);
  });

  it("shares the buff only with same-team allies", () => {
    const ev = run("starve").events as Ev[];
    const shares = ev.filter((e) => e.type === "buff_share");
    for (const s of shares) {
      const team = s.source_id.split(":")[0];
      for (const id of s.unit_ids) expect(id.split(":")[0]).toBe(team);
    }
  });

  it("rovers use the TakeBuff intent", () => {
    const ev = run().events as Ev[];
    expect(ev.some((e) => e.type === "intent" && e.intent === "TakeBuff")).toBe(true);
  });
});
