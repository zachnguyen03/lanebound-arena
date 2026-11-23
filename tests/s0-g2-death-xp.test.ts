import { describe, expect, it } from "vitest";
import { defaultEvenConfig, simulate } from "../sim/index.js";
import type { MatchConfig, UnitId } from "../sim/types.js";

describe("G2 death-tick XP order", () => {
  it("dead unit gets no time XP on death tick; kill/assist before time; level-ups after XP", () => {
    const killer = "blue:adc" as UnitId;
    const assist = "blue:mid" as UnitId;
    const victim = "red:adc" as UnitId;

    // Death on tick 5 (t=0.5). Killer starts at 100 XP so time alone (4×1.15) stays <140;
    // kill XP (45) on tick 5 pushes them over L2 in the same phase.
    const deathTick = 5;
    const cfg: MatchConfig = {
      ...defaultEvenConfig(20261122),
      notes: "G2 death-tick fixture",
      constants: { MATCH_T: 2.0 },
      unit_overrides: {
        // auto_next_start_t blocks natural autos so only scripted_damage applies.
        [killer]: { x: 12.0, y: 8.0, xp: 100, spawn_shield_until: 0, auto_next_start_t: 999 },
        [assist]: { x: 12.5, y: 8.0, spawn_shield_until: 0, auto_next_start_t: 999 },
        [victim]: { x: 13.0, y: 8.0, hp: 50, spawn_shield_until: 0, auto_next_start_t: 999 },
      },
      scripted_damage: [
        { tick: deathTick - 1, source_id: assist, target_id: victim, raw: 20 },
        { tick: deathTick, source_id: killer, target_id: victim, raw: 10_000 },
      ],
    };

    const r = simulate(cfg);
    const death = r.events.find((e) => e.type === "death" && e.unit_id === victim);
    expect(death).toBeDefined();
    expect(death!.tick).toBe(deathTick);
    expect(death!.killer_id).toBe(killer);
    expect(death!.assists).toEqual([assist]);

    const onDeathTick = r.events.filter((e) => e.tick === deathTick);
    const xpHere = onDeathTick.filter((e) => e.type === "xp_gain");
    const timeHere = xpHere.filter((e) => e.source === "time");
    const killHere = xpHere.filter((e) => e.source === "kill");
    const assistHere = xpHere.filter((e) => e.source === "assist");
    const levelsHere = onDeathTick.filter((e) => e.type === "level_up");

    // Victim: no time XP on death tick
    expect(timeHere.some((e) => e.unit_id === victim)).toBe(false);

    // Kill + assist granted
    expect(killHere).toHaveLength(1);
    expect(killHere[0]!.unit_id).toBe(killer);
    expect(killHere[0]!.amount).toBe(45);
    expect(assistHere).toHaveLength(1);
    expect(assistHere[0]!.unit_id).toBe(assist);
    expect(assistHere[0]!.amount).toBe(20);

    // Kill/assist seq before any time XP this tick
    const firstTimeSeq = Math.min(...timeHere.map((e) => e.seq as number));
    expect(killHere[0]!.seq).toBeLessThan(firstTimeSeq);
    expect(assistHere[0]!.seq).toBeLessThan(firstTimeSeq);

    // Level-ups after all XP this tick (killer ~104.6+45+1.15 ≥ 140 → L2)
    expect(levelsHere.some((e) => e.unit_id === killer && e.new_level === 2)).toBe(true);
    const lastXpSeq = Math.max(...xpHere.map((e) => e.seq as number));
    for (const lv of levelsHere) {
      expect(lv.seq).toBeGreaterThan(lastXpSeq);
    }

    const victimUnit = r.state.units.find((u) => u.id === victim)!;
    expect(victimUnit.alive).toBe(false);
  });
});
