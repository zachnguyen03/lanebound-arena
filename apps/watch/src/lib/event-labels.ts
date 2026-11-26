/** Human labels for sim event types shown in the event log. */

const LABELS: Record<string, string> = {
  match_start: "Match start",
  match_end: "Match end",
  xp_gain: "XP gain",
  level_up: "Level up",
  pos: "Position",
  move: "Move",
  hit: "Hit",
  heal: "Heal",
  death: "Death",
  respawn: "Respawn",
  cast_start: "Cast start",
  cast_cancel: "Cast cancel",
  projectile_spawn: "Projectile",
  shield_apply: "Shield",
  status_apply: "Status apply",
  status_expire: "Status expire",
  sleep_break: "Sleep break",
  dispel: "Dispel",
  orb_spawn: "Orb spawn",
  orb_pickup: "Orb pickup",
  buff_spawn: "Buff spawn",
  buff_pickup: "Buff pickup",
  zone_capture: "Zone capture",
  zone_tick: "Zone tick",
  claim_open: "Claim open",
  claim_award: "Claim award",
  claim_deny: "Claim deny",
  takedown_score: "Takedown score",
  fight_call: "Fight call",
  peel_start: "Peel start",
  spree: "Kill spree",
  shutdown: "Shutdown",
  anchor_start: "Anchor",
  anchor_end: "Anchor end",
  sweep: "Sweep",
  execute: "Execute",
};

export function eventTypeLabel(type: string): string {
  if (LABELS[type]) return LABELS[type]!;
  // Fallback: snake_case → Title case words
  return type
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
