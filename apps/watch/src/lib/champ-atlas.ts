/**
 * Champion / dummy body atlas.
 * Loaders accept both key shapes:
 *   animations.idle["blue-right"]
 *   animations.idle.blue.right
 * and normalise to the flat "blue-right" variant map.
 */

export type Facing = "left" | "right";
export type BodyAnim =
  | "idle"
  | "move"
  | "walk"
  | "hit"
  | "death"
  | "attack"
  | "cast"
  | "skill"
  | "dash";

export interface BodyFrame {
  i: number;
  rect: [number, number, number, number];
  anchor: [number, number];
  hit: boolean;
}

export interface BodyAnimClip {
  n: number;
  ms: number;
  fps: number;
  loop: boolean;
  frames: BodyFrame[];
}

export interface ChampAtlas {
  slug: string;
  cell: [number, number];
  anchor: [number, number];
  sheet: string;
  sheet_2x: string;
  scale: number;
  animations: Record<string, Record<string, BodyAnimClip>>;
}

/** Resolve walk → move. */
export function resolveAnimName(name: BodyAnim | "walk"): BodyAnim {
  return name === "walk" ? "move" : name;
}

export function variantKey(
  team: "blue" | "red",
  facing: Facing,
): string {
  return `${team}-${facing}`;
}

/**
 * Frame index from sim time. Non-looping clips hold the last frame.
 * `ms` is per-frame duration from the atlas.
 */
export function frameIndexAt(
  clip: BodyAnimClip,
  startedAt: number,
  now: number,
): number {
  const elapsed = Math.max(0, now - startedAt);
  const per = clip.ms / 1000;
  if (per <= 0) return 0;
  const raw = Math.floor(elapsed / per);
  if (clip.loop) return raw % clip.n;
  return Math.min(raw, clip.n - 1);
}

function asClip(raw: unknown): BodyAnimClip | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (!Array.isArray(v.frames)) return null;
  const frames: BodyFrame[] = v.frames.map((item, index) => {
    const fr = item as Record<string, unknown>;
    const rect = fr.rect as [number, number, number, number];
    const anchor = (
      Array.isArray(fr.anchor) ? fr.anchor : [9, 23]
    ) as [number, number];
    const i =
      typeof fr.i === "number"
        ? fr.i
        : typeof fr.index === "number"
          ? fr.index
          : index;
    return { i, rect, anchor, hit: fr.hit === true };
  });
  const fps = typeof v.fps === "number" && v.fps > 0 ? v.fps : 8;
  const ms =
    typeof v.ms === "number" && v.ms > 0 ? v.ms : Math.round(1000 / fps);
  const n = typeof v.n === "number" && v.n > 0 ? v.n : frames.length;
  return { n, ms, fps, loop: v.loop === true, frames };
}

/**
 * `skills.*.file` is a skill id (`q-latch-line`), not a path.
 * The bitmap is `icons/<id>.png`. A real path contains `/` or an extension.
 */
function skillIconPath(file: string): string | null {
  if (file.includes("/") || file.includes(".")) return null;
  if (!/^[a-z0-9-]+$/.test(file)) return null;
  return `icons/${file}.png`;
}

/**
 * Atlas `file` / `sheet` strings. Maelis `status.slow.file` is a note, not a path.
 * Skill ids resolve to `icons/<id>.png` and are never used as URLs.
 */
export function resolveAtlasFile(slug: string, file: string): string | null {
  const trimmed = file.trim();
  if (
    slug === "maelis" &&
    trimmed.includes("slow.png") &&
    /[\s()]/.test(trimmed)
  ) {
    return "vfx/slow.png";
  }
  if (/[\s()]/.test(trimmed)) return null;
  const rel = trimmed.replace(/^\.\//, "");
  return skillIconPath(rel) ?? rel;
}

/** Relative sheet paths referenced by an atlas, with the Maelis note resolved. */
export function collectAtlasFiles(slug: string, raw: unknown): string[] {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) {
        if (typeof item === "string") {
          const rel = resolveAtlasFile(slug, item);
          if (rel) out.push(rel);
        } else {
          walk(item);
        }
      }
      return;
    }
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      if ((key === "file" || key === "sheet") && typeof val === "string") {
        const rel = resolveAtlasFile(slug, val);
        if (rel) out.push(rel);
      } else if (key === "files" && Array.isArray(val)) {
        walk(val);
      } else {
        walk(val);
      }
    }
  };
  walk(raw);
  return [...new Set(out)];
}

/** Flatten either atlas key shape onto `animations[name]["team-facing"]`. */
export function normalizeChampAtlas(raw: unknown, slug: string): ChampAtlas {
  const src = raw as ChampAtlas;
  const animations: ChampAtlas["animations"] = {};
  const srcAnims = (src.animations ?? {}) as Record<string, unknown>;
  for (const [name, variants] of Object.entries(srcAnims)) {
    const flat: Record<string, BodyAnimClip> = {};
    if (!variants || typeof variants !== "object") continue;
    for (const [key, val] of Object.entries(variants as Record<string, unknown>)) {
      const direct = asClip(val);
      if (direct) {
        flat[key] = direct;
        continue;
      }
      if (val && typeof val === "object") {
        for (const [facing, clip] of Object.entries(val as Record<string, unknown>)) {
          const nested = asClip(clip);
          if (nested) flat[`${key}-${facing}`] = nested;
        }
      }
    }
    animations[name] = flat;
  }
  return {
    slug: src.slug || slug,
    cell: src.cell,
    anchor: src.anchor,
    sheet: src.sheet,
    sheet_2x: src.sheet_2x,
    scale: src.scale ?? 2,
    animations,
  };
}

/** Multiply 1× atlas rect/anchor for the 2× sheet. */
export function scaleFrame2x(frame: BodyFrame): BodyFrame {
  const [x, y, w, h] = frame.rect;
  const [ax, ay] = frame.anchor;
  return {
    i: frame.i,
    rect: [x * 2, y * 2, w * 2, h * 2],
    anchor: [ax * 2, ay * 2],
    hit: frame.hit,
  };
}
