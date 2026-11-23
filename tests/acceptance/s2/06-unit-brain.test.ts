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

  it("L140: a Lock-disabled unit skips the Unit Brain — no new Cast / Peel / Engage / Chase intent while stunned", () => {
    const r = runAi({
      T: 3.0,
      units: {
        [MID]: { champ: "kerrig", level: 7, x: 12, y: 4, auto: true },
        [FOE]: { champ: "maelis", level: 7, x: 13, y: 4, auto: false },
      },
      cc: [{ tick: 1, target: MID, kind: "stun", duration: 2.5 }],
    });
    expect(r.of("status_apply", (e) => e.target_id === MID && e.kind === "stun").length).toBeGreaterThan(0);
    const during = r.of(
      "intent",
      (e) =>
        e.unit_id === MID &&
        (e.t as number) >= 0.2 &&
        (e.t as number) <= 2.5 &&
        (e.intent === "Cast" || e.intent === "Peel" || e.intent === "Engage" || e.intent === "Chase"),
    );
    expect(during).toHaveLength(0);
    const castsDuring = r.of("cast_start", (e) => e.unit_id === MID && (e.t as number) >= 0.2 && (e.t as number) <= 2.5);
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
    expect(walk.length + (left ? 1 : 0)).toBeGreaterThan(0);
    expect(left).toBe(true);
  });
});
