/**
 * Read-only skill lookup from authored kits for Watch VFX.
 * Does not call the sim; names/shapes/radii come from data/champions/kits.
 */
import {
  KITS,
  type AbilityDef,
  type AbilityShape,
} from "../../../../data/champions/kits";

export type SkillKey = "Q" | "W" | "R";

export type TelegraphKind = "line" | "aoe" | "self" | "dash";

export interface SkillMeta {
  champ: string;
  key: SkillKey;
  name: string;
  shape: AbilityShape;
  telegraph: TelegraphKind;
  range: number;
  radius: number;
  width: number;
  cast_s: number;
  land_delay_s: number;
}

const BY_NAME = new Map<string, SkillMeta>();

function telegraphFor(shape: AbilityShape): TelegraphKind {
  switch (shape) {
    case "line":
    case "cone":
    case "cone_target":
    case "streak":
    case "target":
    case "ally_target":
      return "line";
    case "circle_point":
    case "circle_target":
    case "circle_self":
    case "circle_ally":
      return "aoe";
    case "self_dash":
      return "dash";
    case "self":
    default:
      return "self";
  }
}

function indexKits(): void {
  if (BY_NAME.size > 0) return;
  for (const [champ, kit] of Object.entries(KITS)) {
    for (const key of ["Q", "W", "R"] as SkillKey[]) {
      const ab: AbilityDef = kit[key];
      const meta: SkillMeta = {
        champ,
        key,
        name: ab.name,
        shape: ab.shape,
        telegraph: telegraphFor(ab.shape),
        range: ab.range,
        radius: ab.radius ?? 0,
        width: ab.width ?? 0.6,
        cast_s: ab.cast_s,
        land_delay_s: ab.land_delay_s ?? 0,
      };
      BY_NAME.set(ab.name, meta);
    }
  }
}

/** Resolve a cast_start / hit skill_id (ability name) to kit metadata. */
export function skillMetaByName(skillId: string | null | undefined): SkillMeta | null {
  if (!skillId || skillId === "auto" || skillId === "attack") return null;
  indexKits();
  return BY_NAME.get(skillId) ?? null;
}

export function isUltimateSkill(skillId: string | null | undefined): boolean {
  return skillMetaByName(skillId)?.key === "R";
}

/** Status kinds drawn as icons over units. */
export const STATUS_ICON_KINDS = [
  "stun",
  "slow",
  "root",
  "silence",
  "taunt",
  "shield",
] as const;

export type StatusIconKind = (typeof STATUS_ICON_KINDS)[number];

export function isStatusIconKind(kind: string): kind is StatusIconKind {
  return (STATUS_ICON_KINDS as readonly string[]).includes(kind);
}
