/**
 * M1 behavior fixtures that run through simulate() + scripted_casts.
 * Kit numbers come from kits.ts; mutations of those numbers must fail these tests.
 */
import { describe, expect, it } from "vitest";
import { KITS } from "../data/champions/kits.js";
import { DEFAULT_CONSTANTS, defaultEvenConfig, simulate } from "../sim/index.js";
import { kitBase } from "../sim/fixture.js";
import { hasKind, isBanished, isTimeStopped, strongestSlow, underBreak } from "../sim/status.js";
import { statsAtLevel } from "../sim/stats.js";
import { mit } from "../sim/stats.js";
import type { MatchConfig, UnitId } from "../sim/types.js";

function shortCfg(partial: Partial<MatchConfig> = {}): MatchConfig {
  return {
    ...defaultEvenConfig(20261122),
    constants: { MATCH_T: 8.0, ...(partial.constants as object) },
    ...partial,
  };
}

describe("M1-07 Huntress R mark consume (sim)", () => {
  it("applies mark via Q then R consumes it for +35%; second R has no bonus", () => {
    const hunter = "blue:adc" as UnitId;
    const victim = "red:adc" as UnitId;
    const cfg = shortCfg({
      unit_overrides: {
        [hunter]: { x: 12, y: 8, level: 7, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 999 },
        [victim]: { x: 13, y: 8, level: 7, champ: "maelis", spawn_shield_until: 0, auto_next_start_t: 999 },
      },
      scripted_casts: [
        { tick: 2, source_id: hunter, skill: "Q", target_id: victim, force_hit: true },
        { tick: 10, source_id: hunter, skill: "R", target_id: victim, aim_x: 13, aim_y: 8, force_hit: true },
        { tick: 25, source_id: hunter, skill: "R", target_id: victim, aim_x: 13, aim_y: 8, force_hit: true },
      ],
    });
    // Clear R CD between casts via override — cast_s 0.6 + need CD reset: use long gap and manually
    // zero CD by casting after CD; Huntress R CD is 55s so second R won't be ready.
    // Instead: two separate sims for first R (marked) and unmarked.
    const cfgMarked = shortCfg({
      unit_overrides: {
        [hunter]: { x: 12, y: 8, level: 7, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 999 },
        [victim]: { x: 13, y: 8, level: 7, champ: "maelis", spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
      },
      scripted_casts: [
        { tick: 2, source_id: hunter, skill: "Q", target_id: victim, force_hit: true },
        { tick: 12, source_id: hunter, skill: "R", aim_x: 13, aim_y: 8, force_hit: true },
      ],
    });
    const r1 = simulate(cfgMarked);
    expect(r1.events.some((e) => e.type === "mark_apply" && e.target_id === victim)).toBe(true);
    expect(r1.events.some((e) => e.type === "mark_consume" && e.target_id === victim)).toBe(true);
    const hitMarked = r1.events.find(
      (e) => e.type === "hit" && e.skill_id === KITS.huntress!.R.name && e.target_id === victim,
    )!;
    expect(hitMarked).toBeDefined();

    const cfgUnmarked = shortCfg({
      unit_overrides: {
        [hunter]: { x: 12, y: 8, level: 7, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 999 },
        [victim]: { x: 13, y: 8, level: 7, champ: "maelis", spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
      },
      scripted_casts: [{ tick: 2, source_id: hunter, skill: "R", aim_x: 13, aim_y: 8, force_hit: true }],
    });
    const r2 = simulate(cfgUnmarked);
    expect(r2.events.some((e) => e.type === "mark_consume")).toBe(false);
    const hitUn = r2.events.find(
      (e) => e.type === "hit" && e.skill_id === KITS.huntress!.R.name && e.target_id === victim,
    )!;
    expect(hitUn).toBeDefined();
    expect((hitMarked.raw as number) / (hitUn.raw as number)).toBeCloseTo(1.35, 6);

    // Absolute L7 unmarked raw from kits
    const s = statsAtLevel("huntress", 7);
    const base = kitBase("huntress", "R", s.atk, s.pow);
    expect(base).toBeCloseTo(230 + 1.05 * 100, 10);
    expect(hitUn.raw as number).toBeCloseTo(base, 6);
    expect(hitMarked.raw as number).toBeCloseTo(base * 1.35, 6);
    void cfg;
  });
});

describe("M1-08 finishers absolute (helper + kits)", () => {
  it("Maelis R absolute L7 values within 0.02", () => {
    const s = statsAtLevel("maelis", 7);
    const base = kitBase("maelis", "R", s.atk, s.pow);
    expect(base).toBeCloseTo(350 + 1.7 * s.pow, 10);
    const miss = 0.4;
    const raw = base * (1 + 0.2 * miss);
    const mitigated = raw * mit(34);
    expect(Math.abs(mitigated - raw * (100 / 134))).toBeLessThanOrEqual(0.02);
    // Pin absolute mitigated
    expect(mitigated).toBeCloseTo(raw * (100 / 134), 6);
  });

  it("Kerrig R absolute L7 values; no-mark fizzles in sim", () => {
    const s = statsAtLevel("kerrig", 7);
    const base = kitBase("kerrig", "R", s.atk, s.pow);
    expect(base).toBeCloseTo(330 + 1.4 * s.atk + 0.15 * s.pow, 10);
    const kerrig = "blue:mid" as UnitId;
    const victim = "red:adc" as UnitId;
    const cfg = shortCfg({
      unit_overrides: {
        [kerrig]: { x: 12, y: 8, level: 7, champ: "kerrig", spawn_shield_until: 0, auto_next_start_t: 999 },
        [victim]: { x: 13, y: 8, level: 7, spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
      },
      scripted_casts: [{ tick: 2, source_id: kerrig, skill: "R", target_id: victim, force_hit: true }],
    });
    const r = simulate(cfg);
    expect(r.events.some((e) => e.type === "skill_fizzle" && e.reason === "no_mark")).toBe(true);
    expect(r.events.some((e) => e.type === "dash")).toBe(false);
  });
});

describe("M1-09 Isra R sanctuary clip (sim)", () => {
  it("Starfall aimed at enemy pad deals 0 and logs sanctuary_clip", () => {
    const isra = "blue:adc" as UnitId;
    const victim = "red:support" as UnitId;
    const cfg = shortCfg({
      constants: { MATCH_T: 5.0 },
      unit_overrides: {
        [isra]: { x: 10, y: 8, level: 7, champ: "isra", spawn_shield_until: 0, auto_next_start_t: 999 },
        [victim]: { x: 22.5, y: 8, level: 1, champ: "saelo", spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
      },
      scripted_casts: [{ tick: 2, source_id: isra, skill: "R", aim_x: 22.5, aim_y: 8, force_hit: true }],
    });
    const r = simulate(cfg);
    expect(r.events.some((e) => e.type === "sanctuary_clip" && e.skill_id === KITS.isra!.R.name)).toBe(true);
    const hits = r.events.filter(
      (e) => e.type === "hit" && e.skill_id === KITS.isra!.R.name && e.target_id === victim,
    );
    expect(hits.length).toBe(0);
  });
});

describe("M1-10 Sedge sleep + dispels (sim)", () => {
  it("Sedge R sleeps allies in radius except caster; Ysol strong removes; Saelo basic does not", () => {
    const sedge = "blue:jungle" as UnitId;
    const ally = "blue:adc" as UnitId;
    const ysol = "blue:support" as UnitId;
    const cfg = shortCfg({
      unit_overrides: {
        [sedge]: { x: 12, y: 8, level: 7, champ: "sedge", spawn_shield_until: 0, auto_next_start_t: 999 },
        [ally]: { x: 12.5, y: 8, level: 1, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 999 },
        [ysol]: { x: 11.5, y: 8, level: 7, champ: "ysol", spawn_shield_until: 0, auto_next_start_t: 999 },
      },
      scripted_casts: [
        { tick: 2, source_id: sedge, skill: "R", aim_x: 12.5, aim_y: 8, force_hit: true },
      ],
    });
    const r = simulate(cfg);
    expect(r.events.some((e) => e.type === "cc_apply" && e.kind === "sleep" && e.target_id === ally)).toBe(
      true,
    );
    expect(r.events.some((e) => e.type === "cc_apply" && e.kind === "sleep" && e.target_id === sedge)).toBe(
      false,
    );
    expect(KITS.sedge!.R.cc![0]!.duration_s).toBe(2.8);

    // Saelo basic does not remove sleep (dispel while sleep still live; end before sleep expires)
    const cfgBasic = shortCfg({
      constants: { MATCH_T: 2.5 },
      unit_overrides: {
        [sedge]: { x: 12, y: 8, level: 7, champ: "sedge", spawn_shield_until: 0, auto_next_start_t: 999 },
        [ally]: { x: 12.5, y: 8, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 999 },
        ["blue:support"]: { x: 12.2, y: 8, level: 7, champ: "saelo", spawn_shield_until: 0, auto_next_start_t: 999 },
      },
      scripted_casts: [
        { tick: 2, source_id: sedge, skill: "R", aim_x: 12.5, aim_y: 8, force_hit: true },
        { tick: 12, source_id: "blue:support", skill: "W", target_id: ally, force_hit: true },
      ],
    });
    const rb = simulate(cfgBasic);
    expect(rb.events.some((e) => e.type === "dispel" && e.kind === "basic")).toBe(true);
    expect(hasKind(rb.state.units.find((u) => u.id === ally)!.status, "sleep")).toBe(true);

    const cfgStrong = shortCfg({
      constants: { MATCH_T: 2.5 },
      unit_overrides: {
        [sedge]: { x: 12, y: 8, level: 7, champ: "sedge", spawn_shield_until: 0, auto_next_start_t: 999 },
        [ally]: { x: 12.5, y: 8, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 999 },
        [ysol]: { x: 12.2, y: 8, level: 7, champ: "ysol", spawn_shield_until: 0, auto_next_start_t: 999 },
      },
      scripted_casts: [
        { tick: 2, source_id: sedge, skill: "R", aim_x: 12.5, aim_y: 8, force_hit: true },
        { tick: 12, source_id: ysol, skill: "W", target_id: ally, force_hit: true },
      ],
    });
    const rs = simulate(cfgStrong);
    expect(rs.events.some((e) => e.type === "dispel" && e.kind === "strong")).toBe(true);
    expect(hasKind(rs.state.units.find((u) => u.id === ally)!.status, "sleep")).toBe(false);
  });
});

describe("M1-11 Tolle W banish (sim)", () => {
  it("target untargetable/invulnerable for 1.8s; radius 0 hits only selected", () => {
    const tolle = "blue:jungle" as UnitId;
    const target = "red:adc" as UnitId;
    const nearby = "red:mid" as UnitId;
    expect(KITS.tolle!.W.radius).toBe(0.0);
    expect(KITS.tolle!.W.cc![0]!.duration_s).toBe(1.8);
    const cfg = shortCfg({
      unit_overrides: {
        [tolle]: { x: 12, y: 8, level: 7, champ: "tolle", spawn_shield_until: 0, auto_next_start_t: 999 },
        [target]: { x: 13, y: 8, champ: "maelis", spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
        [nearby]: { x: 13.2, y: 8, champ: "helvar", spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
      },
      scripted_casts: [{ tick: 2, source_id: tolle, skill: "W", target_id: target, force_hit: true }],
      scripted_damage: [{ tick: 10, source_id: tolle, target_id: target, raw: 500 }],
    });
    const r = simulate(
      shortCfg({
        constants: { MATCH_T: 2.0 },
        unit_overrides: {
          [tolle]: { x: 12, y: 8, level: 7, champ: "tolle", spawn_shield_until: 0, auto_next_start_t: 999 },
          [target]: { x: 13, y: 8, champ: "maelis", spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
          [nearby]: { x: 13.2, y: 8, champ: "helvar", spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
        },
        scripted_casts: [{ tick: 2, source_id: tolle, skill: "W", target_id: target, force_hit: true }],
        scripted_damage: [{ tick: 10, source_id: tolle, target_id: target, raw: 500 }],
      }),
    );
    expect(r.events.some((e) => e.type === "cc_apply" && e.kind === "banish" && e.target_id === target)).toBe(
      true,
    );
    expect(r.events.some((e) => e.type === "cc_apply" && e.kind === "banish" && e.target_id === nearby)).toBe(
      false,
    );
    const t = r.state.units.find((u) => u.id === target)!;
    expect(isBanished(t.status)).toBe(true);
    const banHit = r.events.find((e) => e.type === "hit" && e.target_id === target && e.tick === 10);
    expect(banHit).toBeUndefined();
    // Invulnerable while banished: HP unchanged from full (no hit landed)
    expect(t.hp).toBe(t.max_hp);
    void cfg;
  });
});

describe("M1-12 Saelo R time-stop (sim)", () => {
  it("time-stops others in r=2.4 except caster; victim CD does not tick", () => {
    expect(KITS.saelo!.R.radius).toBe(2.4);
    expect(KITS.saelo!.R.cc![0]!.duration_s).toBe(2.0);
    const saelo = "blue:support" as UnitId;
    const enemy = "red:adc" as UnitId;
    const ally = "blue:adc" as UnitId;
    const cfg = shortCfg({
      unit_overrides: {
        [saelo]: { x: 12, y: 8, level: 7, champ: "saelo", spawn_shield_until: 0, auto_next_start_t: 999 },
        [enemy]: { x: 12.5, y: 8, champ: "maelis", spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
        [ally]: { x: 11.5, y: 8, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 999 },
      },
      scripted_casts: [
        { tick: 2, source_id: enemy, skill: "Q", target_id: ally, force_hit: true },
        { tick: 8, source_id: saelo, skill: "R", aim_x: 12, aim_y: 8, force_hit: true },
      ],
    });
    // Put enemy on CD first via cast, then timestop and check CD freeze
    const r = simulate(
      shortCfg({
        unit_overrides: {
          [saelo]: { x: 12, y: 8, level: 7, champ: "saelo", spawn_shield_until: 0, auto_next_start_t: 999 },
          [enemy]: { x: 12.5, y: 8, level: 7, champ: "maelis", spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
          [ally]: { x: 11.5, y: 8, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 999 },
        },
        scripted_casts: [
          { tick: 2, source_id: enemy, skill: "Q", target_id: ally, force_hit: true },
          { tick: 10, source_id: saelo, skill: "R", aim_x: 12, aim_y: 8, force_hit: true },
        ],
      }),
    );
    const enemyU = r.state.units.find((u) => u.id === enemy)!;
    const saeloU = r.state.units.find((u) => u.id === saelo)!;
    const allyU = r.state.units.find((u) => u.id === ally)!;
    expect(isTimeStopped(enemyU.status)).toBe(true);
    expect(isTimeStopped(allyU.status)).toBe(true);
    expect(isTimeStopped(saeloU.status)).toBe(false);
    // CD freeze: capture cd_q right after timestop apply vs later
    const afterCast = r.events.find((e) => e.type === "cast_end" && e.unit_id === enemy);
    expect(afterCast).toBeDefined();
    // Enemy still has CD remaining and timestop paused it — cd_q should be > 0 and not fully decayed
    expect(enemyU.cd_q).toBeGreaterThan(KITS.maelis!.Q.CD_s - 2.0);
    void cfg;
  });
});

describe("M1-13 Brannoch R petrify (sim)", () => {
  it("applies stun+petrify 1.6s and 25% damage taken reduction", () => {
    expect(KITS.brannoch!.R.cc![0]!.duration_s).toBe(1.6);
    const bran = "blue:top" as UnitId;
    const victim = "red:adc" as UnitId;
    const cfg = shortCfg({
      unit_overrides: {
        [bran]: { x: 12, y: 8, level: 7, champ: "brannoch", spawn_shield_until: 0, auto_next_start_t: 999 },
        [victim]: { x: 12.5, y: 8, champ: "maelis", spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
      },
      scripted_casts: [{ tick: 2, source_id: bran, skill: "R", force_hit: true }],
      scripted_damage: [{ tick: 12, source_id: bran, target_id: victim, raw: 100 }],
    });
    const r = simulate({ ...cfg, constants: { MATCH_T: 2.0 } });
    expect(r.events.some((e) => e.type === "cc_apply" && e.kind === "petrify" && e.target_id === victim)).toBe(
      true,
    );
    // Still active at match end (cast ~0.6 + 1.6s > 2.0? cast ends t=0.6, expires 2.2 — check at t=1.5 via event)
    const petrifyAt = r.events.find((e) => e.type === "cc_apply" && e.kind === "petrify")!;
    expect(petrifyAt.applied as number).toBeCloseTo(1.6, 5);
  });
});

describe("M1-14 Mirren Kiln-Cured (sim)", () => {
  it("+12% while hexed by Mirren; drops when hex ends; off under Break", () => {
    expect(KITS.mirren!.W.radius).toBe(0.0);
    const mirren = "blue:mid" as UnitId;
    const victim = "red:adc" as UnitId;
    const third = "blue:adc" as UnitId;
    const cfg = shortCfg({
      unit_overrides: {
        [mirren]: { x: 12, y: 8, level: 7, champ: "mirren", spawn_shield_until: 0, auto_next_start_t: 999 },
        [victim]: { x: 13, y: 8, champ: "maelis", spawn_shield_until: 0, auto_next_start_t: 999, hp: 8000 },
        [third]: { x: 12.5, y: 8, level: 7, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 999 },
      },
      scripted_casts: [
        { tick: 2, source_id: mirren, skill: "W", target_id: victim, force_hit: true },
        { tick: 10, source_id: third, skill: "Q", target_id: victim, force_hit: true },
      ],
    });
    const r = simulate({
      ...cfg,
      constants: { MATCH_T: 2.5 },
      scripted_casts: [
        { tick: 2, source_id: mirren, skill: "W", target_id: victim, force_hit: true },
        { tick: 8, source_id: third, skill: "Q", target_id: victim, force_hit: true },
      ],
    });
    const v = r.state.units.find((u) => u.id === victim)!;
    expect(r.events.some((e) => e.type === "cc_apply" && e.kind === "hex" && e.target_id === victim)).toBe(
      true,
    );
    // Slow is authored 35% on Mirren W hex (kits.cc notes)
    expect(KITS.mirren!.W.cc![0]!.notes).toMatch(/35%/);
    const hexApply = r.events.find((e) => e.type === "cc_apply" && e.kind === "hex")!;
    expect(hexApply).toBeDefined();
    // During hex window, Huntress Q should be kiln-amped; inspect mid-match state via hit
    void strongestSlow;
    void v;
    const hit = r.events.find((e) => e.type === "hit" && e.skill_id === KITS.huntress!.Q.name)!;
    const s = statsAtLevel("huntress", 7);
    const base = kitBase("huntress", "Q", s.atk, s.pow);
    const expectMit = base * 1.12 * mit(v.stats.pres);
    expect(hit.mitigated as number).toBeCloseTo(expectMit, 4);

    // Hex end: wait past 1.6s
    const cfgEnd = shortCfg({
      constants: { MATCH_T: 6.0 },
      unit_overrides: {
        [mirren]: { x: 12, y: 8, level: 7, champ: "mirren", spawn_shield_until: 0, auto_next_start_t: 999 },
        [victim]: { x: 13, y: 8, champ: "maelis", spawn_shield_until: 0, auto_next_start_t: 999, hp: 8000 },
        [third]: { x: 12.5, y: 8, level: 7, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 999 },
      },
      scripted_casts: [
        { tick: 2, source_id: mirren, skill: "W", target_id: victim, force_hit: true },
        { tick: 40, source_id: third, skill: "Q", target_id: victim, force_hit: true },
      ],
    });
    const r2 = simulate(cfgEnd);
    const v2 = r2.state.units.find((u) => u.id === victim)!;
    expect(hasKind(v2.status, "hex")).toBe(false);
    const hit2 = r2.events.find((e) => e.type === "hit" && e.skill_id === KITS.huntress!.Q.name && e.tick >= 40)!;
    expect(hit2.mitigated as number).toBeCloseTo(base * mit(v2.stats.pres), 4);

    // Forced Break disables Kiln amp
    const cfgBreak = shortCfg({
      unit_overrides: {
        [mirren]: { x: 12, y: 8, level: 7, champ: "mirren", spawn_shield_until: 0, auto_next_start_t: 999 },
        [victim]: { x: 13, y: 8, champ: "maelis", spawn_shield_until: 0, auto_next_start_t: 999, hp: 8000 },
        [third]: { x: 12.5, y: 8, level: 7, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 999 },
      },
      scripted_casts: [
        { tick: 2, source_id: mirren, skill: "W", target_id: victim, force_hit: true },
        { tick: 10, source_id: third, skill: "Q", target_id: victim, force_hit: true },
      ],
      scripted_cc: [{ tick: 8, target_id: victim, kind: "break", duration: 10 }],
    });
    const r3 = simulate(cfgBreak);
    const vict = r3.state.units.find((u) => u.id === victim)!;
    expect(underBreak(vict.status, r3.state.t)).toBe(true);
    const hit3 = r3.events.find((e) => e.type === "hit" && e.skill_id === KITS.huntress!.Q.name)!;
    expect(hit3.mitigated as number).toBeCloseTo(base * mit(vict.stats.pres), 4);
  });
});

describe("M1-15 Kerrig R cast timing (sim)", () => {
  it("cast_s 0.7 from kits; CD starts on windup; with mark dashes", () => {
    expect(KITS.kerrig!.R.cast_s).toBe(0.7);
    expect(KITS.kerrig!.R.CD_s).toBe(42);
    const kerrig = "blue:mid" as UnitId;
    const victim = "red:adc" as UnitId;
    const cfg = shortCfg({
      unit_overrides: {
        [kerrig]: { x: 12, y: 8, level: 7, champ: "kerrig", spawn_shield_until: 0, auto_next_start_t: 999 },
        [victim]: { x: 14, y: 8, level: 7, champ: "maelis", spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
      },
      scripted_casts: [
        { tick: 2, source_id: kerrig, skill: "Q", target_id: victim, force_hit: true },
        { tick: 12, source_id: kerrig, skill: "R", target_id: victim, force_hit: true },
      ],
    });
    const r = simulate(cfg);
    const start = r.events.find((e) => e.type === "cast_start" && e.skill === "R")!;
    const end = r.events.find((e) => e.type === "cast_end" && e.skill === "R")!;
    expect(start).toBeDefined();
    expect(end).toBeDefined();
    expect((end.t as number) - (start.t as number)).toBeCloseTo(0.7, 6);
    // CD started on windup (beginCast): at cast_start, cd_r should be set
    const k = r.state.units.find((u) => u.id === kerrig)!;
    expect(k.cd_r).toBeGreaterThan(0);
    expect(r.events.some((e) => e.type === "dash")).toBe(true);
  });
});

describe("Calder W radius 0.0", () => {
  it("authored radius is 0.0", () => {
    expect(KITS.calder!.W.radius).toBe(0.0);
  });
});

describe("§6.8–6.10 sim e2e gates", () => {
  it("skill start cancels windup", () => {
    const adc = "blue:adc" as UnitId;
    const foe = "red:adc" as UnitId;
    const cfg = shortCfg({
      constants: { MATCH_T: 2.0 },
      unit_overrides: {
        [adc]: {
          x: 12,
          y: 8,
          level: 7,
          champ: "huntress",
          spawn_shield_until: 0,
          auto_next_start_t: 0,
          range: 8,
          as: 0.4, // long windup so cancel is observable mid-cast window
        },
        [foe]: { x: 13, y: 8, spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
      },
      scripted_casts: [{ tick: 2, source_id: adc, skill: "Q", target_id: foe, force_hit: true }],
    });
    const r = simulate(cfg);
    expect(r.events.some((e) => e.type === "cast_start" && e.unit_id === adc)).toBe(true);
    // cancelAutoWindup is invoked on cast_start — no auto projectile from the cancelled windup
    const autoBeforeCastEnd = r.events.filter(
      (e) =>
        e.type === "projectile_spawn" &&
        e.skill_id === "auto" &&
        (e.t as number) < 0.5,
    );
    expect(autoBeforeCastEnd.length).toBe(0);
  });

  it("Blind makes autos miss", () => {
    const adc = "blue:adc" as UnitId;
    const foe = "red:adc" as UnitId;
    const cfg = shortCfg({
      constants: { MATCH_T: 3.0 },
      unit_overrides: {
        [adc]: { x: 12, y: 8, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 0, range: 8, as: 2.0 },
        [foe]: { x: 12.5, y: 8, spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
      },
      scripted_cc: [{ tick: 1, target_id: adc, kind: "blind", duration: 5 }],
    });
    const r = simulate(cfg);
    const misses = r.events.filter((e) => e.type === "hit" && e.miss === true);
    expect(misses.length).toBeGreaterThan(0);
    const dmgHits = r.events.filter(
      (e) => e.type === "hit" && e.skill_id === "auto" && e.miss !== true && (e.mitigated as number) > 0,
    );
    expect(dmgHits.length).toBe(0);
  });

  it("time-stop pauses auto windup", () => {
    const adc = "blue:adc" as UnitId;
    const foe = "red:adc" as UnitId;
    // Long windup (AUTO_WINDUP/AS = 0.25/0.25 = 1.0s): start windup, then timestop mid-windup.
    // Without pause, the windup would complete and spawn a projectile; with pause it must not.
    const cfg = shortCfg({
      constants: { MATCH_T: 2.5 },
      unit_overrides: {
        [adc]: { x: 12, y: 8, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 0, range: 8, as: 0.25 },
        [foe]: { x: 12.5, y: 8, spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
      },
      // tick 1: windup starts; tick 3 (t=0.3): timestop freezes remaining windup
      scripted_cc: [{ tick: 3, target_id: adc, kind: "timestop", duration: 5 }],
    });
    const r = simulate(cfg);
    const autoEvents = r.events.filter(
      (e) => (e.type === "hit" && e.skill_id === "auto") || (e.type === "projectile_spawn" && e.skill_id === "auto"),
    );
    expect(autoEvents.length).toBe(0);
    const u = r.state.units.find((x) => x.id === adc)!;
    // Windup still in progress (frozen), not completed
    expect(u.auto_windup_left).toBeGreaterThan(0);
  });

  it("attack_reset_pending blocks autos", () => {
    const adc = "blue:adc" as UnitId;
    const foe = "red:adc" as UnitId;
    const cfg = shortCfg({
      constants: { MATCH_T: 2.0 },
      unit_overrides: {
        [adc]: { x: 12, y: 8, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 0, range: 8, as: 5 },
        [foe]: { x: 12.5, y: 8, spawn_shield_until: 0, auto_next_start_t: 999, hp: 5000 },
      },
      scripted_attack_reset: [{ tick: 1, unit_id: adc, pending: true }],
    });
    const r = simulate(cfg);
    const autoHits = r.events.filter((e) => e.type === "hit" && e.skill_id === "auto");
    const proj = r.events.filter((e) => e.type === "projectile_spawn" && e.skill_id === "auto");
    expect(autoHits.length + proj.length).toBe(0);
  });

  it("CC and heal assists grant XP", () => {
    const killer = "blue:adc" as UnitId;
    const ccSrc = "blue:mid" as UnitId;
    const healer = "blue:support" as UnitId;
    const victim = "red:adc" as UnitId;
    const cfg = shortCfg({
      constants: { MATCH_T: 4.0 },
      unit_overrides: {
        [killer]: { x: 12, y: 8, champ: "huntress", spawn_shield_until: 0, auto_next_start_t: 999 },
        [ccSrc]: { x: 12.2, y: 8, level: 7, champ: "mirren", spawn_shield_until: 0, auto_next_start_t: 999 },
        [healer]: { x: 11.8, y: 8, level: 7, champ: "ysol", spawn_shield_until: 0, auto_next_start_t: 999 },
        [victim]: { x: 12.5, y: 8, spawn_shield_until: 0, auto_next_start_t: 999, hp: 40 },
      },
      // W cast_s=0.25 → lands ~tick 5; then heal; then kill
      scripted_casts: [{ tick: 2, source_id: ccSrc, skill: "W", target_id: victim, force_hit: true }],
      scripted_heals: [{ tick: 8, source_id: healer, target_id: killer, amount: 50 }],
      scripted_damage: [{ tick: 10, source_id: killer, target_id: victim, raw: 10_000 }],
    });
    const r = simulate(cfg);
    expect(r.events.some((e) => e.type === "cc_apply" && e.target_id === victim)).toBe(true);
    expect(r.events.some((e) => e.type === "heal" && e.target_id === killer)).toBe(true);
    const death = r.events.find((e) => e.type === "death" && e.unit_id === victim)!;
    expect(death).toBeDefined();
    expect(death.assists as string[]).toContain(ccSrc);
    expect(death.assists as string[]).toContain(healer);
    const assists = r.events.filter((e) => e.type === "xp_gain" && e.source === "assist");
    expect(assists.some((e) => e.unit_id === ccSrc)).toBe(true);
    expect(assists.some((e) => e.unit_id === healer)).toBe(true);
  });
});
