/**
 * DEFERRED until S3 — zone, orbs, buffs, and claims are S3 systems (sandbox §2, plan §8.4 S3).
 * These tests are skipped so the S2 suite does not fake those systems. Un-skip when S3 is green.
 * Assertions are already written against the public event log (§4.4).
 *
 * See DEFERRED.md.
 */
import { describe, expect, it } from "vitest";
import { defaultEvenConfig, simulate } from "../../../sim/index.js";
import type { MatchConfig } from "../../../sim/index.js";

const N = 200;

function evenGame(seed: number, preset: "hold_the_pit" | "hunt" | "starve"): ReturnType<typeof simulate> {
  const cfg: MatchConfig = defaultEvenConfig(seed);
  cfg.blue = { ...cfg.blue, tactics: { ...cfg.blue.tactics, preset } };
  cfg.red = { ...cfg.red, tactics: { ...cfg.red.tactics, preset } };
  // Full clock: mean zone-time / orb counts are a 4:00 even-OVR sample (M2-23 L1736).
  return simulate(cfg);
}

function zoneOwnedTime(events: { type: string; t: number; team?: unknown }[], team: "blue"): number {
  // Observable proxy: sum of exclusive-owned intervals is not directly evented.
  // zone_tick fires after 12 s of owned exclusive time (L270–274). More ticks ⇒ more zone-time.
  return events.filter((e) => e.type === "zone_tick" && e.team === team).length;
}

function orbPickups(events: { type: string; unit_id?: unknown }[], team: "blue" | "red"): number {
  return events.filter((e) => e.type === "orb_pickup" && String(e.unit_id).startsWith(team)).length;
}

describe.skip("DEFERRED until S3 — tactics vs zone-time and orbs (M2-23 L1736, plan §8.4, sandbox §11 S2)", () => {
  it("200 even-OVR games: Hold the Pit > Hunt > Starve on mean zone-tick count (zone-time)", () => {
    const mean = (preset: "hold_the_pit" | "hunt" | "starve") => {
      let s = 0;
      for (let i = 0; i < N; i++) s += zoneOwnedTime(evenGame(20261122 + i, preset).events, "blue");
      return s / N;
    };
    const hold = mean("hold_the_pit");
    const hunt = mean("hunt");
    const starve = mean("starve");
    expect(hold).toBeGreaterThan(hunt);
    expect(hunt).toBeGreaterThan(starve);
  }, 600_000);

  it("200 even-OVR games: Starve > Hunt > Hold the Pit on mean orb pickups", () => {
    const mean = (preset: "hold_the_pit" | "hunt" | "starve") => {
      let s = 0;
      for (let i = 0; i < N; i++) s += orbPickups(evenGame(20261122 + i, preset).events, "blue");
      return s / N;
    };
    const hold = mean("hold_the_pit");
    const hunt = mean("hunt");
    const starve = mean("starve");
    expect(starve).toBeGreaterThan(hunt);
    expect(hunt).toBeGreaterThan(hold);
  }, 600_000);
});

describe.skip("DEFERRED until S3 — planner jobs that need the zone / orb / buff systems (§9.2 L1107–1117)", () => {
  it("Hold the Pit: at least two units occupy or walk to the zone when it is capturable or owned (L1107)", () => {
    expect.fail("un-skip when S3 zone occupation is live");
  });

  it("Starve: a body contests the zone just enough to pause the enemy tick timer, then walks out (L1111)", () => {
    expect.fail("un-skip when S3 zone tick pause is live");
  });

  it("Buff assignment: two up buffs are walked by two different units (L1115)", () => {
    expect.fail("un-skip when S3 buff spawns are live");
  });
});

describe.skip("DEFERRED until M6 — 2,000-game even-OVR auto-peel lab (L1735)", () => {
  it("auto-peel ≥ 70% of perceived, reachable dives over 2,000 even games; denominator recorded", () => {
    expect.fail("un-skip in M6; M2 ships the 400-game constructed preview in 03-auto-peel.test.ts");
  });
});
