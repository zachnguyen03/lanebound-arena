import type { MatchConfig } from "./types.js";

/**
 * exp/orb-buff-cadence step 3 (not in the build spec): buffs every ~1 min with a
 * 10 s warning and team share, orbs in 20 s waves, rover AI. Applied on top of a
 * config; the lab's step3 arm and Watch's "Cadence" button both use this.
 */
export const CADENCE_EXPERIMENT: Pick<MatchConfig, "constants" | "cadence"> = {
  constants: { BUFF_FIRST_SPAWN_S: 35, BUFF_RESPAWN_S: 55, ORB_RESPAWN_S: 20, BUFF_DMG: 0.2, BUFF_MS: 0.15 },
  cadence: { rovers: true, orb_wave_s: 20, buff_share_r: 4, buff_warn_s: 10 },
};

/**
 * exp/teamfight-dynamics round 2: relaxed chase, ults from level 3 on a 0.7×
 * cooldown, per-kit casts aimed at ally-locked enemies, front/back formation.
 */
export const TEAMFIGHT_EXPERIMENT: NonNullable<MatchConfig["teamfight"]> = {
  chase: true,
  r_min_level: 3,
  r_cd_mult: 0.7,
  combo_target: true,
  formation: true,
};

/**
 * exp/teamfight-r3 recommended set (`tf3_keep`): round 2 + spacing, target cap,
 * ult timing, dodge, peel. Disengage stays off (its low-HP retreat stalls fights).
 */
export const TEAMFIGHT_R3: NonNullable<MatchConfig["teamfight"]> = {
  ...TEAMFIGHT_EXPERIMENT,
  spread: true,
  lanes: true,
  ranged_hold: true,
  target_cap: 3,
  ult_timing: true,
  dodge: true,
  peel: true,
};
