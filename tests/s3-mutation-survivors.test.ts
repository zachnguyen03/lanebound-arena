/**
 * Held-out killers / justifications for box mutate-s3 survivors
 * S3A10, S3A12, S3A19, S3A20, S3A22, S3A23.
 *
 * Do not edit tests/acceptance/s3.
 */
import { describe, expect, it } from "vitest";
import {
  ORB_PADS,
  placeInZone,
  runS3,
  zoneOf,
  barTicks,
  deniersOf,
  claimDeniesOf,
  killAt,
  type UId,
} from "./acceptance/s3/_harness.js";
import { DEFAULT_CONSTANTS } from "../sim/constants.js";
import { createArenaRuntime, tickArenaPhase11 } from "../sim/arena.js";
import { emptyStatus } from "../sim/status.js";

const BA = "blue:adc" as UId;
const RA = "red:adc" as UId;
const RM = "red:mid" as UId;
const PAD0 = { x: ORB_PADS[0]![0], y: ORB_PADS[0]![1] };

describe("S3A10 — coin flip colour is pinned for a known seed", () => {
  it("seed 20261122 deadlock coin_flip winner is red (kills invert of flip < 0.5)", () => {
    const r = runS3({
      seed: 20261122,
      T: 10,
      constants: { MATCH_T: 5.0, SUDDEN_DEATH_T: 8.0, BO1_EXTRA_S: 2.0 },
    });
    const end = r.matchEnd()!;
    expect(end.reason).toBe("coin_flip");
    // rng.next("tiebreak") for this seed is ≥ 0.5 under flip < 0.5 ? blue : red
    expect(end.winner).toBe("red");
  });
});

describe("S3A12 — owner's bar held-at-0 (justified equivalent)", () => {
  it("after capture the owner's published bar is 0; capture step already zeroes both bars", () => {
    // Needle drops `if (z.owner === "blue/red") z.progress_* = 0` after the
    // exclusive/empty updates. Capture at ≥30 already sets both bars to 0
    // (`sim/arena.ts` capture block), and `if (z.owner !== "blue/red")`
    // prevents further owner increments. Published progress is unchanged —
    // genuine equivalent on this tip. See lab/s3/pm-s2-notes/SURVIVORS-S3.md.
    const r = runS3({ T: 5.0, units: { [BA]: placeInZone(BA) } });
    expect(zoneOf(r).owner).toBe("blue");
    expect(barTicks(zoneOf(r), "blue")).toBe(0);
  });
});

describe("S3A19 — pickup is end-of-tick only (no vx/vy back-projection)", () => {
  it("end pose outside the pad does not pick up even when vx/vy back-projects onto the pad", () => {
    // Box needle adds prev-pos via x-vx*DT / y-vy*DT. Drive tickArenaPhase11
    // directly: orb already up (not spawned this tick), end outside, velocity
    // back-projects onto the pad centre.
    const c = {
      ...DEFAULT_CONSTANTS,
      ORB_PICKUP_R: 0.9,
      ORB_FIRST_SPAWN_S: 99,
      DT: 0.1,
    };
    const arena = createArenaRuntime(c);
    const orb = arena.orbs[0]!;
    orb.up = true;
    orb.respawn_at = Infinity;

    const pickupR = c.ORB_PICKUP_R;
    const endY = orb.y + pickupR + 0.25;
    const vy = (endY - orb.y) / c.DT; // prevY = endY - vy*DT = orb.y
    const unit = {
      id: BA,
      team: "blue" as const,
      slot: "adc" as const,
      index: 0,
      champ: "huntress" as const,
      x: orb.x,
      y: endY,
      vx: 0,
      vy,
      hp: 500,
      max_hp: 900,
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
        hp: 900,
        regen: 4,
        atk: 72,
        pow: 8,
        pres: 26,
        mres: 24,
        as: 1.2,
        crit: 0.08,
        range: 2.5,
        ms: 3.3,
      },
      attrs: {
        aim: 70,
        reflexes: 70,
        execution: 70,
        decision: 70,
        positioning: 70,
        teamwork: 70,
      },
      mastery: 50,
      intent: "Idle" as const,
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
      cast_aim_x: 0,
      cast_aim_y: 0,
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
      ai_first_auto_done: false,
      zone_aura_res: 0,
      flank_buff_until: 0,
    };

    const prevX = unit.x - unit.vx * c.DT;
    const prevY = unit.y - unit.vy * c.DT;
    expect(Math.hypot(unit.x - orb.x, unit.y - orb.y)).toBeGreaterThan(pickupR);
    expect(Math.hypot(prevX - orb.x, prevY - orb.y)).toBeLessThanOrEqual(1e-9);

    const events: Array<{ type: string; unit_id?: string }> = [];
    const state = {
      t: 1.0,
      tick: 10,
      units: [unit],
      score_blue: 0,
      score_red: 0,
    } as unknown as import("../sim/types.js").MatchState;
    const config = { forced_clock_end: false } as unknown as import("../sim/types.js").MatchConfig;
    tickArenaPhase11(state, arena, c, config, (type, payload) => {
      events.push({ type, ...(payload as object) });
    });
    expect(events.filter((e) => e.type === "orb_pickup")).toHaveLength(0);
    expect(orb.up).toBe(true);
  });
});

