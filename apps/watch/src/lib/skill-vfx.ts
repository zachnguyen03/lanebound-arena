/**
 * Per-champion skill VFX recipes from Chief Designer notes + atlas `vfx` keys.
 * Notes live in /cursor/stores/bot/lanebound-vfx-notes/<slug>-notes.md.
 */
import type { SkillKey } from "./skill-meta";
import { skillMetaByName } from "./skill-meta";

export type TelegraphStyle =
  | "line"
  | "aoe"
  | "cone"
  | "self"
  | "dash"
  | "dotted-leash"
  | "double-ring"
  | "none";

export interface SkillVfxRecipe {
  telegraph: TelegraphStyle;
  /** Atlas vfx key for the in-flight projectile (team/facing resolved later). */
  projectile?: string;
  /** Huntress sheet-rect projectile style. */
  huntressProjectile?: "basic" | "skill";
  /** Melee smear atlas key keyed by body frame. */
  smear?: string;
  /** Impact strip keys (sparks/dust) on skill hit. */
  impact?: string[];
  /** Ground / ring procedural id when atlas marks procedural. */
  groundFx?: string;
  /** Extra trail: bronze leash (Kerrig), chain (Tolle), etc. */
  trail?: "bronze-leash" | "iron-chain" | "spark";
  /** Stronger R cast pulse. */
  ultEmphasis?: boolean;
}

/** Default recipe from kit shape when no champ-specific row exists. */
function defaultRecipe(skillId: string): SkillVfxRecipe {
  const meta = skillMetaByName(skillId);
  if (!meta) return { telegraph: "line" };
  const telegraph: TelegraphStyle =
    meta.telegraph === "aoe"
      ? "aoe"
      : meta.telegraph === "dash"
        ? "dash"
        : meta.telegraph === "self"
          ? "self"
          : "line";
  return {
    telegraph,
    ultEmphasis: meta.key === "R",
  };
}

/**
 * Authored recipes. Keys are champion slug → skill key.
 * Projectile/smear/plate names match atlas.json `vfx` keys.
 */
const RECIPES: Record<string, Partial<Record<SkillKey, SkillVfxRecipe>>> = {
  kerrig: {
    Q: {
      telegraph: "line",
      projectile: "latch",
      trail: "bronze-leash",
    },
    W: {
      telegraph: "aoe",
      smear: "spool-cut-smear",
      impact: ["sparks", "dust"],
    },
    R: {
      telegraph: "dotted-leash",
      smear: "reeling-cut-smear",
      impact: ["sparks", "dust"],
      trail: "bronze-leash",
      ultEmphasis: true,
    },
  },
  huntress: {
    Q: { telegraph: "line", huntressProjectile: "skill" },
    W: { telegraph: "dash" },
    R: { telegraph: "aoe", huntressProjectile: "skill", ultEmphasis: true },
  },
  sedge: {
    Q: { telegraph: "cone", groundFx: "lantern-arc" },
    W: { telegraph: "line", projectile: "projectile-wick" },
    R: { telegraph: "aoe", projectile: "tick-mote", ultEmphasis: true },
  },
  ysol: {
    Q: { telegraph: "cone", groundFx: "kiln-bell-cone", projectile: "ember-note" },
    W: { telegraph: "self", groundFx: "mend-ring" },
    R: { telegraph: "aoe", groundFx: "vowbreak-cracks", ultEmphasis: true },
  },
  rhedan: {
    Q: { telegraph: "cone", smear: "tide-cleave-smear", impact: ["sparks", "dust"] },
    W: { telegraph: "line", projectile: "hook" },
    R: {
      telegraph: "aoe",
      smear: "keelbreak-smear",
      impact: ["sparks", "dust"],
      groundFx: "ground-cracks",
      ultEmphasis: true,
    },
  },
  torun: {
    Q: {
      telegraph: "aoe",
      smear: "shell-slam-smear",
      impact: ["sparks", "dust"],
      groundFx: "ground-cracks",
    },
    W: { telegraph: "aoe", projectile: "sluice-ward" },
    R: { telegraph: "aoe", groundFx: "lock-tide", ultEmphasis: true },
  },
  helvar: {
    Q: { telegraph: "line", projectile: "stoneverse" },
    W: { telegraph: "line", groundFx: "faultline" },
    R: { telegraph: "line", groundFx: "cliffwake", ultEmphasis: true },
  },
  maelis: {
    Q: { telegraph: "line", projectile: "prism" },
    W: { telegraph: "aoe", projectile: "veil-shard" },
    R: { telegraph: "aoe", projectile: "duskburst", ultEmphasis: true },
  },
  brannoch: {
    Q: { telegraph: "line", projectile: "quarry-block" },
    W: { telegraph: "dash", impact: ["sparks", "dust"] },
    R: { telegraph: "aoe", groundFx: "stonefast-cracks", ultEmphasis: true },
  },
  calder: {
    Q: { telegraph: "cone", groundFx: "ashbreath", projectile: "cinder" },
    W: { telegraph: "self", projectile: "heal-motes" },
    R: { telegraph: "aoe", groundFx: "ash-panic", ultEmphasis: true },
  },
  saelo: {
    Q: { telegraph: "line", projectile: "second-hand" },
    W: { telegraph: "self" },
    R: { telegraph: "double-ring", groundFx: "still-field", ultEmphasis: true },
  },
  tolle: {
    Q: { telegraph: "aoe", projectile: "bucket", trail: "iron-chain" },
    W: { telegraph: "line", projectile: "bucket", trail: "iron-chain" },
    R: { telegraph: "double-ring", groundFx: "upwelling", ultEmphasis: true },
  },
  mirren: {
    Q: { telegraph: "aoe", projectile: "glaze-glob" },
    W: { telegraph: "line", projectile: "clay-lid" },
    R: { telegraph: "aoe", ultEmphasis: true },
  },
  isra: {
    Q: {
      telegraph: "aoe",
      projectile: "mortar-shell",
      groundFx: "ground-ring",
      trail: "spark",
    },
    W: { telegraph: "dash" },
    R: {
      telegraph: "double-ring",
      projectile: "mortar-shell",
      groundFx: "ground-ring",
      trail: "spark",
      ultEmphasis: true,
    },
  },
};

export function skillVfxRecipe(
  champ: string,
  skillId: string,
): SkillVfxRecipe {
  const meta = skillMetaByName(skillId);
  const base = defaultRecipe(skillId);
  if (!meta) return base;
  const row = RECIPES[champ]?.[meta.key];
  if (!row) return base;
  return { ...base, ...row, ultEmphasis: row.ultEmphasis ?? meta.key === "R" };
}

/** Auto-attack projectile atlas key hints. */
export function autoProjectileKey(champ: string): string | null {
  const map: Record<string, string> = {
    huntress: "projectile-basic",
    maelis: "shard",
    mirren: "clay-pellet",
    saelo: "tick",
    ysol: "ember-note",
    sedge: "tick-mote",
    helvar: "chip",
    isra: "mortar-shell",
  };
  return map[champ] ?? null;
}
