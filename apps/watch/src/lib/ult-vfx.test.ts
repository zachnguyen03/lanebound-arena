import { describe, expect, it } from "vitest";
import { ReplayEngine } from "./replay";
import type { SimEvent } from "./types";
import { facing8, stripFrameAt, type StripFrame } from "./ult-vfx";

const ev = (p: Partial<SimEvent> & { type: string; tick: number; seq: number }): SimEvent => ({
  t: p.tick / 10,
  ...p,
});

const lineup = ev({
  type: "match_start",
  tick: 0,
  seq: 0,
  blue_lineup: ["brannoch", "sedge", "kerrig", "huntress", "ysol"],
  red_lineup: ["rhedan", "tolle", "helvar", "maelis", "saelo"],
});

// Template strip: 5 wind-up × 80 ms, impact 60 · 100(hit) · 80, linger 100.
const frames: StripFrame[] = [
  ...[0, 1, 2, 3, 4].map((i) => ({ i, rect: [0, 0, 1, 1] as [number, number, number, number], ms: 80, phase: "windup" })),
  { i: 5, rect: [0, 0, 1, 1], ms: 60, phase: "impact" },
  { i: 6, rect: [0, 0, 1, 1], ms: 100, phase: "impact", hit: true },
  { i: 7, rect: [0, 0, 1, 1], ms: 80, phase: "impact" },
  { i: 8, rect: [0, 0, 1, 1], ms: 100, phase: "linger" },
];

describe("ult strip clock", () => {
  it("loops the wind-up, lands the hit frame on hitT, then ends", () => {
    expect(stripFrameAt(frames, 1, 1.4, 1.0)?.i).toBe(0);
    expect(stripFrameAt(frames, 1, 1.4, 1.33)?.i).toBe(4); // 330 ms → 5th cell
    expect(stripFrameAt(frames, 1, 1.4, 1.345)?.i).toBe(5); // f1 hold-off, 60 ms early
    expect(stripFrameAt(frames, 1, 1.4, 1.4)?.i).toBe(6); // hit frame at hitT
    expect(stripFrameAt(frames, 1, 1.4, 1.8)).toBeNull();
    expect(stripFrameAt(frames, 1, 2.4, 1.5)?.phase).toBe("windup"); // long delay keeps looping
  });

  it("picks 8-way facings and mirrors the west side", () => {
    expect(facing8(1, 0)).toEqual({ dir: "e", flip: false });
    expect(facing8(-1, 0)).toEqual({ dir: "e", flip: true });
    expect(facing8(0, 1)).toEqual({ dir: "s", flip: false });
    expect(facing8(-1, -1.375)).toEqual({ dir: "ne", flip: true }); // 44×32 tiles: square on screen
  });
});

describe("ult replay instances", () => {
  it("opens on R cast_start, resolves hit on cast_end, closes on cancel", () => {
    const events = [
      lineup,
      ev({ type: "cast_start", tick: 10, seq: 1, unit_id: "red:support", skill_id: "Still Hour", cast_time: 0.7, x: 9, y: 6 }),
      ev({ type: "cast_end", tick: 17, seq: 2, unit_id: "red:support", skill_id: "Still Hour" }),
      ev({ type: "cast_start", tick: 20, seq: 3, unit_id: "blue:top", skill_id: "Stonefast", cast_time: 0.4 }),
      ev({ type: "cast_cancel", tick: 22, seq: 4, unit_id: "blue:top" }),
      ev({ type: "xp_gain", tick: 60, seq: 5, unit_id: "blue:mid", amount: 1 }),
    ];
    const ults = new ReplayEngine(events).stateAt(60).effects.ults;
    const saelo = ults.find((u) => u.champ === "saelo")!;
    expect(saelo).toMatchObject({ anchorX: 9, anchorY: 6, hitT: 1.7 });
    const bran = ults.find((u) => u.champ === "brannoch")!;
    expect(bran.hitT).toBeNull();
    expect(bran.endsAt).toBeCloseTo(2.2, 9);
  });

  it("delayed ults take the land time; kill bursts flag multi-kills", () => {
    const events = [
      lineup,
      ev({ type: "cast_start", tick: 10, seq: 1, unit_id: "red:jungle", skill_id: "Upwelling", cast_time: 0.4, x: 12, y: 8 }),
      ev({ type: "cast_end", tick: 14, seq: 2, unit_id: "red:jungle", skill_id: "Upwelling" }),
      ev({ type: "projectile_spawn", tick: 14, seq: 3, unit_id: "red:jungle", skill_id: "Upwelling", x: 11, y: 7, land_t: 2.2 }),
      ev({ type: "death", tick: 30, seq: 4, unit_id: "blue:mid", killer_id: "red:mid" }),
      ev({ type: "death", tick: 50, seq: 5, unit_id: "blue:adc", killer_id: "red:mid" }),
      ev({ type: "xp_gain", tick: 60, seq: 6, unit_id: "red:mid", amount: 1 }),
    ];
    const s = new ReplayEngine(events).stateAt(60);
    expect(s.effects.ults[0]).toMatchObject({ champ: "tolle", hitT: 2.2, anchorX: 11, anchorY: 7 });
    expect(s.effects.killBursts.map((k) => [k.team, k.shutdown])).toEqual([
      ["red", false],
      ["red", true],
    ]);
  });
});
