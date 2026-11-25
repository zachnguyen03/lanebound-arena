/**
 * §9.4.1 row regressions. Not acceptance copies (M2 labs stay undescribed here).
 * K-1 / K-2 / K-3 are not asserted as balance changes.
 */
import { describe, expect, it } from "vitest";
import { evaluateCastPolicy, createCastMemory, type CastMemory } from "../sim/ai/cast_policy.js";
import { beginCast } from "../sim/cast.js";
import { digestEvents } from "../sim/canonical.js";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { evenOvrConfig } from "../sim/match_config.js";
import { applyMark } from "../sim/marks.js";
import { emptyStatus } from "../sim/status.js";
import { simulate } from "../sim/simulate.js";
import type { MatchState, SimEvent, UnitState } from "../sim/types.js";

const c = DEFAULT_CONSTANTS;

function bare(
  partial: Partial<UnitState> & Pick<UnitState, "id" | "team" | "slot" | "champ">,
): UnitState {
  const u: UnitState = {
    id: partial.id,
    team: partial.team,
    slot: partial.slot,
    index: partial.index ?? 0,
    champ: partial.champ,
    x: 12,
    y: 8,
    vx: 0,
    vy: 0,
    hp: 1200,
    max_hp: 1200,
    xp: 0,
    level: 7,
    alive: true,
    respawn_at: Infinity,
    spawn_shield_until: 0,
    auto_cd: 0,
    auto_windup_left: 0,
    auto_windup_target: null,
    auto_next_start_t: 0,
    stats: {
      hp: 1200,
      regen: 4,
      atk: 80,
      pow: 40,
      pres: 30,
      mres: 28,
      as: 0.9,
      crit: 0.05,
      range: 1.5,
      ms: 3.3,
    },
    attrs: { aim: 70, reflexes: 70, execution: 70, decision: 70, positioning: 70, teamwork: 70 },
    mastery: 50,
    intent: "Idle",
    waypoint: null,
    scripted_wp_i: 0,
    damage_log: [],
    assist_log: [],
    last_hit_by: null,
    status: emptyStatus(),
    attack_reset_pending: false,
    last_damage_t: -Infinity,
    last_dealt_t: -Infinity,
    marks: [],
    cd_q: 0,
    cd_w: 0,
    cd_r: 0,
    cast_left: 0,
    cast_skill: null,
    cast_target: null,
    cast_aim_x: 12,
    cast_aim_y: 8,
    cast_force_hit: false,
    cast_seq: 0,
    cast_snapshot_ids: null,
    break_until: 0,
    commit_until: 0,
    rewind_used: false,
    abandon_scripted_motor: false,
    ai_target_id: null,
    ai_retreat_suppress_until: 0,
    walk_from_pad_until: 0,
    ai_at_planner_wp: false,
    ai_no_trickle_until: 0,
    flank_buff_until: 0,
    ai_first_auto_done: true,
    zone_aura_res: 0,
  };
  Object.assign(u, partial);
  return u;
}

function duel(me: UnitState, foes: UnitState[], allies: UnitState[] = []): MatchState {
  return { t: 10, tick: 100, units: [me, ...allies, ...foes] } as MatchState;
}

