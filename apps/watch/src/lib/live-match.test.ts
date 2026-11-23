import { describe, expect, it } from "vitest";
import { evenOvrConfig, loadMatchConfig } from "@sim/match_config";
import { simulate } from "@sim/simulate";
import {
  cliDigest,
  EVEN_MATCH_NOTE,
  exportConfigJson,
  importConfigJson,
  runWatchMatch,
} from "./live-match";
import { deathDecisionStrip, filterDecisions } from "./decisions";
import { normalizeChampAtlas } from "./champ-atlas";
import type { SimEvent } from "./types";

describe("S4 live match", () => {
  it("refuses a config that omits forced_clock_end", () => {
    expect(() => loadMatchConfig({ seed: 20261122 })).toThrow(/forced_clock_end/);
    expect(() => importConfigJson(JSON.stringify({ seed: 20261122 }))).toThrow(
      /clock-end setting, true or false/,
    );
    expect(() =>
      importConfigJson(JSON.stringify({ seed: 20261122, forced_clock_end: "no" })),
    ).toThrow(/must be true or false/);
  });

  it("exports the Watch note and matches the even preset digest", () => {
    const watch = runWatchMatch(20261122);
    const preset = simulate(evenOvrConfig(20261122, "hold_the_pit"));
    expect(watch.digest).toBe(preset.digest);
    expect(watch.config.notes).toBe(EVEN_MATCH_NOTE);
    const json = exportConfigJson(watch.config);
    expect(json).toContain(EVEN_MATCH_NOTE);
    expect(json).not.toContain("opt-in");
    expect(json).not.toContain("S3-R5");
    const loaded = importConfigJson(json);
    expect(simulate(loaded).digest).toBe(preset.digest);
  }, 120_000);

  it("seed 20261122 evenOvr reaches first_to_10 and matches CLI digest with overlays/debug_pos", () => {
    const cli = cliDigest(20261122);
    const watch = runWatchMatch(20261122);
    const again = cliDigest(20261122);
    expect(watch.digest).toBe(cli);
    expect(again).toBe(cli);
    expect(watch.result.events.some((e) => e.type === "pos")).toBe(true);
    const end = watch.result.events.find((e) => e.type === "match_end");
    expect(end?.reason).toBe("first_to_10");
    expect(watch.config.ai_enabled).toBe(true);
    expect(watch.config.forced_clock_end).toBe(false);
  }, 120_000);

  it("seed 20261123 digest is stable and independent of debug_pos", () => {
    const cli = cliDigest(20261123);
    const watch = runWatchMatch(20261123);
    expect(watch.digest).toBe(cli);
    expect(watch.digest).not.toBe(cliDigest(20261122));
  }, 120_000);

  it("export then import replays a byte-identical digest", () => {
    const { config, digest } = runWatchMatch(20261122);
    const json = exportConfigJson(config);
    const loaded = importConfigJson(json);
    const replay = simulate(loaded);
    expect(replay.digest).toBe(digest);
  }, 120_000);
});

describe("decision strip", () => {
  const events: SimEvent[] = [
    { t: 9.2, tick: 92, seq: 0, type: "intent", unit_id: "blue:mid", intent: "Engage" },
    { t: 9.5, tick: 95, seq: 1, type: "intent", unit_id: "red:adc", intent: "Chase", target_id: "blue:mid" },
    { t: 10, tick: 100, seq: 2, type: "peel_start", unit_id: "blue:top", target_id: "red:adc" },
    { t: 10, tick: 100, seq: 3, type: "death", unit_id: "blue:mid", killer_id: "red:adc", t_ok: 1 },
    { t: 12, tick: 120, seq: 4, type: "intent", unit_id: "red:adc", intent: "Idle" },
  ];

  it("keeps the last 5 s of killer and victim", () => {
    const death = events[3]!;
    const strip = deathDecisionStrip(events, death);
    expect(strip.killer.map((e) => e.seq)).toEqual([1]);
    expect(strip.victim.map((e) => e.seq)).toEqual([0]);
    expect(strip.killerId).toBe("red:adc");
    const filtered = filterDecisions(
      [...strip.killer, { t: 9.6, tick: 96, seq: 9, type: "intent", unit_id: "blue:top" }],
      "red:adc",
    );
    expect(filtered.every((e) => String(e.unit_id).includes("red:adc"))).toBe(true);
  });
});

describe("atlas key shapes", () => {
  it("normalises nested blue.right and flat blue-right", () => {
    const clip = { n: 1, ms: 100, fps: 10, loop: true, frames: [] };
    const nested = normalizeChampAtlas(
      {
        slug: "huntress",
        cell: [18, 24],
        anchor: [9, 23],
        sheet: "a.png",
        sheet_2x: "a@2x.png",
        scale: 2,
        animations: { idle: { blue: { right: clip } } },
      },
      "huntress",
    );
    const flat = normalizeChampAtlas(
      {
        slug: "maelis",
        cell: [18, 24],
        anchor: [9, 23],
        sheet: "b.png",
        sheet_2x: "b@2x.png",
        scale: 2,
        animations: { idle: { "blue-right": clip } },
      },
      "maelis",
    );
    expect(nested.animations.idle?.["blue-right"]).toBeTruthy();
    expect(flat.animations.idle?.["blue-right"]).toBeTruthy();
  });
});
