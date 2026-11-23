/**
 * Heals and combat-heal window (§6.4).
 * Combat heal scale applies when the target has dealt or received damage
 * within COMBAT_HEAL_WINDOW_S.
 */
export function applyHeal(
  amount: number,
  opts: {
    now: number;
    last_damage_t: number;
    last_dealt_t: number;
    combat_window_s: number;
    combat_heal_scale: number;
  },
): { applied: number; in_combat: boolean } {
  const inCombat =
    opts.now - opts.last_damage_t <= opts.combat_window_s ||
    opts.now - opts.last_dealt_t <= opts.combat_window_s;
  const applied = inCombat ? amount * opts.combat_heal_scale : amount;
  return { applied, in_combat: inCombat };
}
