/**
 * S3-R5-11 (build L1976 / L144) — phase-9 order:
 * tick existing → expire → apply new CC (kit + scripted) without ticking them.
 * Duration D on tick t covers ticks t .. t+round(10D)-1.
 */
import { describe, expect, it } from "vitest";
import { applyPendingStatuses } from "../sim/cast.js";
import { mergeConstants } from "../sim/constants.js";
import { defaultEvenConfig, simulate } from "../sim/index.js";
import { isBanished, tickStatuses } from "../sim/status.js";
import type { MatchConfig, MatchState, UnitId } from "../sim/types.js";

const SRC = "blue:jungle" as UnitId;
const VICTIM = "red:mid" as UnitId;

function short(partial: Partial<MatchConfig> = {}): MatchConfig {
  return {
    ...defaultEvenConfig(7),
    ai_enabled: false,
    forced_clock_end: true,
    ...partial,
    constants: { MATCH_T: 2.5, ...(partial.constants as object) },
  };
}

describe("S3-R5-11 phase-9 order (L1976 / L144)", () => {
  it("2.0 s kit banish on tick 1 covers ticks 1–20 and is gone at 21", () => {
    // Kit path = pending_status → applyPendingStatuses (not lab scripted_cc).
    // Seed units via a 1-tick sim, then continue phase-9 by hand in the ruled order.
    const c = mergeConstants({ MATCH_T: 2.5 });
    const seed = simulate(
      short({
        constants: { MATCH_T: 0.1 },
        unit_overrides: {
          [SRC]: { champ: "tolle", x: 12, y: 8, spawn_shield_until: 0, auto_next_start_t: 999 },
          [VICTIM]: { x: 12.5, y: 8, spawn_shield_until: 0, auto_next_start_t: 999 },
        },
      }),
    );
    const state = seed.state as MatchState;
    state.ended = false;
    state.end_reason = null;
    state.pending_status = [];
    const victim = state.units.find((u) => u.id === VICTIM)!;
    // Clear any leftover effects from the seed tick.
    victim.status.effects = [];

    const emits: Array<{ type: string; kind?: string }> = [];
    const emit = (type: string, payload: Record<string, unknown>) => {
      emits.push({ type, kind: payload.kind as string | undefined });
    };

    const covered: number[] = [];
    for (let tick = 1; tick <= 21; tick++) {
      state.tick = tick;
      state.t = tick * c.DT;
      for (const u of state.units) {
        if (!u.alive) continue;
        const paused = u.status.effects.some((e) => e.kind === "timestop" && e.remaining > 0);
        tickStatuses(u.status, c.DT, paused);
      }
      if (tick === 1) {
        state.pending_status.push({
          seq: 1,
          source_id: SRC,
          target_id: VICTIM,
          kind: "banish",
          category: "lock",
          raw_duration: 2.0,
          school: "magic",
          skill_id: "test-kit-banish",
        });
      }
      applyPendingStatuses(state, c, emit);
      if (isBanished(victim.status)) covered.push(tick);
    }

    expect(covered).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(isBanished(victim.status)).toBe(false);
    expect(emits.some((e) => e.type === "status_apply" && e.kind === "banish")).toBe(true);
  });

  it("lab scripted_cc shares the same order: 2.0 s banish on tick 1 covers 1–20, gone at 21", () => {
    const r = simulate(
      short({
        constants: { MATCH_T: 2.2 },
        unit_overrides: {
          [SRC]: { x: 12, y: 8, spawn_shield_until: 0, auto_next_start_t: 999 },
          [VICTIM]: { x: 12.5, y: 8, spawn_shield_until: 0, auto_next_start_t: 999 },
        },
        scripted_cc: [{ tick: 1, target_id: VICTIM, kind: "banish", duration: 2.0, source_id: SRC }],
      }),
    );
    const apply = r.events.find(
      (e) => e.type === "status_apply" && e.kind === "banish" && e.target_id === VICTIM,
    );
    expect(apply).toBeTruthy();
    expect(apply!.tick).toBe(1);
    expect(apply!.applied_duration).toBeCloseTo(2.0, 6);

    const exp = r.events.find(
      (e) => e.type === "status_expire" && e.kind === "banish" && e.target_id === VICTIM,
    );
    expect(exp).toBeTruthy();
    // Expires in phase-9 tick-down of tick 21 → present through tick 20.
    expect(exp!.tick).toBe(21);
  });
});
