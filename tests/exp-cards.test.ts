/**
 * exp cards — Tactic Cards runtime (sim/cards.ts; not build-spec acceptance).
 */
import { describe, expect, it } from "vitest";
import { simulate } from "../sim/index.js";
import { evenOvrConfig } from "../sim/match_config.js";
import { SANDBOX_KIT_PATCH } from "../sim/balance.js";
import { SANDBOX_CONSTANTS, TEAMFIGHT_R3 } from "../sim/cadence.js";
import type { CardEffect, CardSpec, CardTrigger } from "../sim/cards.js";
import type { MatchConfig, SimEvent } from "../sim/types.js";

// The manager's points-mode arena (apps/manager/js/engine.ts matchConfig) on the even-OVR lineups.
const arena = (seed: number): MatchConfig => ({
  ...evenOvrConfig(seed), objectives: { mode: "points" }, teamfight: { ...TEAMFIGHT_R3 }, attr_scaling: true,
  constants: { ...SANDBOX_CONSTANTS }, kit_patch: SANDBOX_KIT_PATCH,
});
const card = (trigger: CardTrigger, effects: CardEffect[] = [{ stat: "dmg", v: 0 }], id: string = trigger.on, owner: CardSpec["owner"] = "adc"): CardSpec => ({ id, owner, trigger, effects });
const fires = (evs: SimEvent[]) => evs.filter((e) => e.type === "card_fire");
const SEEDS = [11, 12, 13, 14, 15, 16];
const sum = (f: (seed: number) => number) => SEEDS.reduce((n, s) => n + f(s), 0);
const run = (seed: number, blue: CardSpec[] = []) => simulate(blue.length ? { ...arena(seed), cards: { blue, red: [] } } : arena(seed));
const margin = (seed: number, blue: CardSpec[] = []) => { const st = run(seed, blue).state; return st.score_blue - st.score_red; };

describe("exp cards", () => {
  it("is off by default: absent or empty = identical digest; the caller's config is not mutated", () => {
    const base = arena(20261122), d = simulate(base).digest;
    expect(simulate({ ...base, cards: undefined }).digest).toBe(d);
    expect(simulate({ ...base, cards: { blue: [], red: [] } }).digest).toBe(d);
    const cfg = { ...base, cards: { blue: [card({ on: "time", t: 5 }, [{ stat: "tactic", tactic: { preset: "hunt", aggression: 1 }, target: "team", dur: 60 }])], red: [] } };
    const before = JSON.stringify(cfg), r = simulate(cfg);
    expect(r.digest).not.toBe(d);
    expect(JSON.stringify(cfg)).toBe(before);
    expect(simulate(cfg).digest).toBe(r.digest);
  });

  it("every trigger fires in a seeded game and emits card_fire once (Repeat: again)", () => {
    const triggers: CardTrigger[] = [
      { on: "first_capture" }, { on: "majority" }, { on: "point_lost" }, { on: "hold", s: 20 }, { on: "behind", x: 4 }, { on: "ahead", x: 4 },
      { on: "close", t: 60, x: 6 }, { on: "time", t: 90 }, { on: "first_blood", us: true }, { on: "first_blood", us: false }, { on: "kills", n: 2 },
      { on: "deaths", n: 1 }, { on: "deaths", role: "adc", enemy: true, n: 1 }, { on: "multikill", n: 2 }, { on: "alive", t: 20 },
      { on: "enemy_class", cls: "Mage", n: 2 }, { on: "owner_champ", champ: "huntress" },
    ];
    const cards = triggers.map((t, i) => card(t, undefined, `c${i}`));
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      const evs = fires(simulate({ ...arena(seed), cards: { blue: cards, red: [] } }).events);
      for (const e of evs) seen.add(e.card_id as string);
      expect(new Set(evs.map((e) => e.card_id)).size).toBe(evs.length); // once per game
      expect(evs.every((e) => e.team === "blue" && e.owner === "blue:adc")).toBe(true);
    }
    expect([...seen].sort()).toEqual(cards.map((c) => c.id).sort());
    const rep = fires(simulate({ ...arena(11), cards: { blue: [{ ...card({ on: "point_lost" }), repeat: true }], red: [] } }).events);
    expect(rep.length).toBeGreaterThan(1);
  });

  it("score cards add points; timed effects move outcomes the expected way", () => {
    const at = (effects: CardEffect[]) => [card({ on: "time", t: 1 }, effects)];
    const r = run(11, at([{ stat: "score", v: 3, target: "team" }]));
    expect(fires(r.events)[0]).toMatchObject({ team: "blue", score: 3, score_after: 3 });

    const base = sum((s) => margin(s));
    expect(sum((s) => margin(s, at([{ stat: "dmg", v: 0.4, target: "team" }])))).toBeGreaterThan(base);
    expect(sum((s) => margin(s, at([{ stat: "taken", v: -0.4, target: "team" }])))).toBeGreaterThan(base);
    expect(sum((s) => margin(s, at([{ stat: "dmg", v: -0.4, target: "enemy" }])))).toBeGreaterThan(base);

    const firstCap = (blue: CardSpec[] = []) => sum((s) => run(s, blue).events.find((e) => e.type === "point_capture" && e.team === "blue")?.t ?? 240);
    const fc = firstCap();
    expect(firstCap(at([{ stat: "cap", v: 1, target: "team" }]))).toBeLessThan(fc);
    expect(firstCap(at([{ stat: "ms", v: 0.5, target: "team" }]))).toBeLessThan(fc);

    const gaps = (blue: CardSpec[] = []) => run(11, blue).events.filter((e) => e.type === "death" && String(e.unit_id).startsWith("blue")).map((e) => Number(e.respawn_at) - e.t);
    expect(Math.max(...gaps(at([{ stat: "respawn", v: -0.5, target: "team" }])))).toBeLessThan(Math.min(...gaps()));

    const casts = (blue: CardSpec[] = []) => sum((s) => run(s, blue).events.filter((e) => e.type === "cast_start" && String(e.source_id ?? e.unit_id).startsWith("blue")).length);
    expect(casts(at([{ stat: "cd", v: 1, target: "team" }]))).toBeGreaterThan(casts());

    const early = (blue: CardSpec[] = []) => sum((s) => run(s, blue).events.filter((e) => e.type === "death" && e.t < 40 && String(e.unit_id).startsWith("blue")).length);
    expect(early(at([{ stat: "shield", v: 1, target: "team", dur: 40 }]))).toBeLessThan(early());
  });
});