describe("S3A20 — ahead finish at SUDDEN_DEATH_T+BO1_EXTRA_S is sudden_death", () => {
  it("when a team is ahead at the 4:45 boundary, reason is sudden_death not clock", () => {
    // Needle swaps the boundary reason to "clock". Mid-window sudden_death
    // fixtures stay green; this pins the exact ladder-end ahead path.
    // Score on the boundary tick itself so step (4) sees ahead before coin_flip.
    const r = runS3({
      T: 8,
      // Stay off the pad so zone_time / capture stay 0–0 through the ladder.
      units: {
        [BA]: { x: 4, y: 4, auto: false, spawn_shield_until: 0 },
        [RA]: { x: 20, y: 4, auto: false, spawn_shield_until: 0 },
      },
      constants: {
        MATCH_T: 4.0,
        SUDDEN_DEATH_T: 6.0,
        BO1_EXTRA_S: 2.0,
        SCORE_TO_WIN: 99,
      },
      damage: [killAt(80, BA, RA)], // t=8.0 exactly → ahead at boundary
    });
    const end = r.matchEnd()!;
    expect(end.t).toBeCloseTo(8.0, 6);
    expect(end.winner).toBe("blue");
    expect(end.reason).toBe("sudden_death");
  });
});

describe("S3A22 — no aura regen on the capture tick", () => {
  it("HP at the capture tick equals start + base regen only (no +1.5 aura)", () => {
    // Official R5-7 compares T=3.1 vs T=3.0 deltas (both shift under same-tick
    // aura). Pin absolute HP on the capture tick itself.
    const startHp = 200;
    const r = runS3({
      T: 3.0,
      units: { [BA]: placeInZone(BA, { hp: startHp, champ: "huntress" }) },
    });
    expect(r.of("zone_capture")[0]!.tick).toBe(30);
    const hp = r.unit(BA)!.hp;
    // 30 ticks of Huntress L1 regen 4/s → 0.4/tick; aura must not apply yet.
    const baseRegen = 30 * 0.4;
    expect(hp).toBeCloseTo(startHp + baseRegen, 1);
  });
});

describe("S3A23 — dwell resets on leave (continuous, not cumulative)", () => {
  it("a unit that leaves the zone mid-window must re-earn N continuous ticks to deny", () => {
    // Needle drops `z.dwell[u.id] = 0` on leave so dwell is cumulative.
    // RA stays for the full window; RM occupies, leaves one tick, returns —
    // with N=5 only RA denies.
    const r = runS3({
      T: 2.5,
      units: {
        [RA]: placeInZone(RA, {}, { x: 0.6 }),
        [RM]: placeInZone(RM, {}, { x: -0.6 }),
      },
      constants: { CLAIM_DELAY_S: 1.0, CLAIM_DENY_DWELL_S: 0.5 },
      claims: [{ tick: 5, team: "blue", fight_id: "dwell-reset" }],
      // Banish RM for ticks covering a leave gap after early occupation.
      // Present at start (ticks 1–3), banished ticks 4–12, present again 13–15.
      cc: [{ tick: 4, target: RM, kind: "banish", duration: 0.9 }],
    });
    const ev = r.of("claim_deny")[0]!;
    expect(ev).toBeDefined();
    const deniers = deniersOf(ev);
    expect(deniers).toContain(RA);
    expect(deniers).not.toContain(RM);
    expect(claimDeniesOf(r, RM)).toBe(0);
  });
});
