/** Champion / dummy body atlas (Maelis-style animations[name][variant]). */

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
