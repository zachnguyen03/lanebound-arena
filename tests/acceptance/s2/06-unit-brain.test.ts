/**
 * L2 Unit Brain rules that do not need zone or orbs (§9.4 L1135–1145, G3 L1884, §9.6 L1164).
 */
import { describe, expect, it } from "vitest";
import { inBlueSanctuary, pathOf, runAi, type UId } from "./_harness.js";

const MID = "blue:mid" as UId;
const FOE = "red:mid" as UId;

describe("Unit Brain gates (L140, L1135–1145, G3 L1884, §9.6 L1164)", () => {
  it("G3 L1884: tick 0 produces no AI fight_call, peel_start, or intent (setup only)", () => {
    const r = runAi({
      T: 0.3,
      units: {
        [MID]: { champ: "kerrig", level: 7, x: 12, y: 4, auto: true },
        [FOE]: { champ: "maelis", level: 7, x: 13, y: 4, auto: true },
      },
    });
    const aiAt0 = r.events.filter(
      (e) => e.tick === 0 && (e.type === "fight_call" || e.type === "peel_start" || e.type === "intent"),
    );
    expect(aiAt0).toHaveLength(0);
  });

  it("L140: a Lock-disabled unit skips the Unit Brain — no new Cast / Peel / Engage / Chase / Approach intent while stunned", () => {
    // Start out of range and Idle, then walk the foe in during the stun so a
    // brain that still picks a target would have to emit a new Approach/Engage
    // (intent-on-change). A unit that engaged before the stun and merely held
    // that intent would not be a new event.
    const r = runAi({
      T: 3.5,
      pos: true,
      units: {
        [MID]: { champ: "kerrig", level: 7, x: 8, y: 4, auto: true },
        [FOE]: { champ: "maelis", level: 7, x: 16, y: 4, auto: false },
      },
      cc: [{ tick: 1, target: MID, kind: "stun", duration: 3.0 }],
      motor: { [FOE]: { to: [[8.8, 4]], arrive_r: 0.2, hold_at_end: true } },
    });
    expect(r.of("status_apply", (e) => e.target_id === MID && e.kind === "stun").length).toBeGreaterThan(0);
    const stun = r.of("status_apply", (e) => e.target_id === MID && e.kind === "stun")[0]!;
    const t0 = stun.t as number;
    const during = r.of(
      "intent",
      (e) =>
        e.unit_id === MID &&
        (e.t as number) >= t0 - 1e-9 &&
        (e.t as number) < t0 + 3.0 - 1e-9 &&
        (e.intent === "Cast" || e.intent === "Peel" || e.intent === "Engage" || e.intent === "Chase" || e.intent === "Approach"),
    );
    expect(during).toHaveLength(0);
    const castsDuring = r.of("cast_start", (e) => e.unit_id === MID && (e.t as number) >= t0 - 1e-9 && (e.t as number) < t0 + 3.0 - 1e-9);
    expect(castsDuring).toHaveLength(0);
  });

  it("§9.6 L1164: after respawn, the unit leaves its own sanctuary within 1.5 s (WalkFromPad)", () => {
    const r = runAi({
      T: 20.0,
      pos: true,
      units: {
        [MID]: { champ: "kerrig", level: 7, x: 12, y: 4, hp: 1, auto: false },
        [FOE]: { champ: "maelis", level: 7, x: 13, y: 4, auto: false },
      },
      damage: [{ tick: 2, source: FOE, target: MID, raw: 50_000 }],
    });
    const death = r.of("death", (e) => e.unit_id === MID);
    expect(death.length).toBeGreaterThan(0);
    const respawn = r.of("respawn", (e) => e.unit_id === MID);
    expect(respawn.length).toBeGreaterThan(0);
    const tR = respawn[0]!.t as number;
    const walk = r.of("intent", (e) => e.unit_id === MID && (e.t as number) >= tR && e.intent === "WalkFromPad");
    const path = pathOf(r.events, MID).filter((p) => p.t >= tR && p.t <= tR + 1.5 + 1e-9);
    const left = path.some((p) => !inBlueSanctuary(p.x));
    // Both the named intent and the leave-sanctuary move are required. An Idle
    // (or other) intent that still walks out, or a WalkFromPad that stays put,
    // is a miss on §9.6 L1166.
    expect(walk.length).toBeGreaterThan(0);
    expect(left).toBe(true);
  });
});
