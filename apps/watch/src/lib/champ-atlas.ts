/**
 * Champion / dummy body atlas.
 * Loaders accept both key shapes:
 *   animations.idle["blue-right"]
 *   animations.idle.blue.right
 * and normalise to the flat "blue-right" variant map.
 */

export type Facing = "left" | "right";
export type BodyAnim = "idle" | "move" | "hit" | "death";

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

function isClip(v: unknown): v is BodyAnimClip {
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as BodyAnimClip).frames)
  );
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
      if (isClip(val)) {
        flat[key] = val;
        continue;
      }
      if (val && typeof val === "object") {
        for (const [facing, clip] of Object.entries(val as Record<string, unknown>)) {
          if (isClip(clip)) flat[`${key}-${facing}`] = clip;
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