describe("§9.4.1 damage basics fire on CD", () => {
  const basics: Array<{ champ: UnitState["champ"]; skill: "Q" | "W" }> = [
    { champ: "huntress", skill: "Q" },
    { champ: "maelis", skill: "Q" },
    { champ: "isra", skill: "Q" },
    { champ: "sedge", skill: "Q" },
    { champ: "helvar", skill: "Q" },
    { champ: "calder", skill: "Q" },
    { champ: "mirren", skill: "Q" },
    { champ: "kerrig", skill: "W" },
    { champ: "rhedan", skill: "Q" },
    { champ: "brannoch", skill: "Q" },
    { champ: "saelo", skill: "Q" },
  ];

  it.each(basics)("$champ $skill is P4 against a legal target", ({ champ, skill }) => {
    const me = bare({ id: "blue:mid", team: "blue", slot: "mid", champ, x: 11, y: 8 });
    // Huntress W is a P1d dash when a melee diver is inside PEEL_DIVE_R.
    // Keep that foe ranged and outside 3 tiles so Q is the cast.
    // Isra W R7-9 spacing-resets vs melee ≤1.5; Huntress W peels melee dive —
    // keep those foes ranged / farther so the damage basic is the cast under test.
    const rangedFoe = champ === "huntress" || champ === "isra";
    const foe = bare({
      id: "red:mid",
      team: "red",
      slot: "mid",
      champ: rangedFoe ? "maelis" : "helvar",
      x: rangedFoe ? 14.6 : 12.4,
      y: 8,
      index: 1,
      stats: {
        hp: 1200,
        regen: 4,
        atk: 80,
        pow: 40,
        pres: 30,
        mres: 28,
        as: 0.9,
        crit: 0.05,
        range: rangedFoe ? 6.5 : 1.5,
        ms: 3.3,
      },
    });
    const got = evaluateCastPolicy(duel(me, [foe]), me, {
      c,
      focusId: foe.id,
      commit: "hold",
      aTrue: 0.5,
    });
    expect(got?.skill, champ).toBe(skill);
    expect(got?.tier).toBe("P4");
    expect(got?.target_id).toBe(foe.id);
  });
});

describe("Kerrig and Huntress finishers stay mark-gated", () => {
  it("high Execution does not fire unmarked R; Q still fires for Huntress", () => {
    const me = bare({
      id: "blue:adc",
      team: "blue",
      slot: "adc",
      champ: "huntress",
      x: 10,
      y: 8,
      attrs: { aim: 70, reflexes: 70, execution: 80, decision: 70, positioning: 70, teamwork: 70 },
    });
    const foe = bare({ id: "red:adc", team: "red", slot: "adc", champ: "maelis", x: 14, y: 8 });
    const q = evaluateCastPolicy(duel(me, [foe]), me, { c, focusId: foe.id, commit: "hold", aTrue: 0.2 });
    expect(q).toMatchObject({ skill: "Q", tier: "P4", target_id: foe.id });

    me.cd_q = 2;
    const r = evaluateCastPolicy(duel(me, [foe]), me, { c, focusId: foe.id, commit: "hold", aTrue: 0.9 });
    expect(r).toBeNull();

    applyMark(foe.marks, "huntress", me.id, 10, 4);
    const marked = evaluateCastPolicy(duel(me, [foe]), me, {
      c,
      focusId: foe.id,
      commit: "hold",
      aTrue: 0.9,
      comboStyle: "auto",
    });
    expect(marked).toMatchObject({ skill: "R", target_id: foe.id });
  });

  it("low Execution fumbles Kerrig R once Q is on cooldown, and hold_R blocks it", () => {
    const me = bare({
      id: "blue:mid",
      team: "blue",
      slot: "mid",
      champ: "kerrig",
      x: 11,
      y: 8,
      cd_q: 1,
      attrs: { aim: 70, reflexes: 70, execution: 30, decision: 70, positioning: 70, teamwork: 70 },
    });
    const foe = bare({ id: "red:mid", team: "red", slot: "mid", champ: "maelis", x: 15, y: 8 });
    const fumble = evaluateCastPolicy(duel(me, [foe]), me, {
      c,
      focusId: foe.id,
      commit: "hold",
      aTrue: 0.9,
      comboStyle: "auto",
    });
    expect(fumble).toMatchObject({ skill: "R", tier: "P4", target_id: foe.id });

    const held = evaluateCastPolicy(duel(me, [foe]), me, {
      c,
      focusId: foe.id,
      commit: "hold",
      aTrue: 0.4,
      comboStyle: "hold_R",
    });
    expect(held).toBeNull();
  });

  it("Kerrig Q is the engage opener and the 4s spill, not a damage basic", () => {
    const me = bare({ id: "blue:mid", team: "blue", slot: "mid", champ: "kerrig", x: 11, y: 8 });
    const foe = bare({ id: "red:adc", team: "red", slot: "adc", champ: "huntress", x: 15, y: 8 });
    const idle = evaluateCastPolicy(duel(me, [foe]), me, { c, focusId: foe.id, commit: "hold", aTrue: 0.2 });
    expect(idle).toBeNull();

    const engage = evaluateCastPolicy(duel(me, [foe]), me, {
      c,
      focusId: foe.id,
      commit: "engage",
      aTrue: 0.7,
      tactic: "hold_the_pit",
    });
    expect(engage).toMatchObject({ skill: "Q", tier: "P3", target_id: foe.id });

    const mem: CastMemory = createCastMemory();
    mem.readySince[`${me.id}|Q`] = 5;
    const spill = evaluateCastPolicy(duel(me, [foe]), me, {
      c,
      focusId: foe.id,
      commit: "hold",
      aTrue: 0.2,
      memory: mem,
    });
    expect(spill).toMatchObject({ skill: "Q", tier: "P4s", target_id: foe.id });
  });
});

