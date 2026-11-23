import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { digestEvents } from "@sim/canonical";
import type { SimEvent as CoreSimEvent } from "@sim/types";
import { parseJsonl } from "./parse-log";
import { ReplayEngine } from "./replay";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const samplePath = path.join(
  root,
  "apps/watch/public/samples/seed-20261122.jsonl",
);
const GOLD =
  "7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f";

describe("Watch determinism guard", () => {
  it("loading and replaying a log leaves its digest unchanged", () => {
    const raw = fs.readFileSync(samplePath, "utf8");
    const events = parseJsonl(raw);
    const before = digestEvents(events as CoreSimEvent[]);
    expect(before).toBe(GOLD);

    const engine = new ReplayEngine(events);
    // Drive a full scrub — pure derivation, must not mutate events.
    for (const t of [0, 1, 122, 600, 1200, 2400]) {
      const s = engine.stateAt(t);
      expect(s.tick).toBe(Math.min(t, engine.maxTick));
    }
    // Mutate a clone of derived state only — source log untouched.
    const mid = engine.stateAt(122);
    mid.scoreBlue = 99;
    mid.units["blue:top"]!.hp = 1;

    const after = digestEvents(engine.events as CoreSimEvent[]);
    expect(after).toBe(before);
    expect(engine.verifyDigestUnchanged().ok).toBe(true);

    // Re-parse original text still matches.
    const again = digestEvents(parseJsonl(raw) as CoreSimEvent[]);
    expect(again).toBe(GOLD);
  });

  it("never imports simulate into the replay path (static)", () => {
    const src = fs.readFileSync(
      path.join(root, "apps/watch/src/lib/replay.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/from\s+["'][^"']*simulate[^"']*["']/);
    expect(src).not.toMatch(/\bsimulate\s*\(/);
  });

  it("places dummy units at tile-centre spawn + jitter and levels from log", () => {
    const events = parseJsonl(fs.readFileSync(samplePath, "utf8"));
    const engine = new ReplayEngine(events);
    const t0 = engine.stateAt(0);
    // GD: tile index (1,7) → centre (1.5, 7.5); top slotOrd 0 → yOff = -0.6
    expect(t0.units["blue:top"]!.x).toBe(1.5);
    expect(t0.units["blue:top"]!.y).toBeCloseTo(7.5 + (0 - 2) * 0.3, 5);
    expect(t0.units["red:mid"]!.x).toBe(22.5);
    expect(t0.units["red:mid"]!.y).toBeCloseTo(7.5, 5);
    expect(t0.units["blue:top"]!.level).toBe(1);
    expect(t0.units["blue:top"]!.fallback).toBe(false);
    expect(t0.units["blue:mid"]!.facing).toBe("right");
    expect(t0.units["red:mid"]!.facing).toBe("left");
    expect(t0.fallbackChamps).not.toContain("dummy");
    expect(t0.fallbackChamps).toEqual([]);

    const t122 = engine.stateAt(122);
    expect(t122.units["blue:top"]!.level).toBe(2);
  });
});


