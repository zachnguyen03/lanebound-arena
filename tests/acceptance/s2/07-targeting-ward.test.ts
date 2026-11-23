/**
 * Targeting v1, only the unambiguous ward clause (§9.3 L1131).
 * Exact priority products depend on est_ttk / dps_est (open question) and are not asserted.
 */
import { describe, expect, it } from "vitest";
import { PIT, runAi, type UId } from "./_harness.js";

const BM = "blue:mid" as UId;
const BJ = "blue:jungle" as UId;
const BA = "blue:adc" as UId;
const RM = "red:mid" as UId;
const RJ = "red:jungle" as UId;
const RA = "red:adc" as UId;

describe("Targeting ward (§9.3 L1131) — untargetable / in-sanctuary enemies are not the L1 focus when a legal body exists", () => {
  it("a red unit standing in red sanctuary is not fight_call.focus_id when another red is in the pit", () => {
    const r = runAi({
      T: 2.0,
      units: {
        [BM]: { champ: "huntress", level: 7, x: PIT.x - 0.6, y: PIT.y },
        [BJ]: { champ: "huntress", level: 7, x: PIT.x, y: PIT.y - 0.6 },
        [BA]: { champ: "huntress", level: 7, x: PIT.x + 0.6, y: PIT.y },
        [RM]: { champ: "maelis", level: 7, x: PIT.x, y: PIT.y + 0.6, hp: 50 },
        [RJ]: { champ: "maelis", level: 7, x: PIT.x - 0.6, y: PIT.y + 0.6, hp: 50 },
        [RA]: { champ: "maelis", level: 7, x: 22.6, y: 8 },
      },
    });
    const calls = r.fightCalls("blue").filter((e) => typeof e.focus_id === "string");
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((e) => e.focus_id !== RA)).toBe(true);
  });

  it("a banished red is not fight_call.focus_id when another red is still in the fight (L1131, L444, L1077)", () => {
    const r = runAi({
      T: 3.0,
      units: {
        [BM]: { champ: "huntress", level: 7, x: PIT.x - 0.6, y: PIT.y },
        [BJ]: { champ: "huntress", level: 7, x: PIT.x, y: PIT.y - 0.6 },
        [BA]: { champ: "huntress", level: 7, x: PIT.x + 0.6, y: PIT.y },
        [RM]: { champ: "maelis", level: 7, x: PIT.x, y: PIT.y + 0.6, hp: 50 },
        [RJ]: { champ: "maelis", level: 7, x: PIT.x - 0.6, y: PIT.y + 0.6, hp: 80 },
        [RA]: { champ: "maelis", level: 7, x: PIT.x + 0.6, y: PIT.y + 0.6, hp: 80 },
      },
      cc: [{ tick: 1, target: RA, kind: "banish", duration: 8 }],
    });
    const after = r.fightCalls("blue").filter((e) => (e.t as number) >= 0.3 && typeof e.focus_id === "string");
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((e) => e.focus_id !== RA)).toBe(true);
  });
});