describe("gates that sit on top of the rows", () => {
  it("a short auto windup blocks P4 and still allows a P1 escape", () => {
    const me = bare({
      id: "blue:adc",
      team: "blue",
      slot: "adc",
      champ: "huntress",
      x: 11,
      y: 8,
      auto_windup_left: 0.05,
    });
    const foe = bare({
      id: "red:adc",
      team: "red",
      slot: "adc",
      champ: "maelis",
      x: 13,
      y: 8,
      ai_target_id: me.id,
      stats: {
        hp: 1200,
        regen: 4,
        atk: 80,
        pow: 40,
        pres: 30,
        mres: 28,
        as: 0.9,
        crit: 0.05,
        range: 6.5,
        ms: 3.3,
      },
    });
    const blocked = evaluateCastPolicy(duel(me, [foe]), me, { c, focusId: foe.id, commit: "hold" });
    expect(blocked).toBeNull();

    me.hp = 400;
    const dash = evaluateCastPolicy(duel(me, [foe]), me, { c, focusId: foe.id, commit: "hold" });
    expect(dash?.skill).toBe("W");
    expect(dash?.tier).toBe("P1d");
    const before = Math.hypot(me.x - foe.x, me.y - foe.y);
    const after = Math.hypot((dash?.aim_x ?? me.x) - foe.x, (dash?.aim_y ?? me.y) - foe.y);
    expect(after).toBeGreaterThan(before);
  });

  it("Sedge R refuses a circle that clips two allies and allows two enemies alone", () => {
    const me = bare({ id: "blue:jungle", team: "blue", slot: "jungle", champ: "sedge", x: 8, y: 8, cd_q: 4 });
    const a1 = bare({ id: "blue:top", team: "blue", slot: "top", champ: "brannoch", x: 12, y: 8, index: 2 });
    const a2 = bare({ id: "blue:mid", team: "blue", slot: "mid", champ: "kerrig", x: 12.3, y: 8.2, index: 3 });
    const one = bare({ id: "red:mid", team: "red", slot: "mid", champ: "helvar", x: 12.1, y: 8.1, index: 1 });
    const refused = evaluateCastPolicy(duel(me, [one], [a1, a2]), me, {
      c,
      focusId: one.id,
      commit: "hold",
      aTrue: 0.4,
    });
    expect(refused?.skill).not.toBe("R");

    const e1 = bare({ id: "red:mid", team: "red", slot: "mid", champ: "helvar", x: 12, y: 8, index: 1 });
    const e2 = bare({ id: "red:adc", team: "red", slot: "adc", champ: "maelis", x: 12.6, y: 8.2, index: 4 });
    const allowed = evaluateCastPolicy(duel(me, [e1, e2]), me, {
      c,
      focusId: e1.id,
      commit: "hold",
      aTrue: 0.4,
    });
    expect(allowed).toMatchObject({ skill: "R", tier: "P4" });
  });
});

describe("cast_start.tier is additive and stripped from the digest", () => {
  it("beginCast copies tier onto cast_start and digestEvents drops it", () => {
    const me = bare({ id: "blue:adc", team: "blue", slot: "adc", champ: "huntress", x: 11, y: 8 });
    const foe = bare({ id: "red:adc", team: "red", slot: "adc", champ: "maelis", x: 14, y: 8 });
    const state = {
      t: 1,
      tick: 10,
      event_seq: 1,
      units: [me, foe],
      pending_damage: [],
      pending_heals: [],
      pending_shields: [],
      pending_status: [],
      pending_lands: [],
    } as unknown as MatchState;
    const events: SimEvent[] = [];
    beginCast(
      state,
      { tick: 10, source_id: me.id, skill: "Q", target_id: foe.id, force_hit: true, tier: "P4" },
      c,
      (type, payload) => {
        events.push({ type, t: 1, tick: 10, seq: events.length + 1, ...payload } as SimEvent);
      },
    );
    const start = events.find((e) => e.type === "cast_start");
    expect(start?.tier).toBe("P4");
    const stripped = events.map((e) => {
      const { tier: _tier, ...rest } = e;
      return rest as SimEvent;
    });
    expect(digestEvents(events)).toBe(digestEvents(stripped));
  });
});

