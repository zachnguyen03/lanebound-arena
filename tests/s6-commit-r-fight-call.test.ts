/**
 * commit_r on fight_call — field path fight_call.commit_r (boolean).
 * Spec §9.4.1.4 rule 6 / R7-5: engage ∧ A_commit ≥ engage_threshold+0.10 ∧ ≥3 enemies.
 */
import { describe, expect, it } from "vitest";
import { evenOvrConfig, simulate } from "../sim/index.js";

describe("fight_call.commit_r (R7-5 observability)", () => {
  it("emits boolean commit_r on every fight_call; true only under engage+threshold+≥3 enemies", () => {
    const r = simulate(evenOvrConfig(20261122, "hold_the_pit"));
    const calls = r.events.filter((e) => e.type === "fight_call");
    expect(calls.length).toBeGreaterThan(0);
    for (const e of calls) {
      expect(typeof e.commit_r).toBe("boolean");
      if (e.commit_r === true) {
        expect(e.commit).toBe("engage");
        expect(Number(e.a_commit)).toBeGreaterThanOrEqual(0.42); // lowest engage th across tactics
      }
    }
    // Same seed → identical commit_r stream (determinism).
    const r2 = simulate(evenOvrConfig(20261122, "hold_the_pit"));
    const c1 = calls.map((e) => [e.t, e.team, e.commit_r]);
    const c2 = r2.events
      .filter((e) => e.type === "fight_call")
      .map((e) => [e.t, e.team, e.commit_r]);
    expect(c2).toEqual(c1);
  });
});
