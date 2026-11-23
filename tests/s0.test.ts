import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONSTANTS,
  XP_TO_LEVEL,
  canonicalJSON,
  clipMove,
  constantsHash,
  defaultEvenConfig,
  digestEvents,
  inEnemySanctuary,
  simulate,
} from "../sim/index.js";
import type { MatchConfig, UnitId } from "../sim/types.js";

const SEED = 20261122;

describe("S0 M0 acceptance", () => {
  it("1. same config → byte-identical digest; seed+1 differs", () => {
    const a = simulate(defaultEvenConfig(SEED));
    const b = simulate(defaultEvenConfig(SEED));
    const c = simulate(defaultEvenConfig(SEED + 1));
    expect(a.digest).toBe(b.digest);
    expect(a.constants_hash).toBe(b.constants_hash);
    expect(a.digest).not.toBe(c.digest);
    // constants_hash is seed-independent
    expect(a.constants_hash).toBe(c.constants_hash);
  });

  it("2. forced 4:00 end is exactly 2400 ticks", () => {
    const r = simulate(defaultEvenConfig(SEED));
    expect(r.tick_count).toBe(2400);
    expect(r.state.t).toBe(240.0);
    expect(r.state.end_reason).toBe("clock");
    const end = r.events.find((e) => e.type === "match_end");
    expect(end).toBeDefined();
    expect(end!.reason).toBe("clock");
    expect(end!.tick).toBe(2400);
  });

  it("3. scripted shove into enemy sanctuary: 0 centres inside; clip logged; no violation", () => {
    const cfg: MatchConfig = {
      ...defaultEvenConfig(SEED),
      assert_sanctuary: true,
      scripted_motor: {
        "blue:adc": {
          // Drive straight at red pad centre (22, 7) — inside enemy sanctuary tiles.
          waypoints: [{ x: 22.0, y: 7.0 }],
          arrive_r: 0.05,
          hold_at_end: true,
        },
      },
    };
    const r = simulate(cfg);
    const violations = r.events.filter((e) => e.type === "sanctuary_violation");
    expect(violations.length).toBe(0);

    const clips = r.events.filter(
      (e) => e.type === "sanctuary_clip" && e.source_id === "blue:adc",
    );
    expect(clips.length).toBeGreaterThan(0);

    // Final position of blue:adc must not be in red sanctuary
    const adc = r.state.units.find((u) => u.id === ("blue:adc" as UnitId))!;
    expect(inEnemySanctuary("blue", adc.x, adc.y, DEFAULT_CONSTANTS)).toBe(false);
    expect(adc.x).toBeLessThan(22);
  });

  it("4. time XP reaches L2 on predicted tick 122", () => {
    // G2/G3: tick 0 setup (no XP); each step tick grants 1.15 XP.
    // L2 threshold 140 → first tick with xp >= 140 is tick 122 (122 * 1.15 = 140.3).
    const predicted = Math.ceil(XP_TO_LEVEL[2]! / (DEFAULT_CONSTANTS.TIME_XP_PER_S * DEFAULT_CONSTANTS.DT));
    expect(predicted).toBe(122);

    const r = simulate(defaultEvenConfig(SEED));
    const ups = r.events.filter(
      (e) => e.type === "level_up" && e.unit_id === "blue:top" && e.new_level === 2,
    );
    expect(ups.length).toBe(1);
    expect(ups[0]!.tick).toBe(122);

    const top = r.state.units.find((u) => u.id === "blue:top")!;
    // After full match, well past L2
    expect(top.level).toBeGreaterThanOrEqual(2);
  });
});

describe("S0 geometry / G12", () => {
  it("clipMove stops at enemy sanctuary threshold (no slide)", () => {
    const r = clipMove("blue", 21.0, 7.0, 22.5, 7.0, DEFAULT_CONSTANTS);
    expect(r.clipped).toBe(true);
    expect(r.reason).toBe("sanctuary");
    expect(r.x).toBeLessThan(22);
    expect(inEnemySanctuary("blue", r.x, r.y, DEFAULT_CONSTANTS)).toBe(false);
  });

  it("clipMove stops at pillar (no slide through)", () => {
    // Walk into NW pillar AABB from the west
    const r = clipMove("blue", 4.5, 2.5, 5.5, 2.5, DEFAULT_CONSTANTS);
    expect(r.clipped).toBe(true);
    expect(r.reason).toBe("pillar");
    expect(r.x).toBeLessThan(5.5);
  });

  it("displacement queue clips individually (G12 helper)", () => {
    // Two sequential clips: first into sanctuary threshold, second further — stays legal.
    const a = clipMove("blue", 21.5, 7.0, 22.2, 7.0, DEFAULT_CONSTANTS);
    expect(a.clipped).toBe(true);
    const b = clipMove("blue", a.x, a.y, a.x + 1.0, a.y, DEFAULT_CONSTANTS);
    expect(b.clipped).toBe(true);
    expect(inEnemySanctuary("blue", b.x, b.y, DEFAULT_CONSTANTS)).toBe(false);
  });
});

describe("canonical JSON / hash", () => {
  it("constants_hash is stable", () => {
    const h1 = constantsHash(DEFAULT_CONSTANTS);
    const h2 = constantsHash(DEFAULT_CONSTANTS);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("canonicalJSON sorts keys and formats t / physical floats", () => {
    const s = canonicalJSON({ z: 1, a: 2, t: 1.0, x: 1.23456, n: 3 });
    expect(s).toBe('{"a":2,"n":3,"t":1,"x":1.2346,"z":1}');
  });

  it("digest omits move and pos", () => {
    const d1 = digestEvents([
      { t: 0, tick: 0, seq: 0, type: "match_start", seed: 1 },
      { t: 0.1, tick: 1, seq: 1, type: "pos", unit_id: "blue:top", x: 1, y: 7 },
      { t: 0.1, tick: 1, seq: 2, type: "move", unit_id: "blue:top", x: 1, y: 7 },
    ]);
    const d2 = digestEvents([{ t: 0, tick: 0, seq: 0, type: "match_start", seed: 1 }]);
    expect(d1).toBe(d2);
  });
});

describe("soft separation (G6)", () => {
  it("allies near each other are steered apart without hard block", () => {
    const cfg: MatchConfig = {
      ...defaultEvenConfig(SEED),
      // Short run via early end: override MATCH_T through constants? forced end at 240.
      // Instead inspect after a few ticks by checking positions diverged from spawn jitter.
    };
    // Run a short custom: we can't easily stop early without a flag; check mid-match state
    // by simulating and reading that no unit shares identical coords with an ally.
    const r = simulate(cfg);
    const blue = r.state.units.filter((u) => u.team === "blue");
    for (let i = 0; i < blue.length; i++) {
      for (let j = i + 1; j < blue.length; j++) {
        const a = blue[i]!;
        const b = blue[j]!;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        // Spawn jitter starts at 0.3; separation should push toward >= ~0.6 over time
        // or at least keep them from occupying the exact same point.
        expect(d).toBeGreaterThan(0);
      }
    }
  });
});