describe("even-Hold emits the damage basics that are on the field", () => {
  function names(seedPicks: { blue: string[]; red: string[] }) {
    const cfg = evenOvrConfig(20261122, "hold_the_pit");
    const r = simulate({
      ...cfg,
      constants: { ...(cfg.constants ?? {}), MATCH_T: 40 },
      blue: { ...cfg.blue, picks: seedPicks.blue },
      red: { ...cfg.red, picks: seedPicks.red },
    });
    const skills = new Set(
      r.events.filter((e) => e.type === "cast_start").map((e) => String(e.skill_id)),
    );
    return { skills, tiers: r.events.filter((e) => e.type === "cast_start").map((e) => e.tier) };
  }

  it("default roster casts damage basics plus Kerrig and Huntress Q", () => {
    const { skills, tiers } = names({
      blue: ["brannoch", "sedge", "kerrig", "huntress", "ysol"],
      red: ["rhedan", "tolle", "helvar", "maelis", "saelo"],
    });
    for (const skill of [
      "Quarry Throw",
      "Lantern Sweep",
      "Spool Cut",
      "Keen Bolt",
      "Tide-Cleave",
      "Stoneverse",
      "Prism Split",
      "Second Hand",
      "Latch Line",
    ]) {
      expect(skills.has(skill), skill).toBe(true);
    }
    expect(tiers.every((t) => t !== undefined)).toBe(true);
  }, 60_000);

  it("a wired engage fight emits Kerrig and Huntress Q then the mark-gated R", () => {
    const cfg = evenOvrConfig(7, "hold_the_pit");
    const r = simulate({
      ...cfg,
      constants: { ...(cfg.constants ?? {}), MATCH_T: 8 },
      unit_overrides: {
        "blue:mid": { level: 7, x: 10, y: 8, spawn_shield_until: 0 },
        "blue:adc": { level: 7, x: 9, y: 8, spawn_shield_until: 0 },
        "blue:top": { level: 7, x: 10, y: 6.5, spawn_shield_until: 0 },
        "blue:jungle": { x: 1.5, y: 2, spawn_shield_until: 99 },
        "blue:support": { x: 1.5, y: 3, spawn_shield_until: 99 },
        "red:adc": { level: 7, x: 15, y: 8, hp: 700, spawn_shield_until: 0 },
        "red:mid": { level: 7, x: 15.5, y: 9, hp: 800, spawn_shield_until: 0 },
        "red:top": { x: 22, y: 12, spawn_shield_until: 99 },
        "red:jungle": { x: 22, y: 11, spawn_shield_until: 99 },
        "red:support": { x: 22, y: 10, spawn_shield_until: 99 },
      },
    });
    const starts = r.events.filter((e) => e.type === "cast_start");
    const of = (id: string, skill: string) =>
      starts.find((e) => e.unit_id === id && e.skill_id === skill);
    expect(of("blue:mid", "Latch Line")?.tier).toBe("P3");
    expect(of("blue:mid", "Reeling Cut")?.tier).toBe("P4");
    expect(of("blue:adc", "Keen Bolt")?.tier).toBe("P4");
    expect(of("blue:adc", "Horizon Volley")?.tier).toBe("P4");
  }, 30_000);

  it("the kits missing from the default roster still cast their damage basic", () => {
    const { skills } = names({
      blue: ["torun", "sedge", "mirren", "isra", "ysol"],
      red: ["brannoch", "tolle", "calder", "maelis", "saelo"],
    });
    for (const skill of ["Glaze Spit", "Fuse Shot", "Ashbreath"]) {
      expect(skills.has(skill), skill).toBe(true);
    }
  }, 60_000);
});
