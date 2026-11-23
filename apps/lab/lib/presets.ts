/**
 * Named constants presets (§8.3). Local JSON only.
 */
import { mergeConstants } from "../../../sim/constants.js";
import { constantsHash } from "../../../sim/canonical.js";
import {
  defaultConstantsSnapshot,
  diffVsDefault,
  validateOverrides,
} from "./constants-meta.js";
import type { ConstantsPreset } from "./types.js";

export function createPreset(
  name: string,
  overrides: Record<string, unknown>,
  note?: string,
): ConstantsPreset {
  const clean = validateOverrides(overrides);
  return {
    name,
    parent: "default",
    overrides: clean,
    ...(note ? { created_note: note } : {}),
  };
}

/** Apply preset onto §15 defaults (or parent overrides if nested later). */
export function applyPreset(
  preset: ConstantsPreset,
): Record<string, unknown> {
  const clean = validateOverrides(preset.overrides);
  const merged = mergeConstants(clean);
  return { ...defaultConstantsSnapshot(), ...Object.fromEntries(
    Object.keys(clean).map((k) => [k, (merged as unknown as Record<string, unknown>)[k]]),
  ) };
}

export function presetToMatchOverrides(
  preset: ConstantsPreset,
): Record<string, unknown> {
  return validateOverrides(preset.overrides);
}

export function presetDiff(preset: ConstantsPreset) {
  const effective = applyPreset(preset);
  return diffVsDefault(effective);
}

export function presetConstantsHash(preset: ConstantsPreset): string {
  return constantsHash(mergeConstants(validateOverrides(preset.overrides)));
}

export function parsePresetJson(text: string): ConstantsPreset {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Preset JSON is not valid JSON");
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Preset must be an object");
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== "string" || !o.name.trim()) {
    throw new Error("Preset.name is required");
  }
  if (o.parent !== undefined && o.parent !== "default" && typeof o.parent !== "string") {
    throw new Error("Preset.parent must be a string");
  }
  if (typeof o.overrides !== "object" || o.overrides === null || Array.isArray(o.overrides)) {
    throw new Error("Preset.overrides must be an object");
  }
  const overrides = validateOverrides(o.overrides as Record<string, unknown>);
  return {
    name: o.name.trim(),
    parent: (o.parent as string) || "default",
    overrides,
    ...(typeof o.created_note === "string"
      ? { created_note: o.created_note }
      : {}),
  };
}

export function serializePreset(preset: ConstantsPreset): string {
  return `${JSON.stringify(preset, null, 2)}\n`;
}
