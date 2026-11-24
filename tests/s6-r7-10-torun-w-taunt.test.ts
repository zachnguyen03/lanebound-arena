/**
 * R7-10: Torun W is shield-only as an AI class, but the kit's 2.0 s taunt on a
 * diver inside r 1.2 must still apply, emit status_apply, and count as hard CC.
 */
import { describe, expect, it } from "vitest";
import { defaultEvenConfig, simulate } from "../sim/index.js";
import type { MatchConfig, UnitId } from "../sim/types.js";

describe("R7-10 Torun W peel taunt", () => {
  it("scripted Torun W on a carry with a diver in r 1.2 emits taunt status_apply", () => {
    const torun = "blue:jungle" as UnitId;
    const carry = "blue:adc" as UnitId;
    const diver = "red:mid" as UnitId;
    const cfg: MatchConfig = {
      ...defaultEvenConfig(20261122),
      ai_enabled: false,
      forced_clock_end: true,
      constants: { MATCH_T: 2.0 },
      unit_overrides: {
        [torun]: {
          champ: "torun",
          x: 10,
          y: 8,
          spawn_shield_until: 0,
          auto_next_start_t: 999,
        },
        [carry]: {
          champ: "huntress",
          x: 12,
          y: 8,
          spawn_shield_until: 0,
          auto_next_start_t: 999,
        },
        [diver]: {
          champ: "kerrig",
          x: 12.5,
          y: 8,
          spawn_shield_until: 0,
          auto_next_start_t: 999,
          ai_target_id: carry,
        },
      },
      scripted_casts: [
        {
          tick: 2,
          source_id: torun,
          skill: "W",
          target_id: carry,
          force_hit: true,
        },
      ],
    };
    const r = simulate(cfg);
    const taunt = r.events.filter(
      (e) => e.type === "status_apply" && e.kind === "taunt" && e.target_id === diver,
    );
    expect(taunt.length).toBeGreaterThanOrEqual(1);
    expect(taunt[0]!.source_id).toBe(torun);
    expect(Number(taunt[0]!.applied_duration ?? taunt[0]!.raw_duration)).toBeCloseTo(2.0, 5);
  });
});
