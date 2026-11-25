/**
 * View-only VFX tuning (public/vfx-tuning.json). Never touches the sim.
 *
 * Keys, most specific wins: "*" < "<champ>" < "<champ>:<Q|W|R|auto>".
 * Fields are all optional:
 *   scale   multiplier on the default draw scale (1 = as authored)
 *   dx, dy  screen-pixel offset
 *   alpha   0..1
 *   timeMul playback speed for frame strips (hit sparks, smears)
 *   leadS   ults only: shift the hit frame later (+) or earlier (-) in seconds
 */
import { skillMetaByName } from "./skill-meta";

export interface VfxTune {
  scale?: number;
  dx?: number;
  dy?: number;
  alpha?: number;
  timeMul?: number;
  leadS?: number;
}

export type ResolvedTune = Required<VfxTune>;

const DEFAULT: ResolvedTune = { scale: 1, dx: 0, dy: 0, alpha: 1, timeMul: 1, leadS: 0 };

/** Live table. The gallery mutates it in place; the renderer reads it every frame. */
export const VFX_TUNING: Record<string, VfxTune> = {};

export async function loadVfxTuning(): Promise<void> {
  try {
    const res = await fetch("/vfx-tuning.json");
    if (!res.ok) return;
    const json = (await res.json()) as Record<string, VfxTune>;
    for (const k of Object.keys(VFX_TUNING)) delete VFX_TUNING[k];
    Object.assign(VFX_TUNING, json);
  } catch {
    // No file / bad JSON: defaults.
  }
}

export function tuneKey(champ: string, skillId: string | null, isAuto = false): string {
  if (isAuto) return `${champ}:auto`;
  return `${champ}:${skillMetaByName(skillId)?.key ?? skillId ?? "?"}`;
}

export function tuneFor(champ: string, skillId: string | null, isAuto = false): ResolvedTune {
  return {
    ...DEFAULT,
    ...VFX_TUNING["*"],
    ...VFX_TUNING[champ],
    ...VFX_TUNING[tuneKey(champ, skillId, isAuto)],
  };
}
