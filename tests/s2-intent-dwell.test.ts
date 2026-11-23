/**
 * §9.2 L1115 — do not trickle back in within 1 s (Retreat ↔ HoldZone).
 * Decision-point dwell / hysteresis; not intent-emit dedupe.
 */
import { describe, expect, it } from "vitest";
import { defaultEvenConfig, simulate } from "../sim/index.js";

/** Trickle-back: Retreat → HoldZone inside 1 s (§9.2 L1115). HoldZone → Retreat is a legal disengage follow. */
function retreatToHoldZoneTrickles(events: Array<Record<string, unknown>>): number {
  const byUnit = new Map<string, Array<{ t: number; intent: string }>>();
  for (const e of events) {
    if (e.type !== "intent") continue;
    const id = String(e.unit_id);
    if (!byUnit.has(id)) byUnit.set(id, []);
    byUnit.get(id)!.push({ t: e.t as number, intent: String(e.intent) });
  }
  let n = 0;
  for (const arr of byUnit.values()) {
    for (let i = 1; i < arr.length; i++) {
      const a = arr[i - 1]!;
      const b = arr[i]!;
      if (a.intent === "Retreat" && b.intent === "HoldZone" && b.t - a.t < 1.0 - 1e-9) n += 1;
    }
  }
  return n;
}

describe("§9.2 intent dwell — no Retreat→HoldZone trickle within 1 s", () => {
  for (const seed of [20261122, 20261123]) {
    it(`seed ${seed}: zero Retreat→HoldZone flips inside 1 s`, () => {
      const r = simulate({ ...defaultEvenConfig(seed), ai_enabled: true });
      expect(retreatToHoldZoneTrickles(r.events as Array<Record<string, unknown>>)).toBe(0);
    });
  }
});
