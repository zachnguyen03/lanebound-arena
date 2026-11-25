/**
 * Parse champion atlas `vfx` blocks and resolve team/facing art.
 * Bitmaps are never altered — only selected and blitted.
 */
import type { Facing, Team } from "./types";

export type VfxEntry = Record<string, unknown>;

export interface VfxStripFrame {
  frame: number;
  file: string;
  offset_from_anchor?: [number, number];
  layer?: string;
}

export interface ResolvedSprite {
  key: string;
  /** Path relative to champion root, e.g. vfx/slow.png */
  file: string;
  /** Optional source rect on a sheet (huntress vfx-sheet). */
  rect?: [number, number, number, number];
  anchor?: [number, number];
  /** Cell size when the file is a strip. */
  cell?: [number, number];
  frames?: number;
  frame_size?: [number, number];
  origin_in_frame?: [number, number];
  duration_ms?: number;
  procedural?: string;
  note?: string;
  offset_from_foot?: [number, number];
  offset_from_anchor?: [number, number];
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Pick a path from a files list using team + facing when names encode them. */
export function pickVariantFile(
  files: string[],
  team: Team,
  facing: Facing,
): string | null {
  if (files.length === 0) return null;
  const wantTeam = team;
  const wantFace = facing;
  const scored = files.map((f) => {
    const name = f.toLowerCase();
    let score = 0;
    if (name.includes(wantTeam)) score += 2;
    if (name.includes(wantFace)) score += 2;
    if (name.includes("blue") || name.includes("red")) {
      if (!name.includes(wantTeam)) score -= 1;
    }
    if (name.includes("left") || name.includes("right")) {
      if (!name.includes(wantFace)) score -= 1;
    }
    return { f, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.f ?? files[0]!;
}

function fileList(entry: VfxEntry): string[] {
  if (typeof entry.file === "string") return [entry.file];
  if (Array.isArray(entry.files)) {
    return entry.files
      .map((item) => {
        if (typeof item === "string") return item;
        const r = asRecord(item);
        return r && typeof r.file === "string" ? r.file : null;
      })
      .filter((x): x is string => !!x);
  }
  return [];
}

export function smearFrames(entry: VfxEntry): VfxStripFrame[] {
  if (!Array.isArray(entry.files)) return [];
  const out: VfxStripFrame[] = [];
  for (const item of entry.files) {
    const r = asRecord(item);
    if (!r || typeof r.file !== "string") continue;
    out.push({
      frame: typeof r.frame === "number" ? r.frame : out.length,
      file: r.file,
      offset_from_anchor: Array.isArray(r.offset_from_anchor)
        ? (r.offset_from_anchor as [number, number])
        : undefined,
      layer: typeof r.layer === "string" ? r.layer : undefined,
    });
  }
  return out;
}

export function resolveVfxEntry(
  key: string,
  entry: VfxEntry,
  team: Team,
  facing: Facing,
): ResolvedSprite | null {
  if (typeof entry.procedural === "string" && !entry.file && !entry.files) {
    return {
      key,
      file: "",
      procedural: entry.procedural,
      note: typeof entry.note === "string" ? entry.note : undefined,
    };
  }
  const files = fileList(entry);
  const file = files.length ? pickVariantFile(files, team, facing) : null;
  if (!file && !Array.isArray(entry.frames) && !entry.rect) {
    return null;
  }
  const rect = Array.isArray(entry.rect)
    ? (entry.rect as [number, number, number, number])
    : undefined;
  const anchor = Array.isArray(entry.anchor)
    ? (entry.anchor as [number, number])
    : undefined;
  const cell = Array.isArray(entry.cell)
    ? (entry.cell as [number, number])
    : undefined;
  const frame_size = Array.isArray(entry.frame_size)
    ? (entry.frame_size as [number, number])
    : undefined;
  const origin_in_frame = Array.isArray(entry.origin_in_frame)
    ? (entry.origin_in_frame as [number, number])
    : undefined;
  const offset_from_foot = Array.isArray(entry.offset_from_foot)
    ? (entry.offset_from_foot as [number, number])
    : undefined;
  return {
    key,
    file: file ?? "",
    rect,
    anchor,
    cell,
    frames: typeof entry.frames === "number" ? entry.frames : undefined,
    frame_size,
    origin_in_frame,
    duration_ms:
      typeof entry.duration_ms === "number" ? entry.duration_ms : undefined,
    procedural:
      typeof entry.procedural === "string" ? entry.procedural : undefined,
    note: typeof entry.note === "string" ? entry.note : undefined,
    offset_from_foot,
  };
}

/** Status plate / ground icon keys preferred per kind (first hit wins). */
const STATUS_KEYS: Record<string, string[]> = {
  stun: ["stun-plate"],
  knockup: ["stun-plate"],
  slow: ["slow", "slow-plate"],
  root: ["root", "leash-plate"],
  silence: ["silence-plate"],
  taunt: ["taunt-plate"],
  shield: ["sluice-ward", "ward-bubble"],
  sleep: ["sleep-icon"],
  fear: ["fear-plate"],
  hex: ["hex-plate", "hex-jar"],
  break: ["break-plate"],
  banish: ["banish-plate"],
  timestop: ["timestop-plate"],
  petrify: ["petrify-plate"],
  leash: ["leash-plate"],
};

export function statusVfxKeys(kind: string): string[] {
  return STATUS_KEYS[kind] ?? [`${kind}-plate`, kind];
}

export function getVfxBlock(
  vfxAtlases: Record<string, Record<string, VfxEntry>>,
  champ: string,
): Record<string, VfxEntry> | null {
  return vfxAtlases[champ] ?? null;
}

export function lookupVfx(
  vfxAtlases: Record<string, Record<string, VfxEntry>>,
  champ: string,
  key: string,
  team: Team,
  facing: Facing,
): ResolvedSprite | null {
  const block = getVfxBlock(vfxAtlases, champ);
  if (!block) return null;
  const entry = block[key];
  if (!entry) return null;
  return resolveVfxEntry(key, entry, team, facing);
}

/** Parse raw atlas JSON `vfx` into a flat entry map. */
export function parseVfxBlock(raw: unknown): Record<string, VfxEntry> {
  const root = asRecord(raw);
  if (!root) return {};
  const vfx = asRecord(root.vfx);
  if (!vfx) return {};
  const out: Record<string, VfxEntry> = {};
  for (const [k, val] of Object.entries(vfx)) {
    const e = asRecord(val);
    if (e) out[k] = e;
  }
  return out;
}
