import type { WatchAssets } from "./assets";
import {
  frameIndexAt,
  variantKey,
  type BodyAnimClip,
  type BodyFrame,
} from "./champ-atlas";
import { sortDrawItems } from "./draw-order";
import { ARENA_INTRINSIC } from "./hud-layout";
import { renderVfx, ultShakeAt } from "./render-vfx";
import { padGroundPx } from "./spawn";
import type { MatchViewState, UnitView } from "./types";

const TILE_W = 44;
const TILE_H = 32;
const ANCHOR_Y = 46;
const MOVE_EPS = 1e-4;
/** Terrain is 2×. Authored 18×24 cells blit at 36×48, an integer factor. */
const PLAY_SCALE = 2;

/** Integer nearest-neighbour blit. */
export function blitNearest(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw = sw,
  dh = sh,
): void {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    img,
    Math.round(sx),
    Math.round(sy),
    Math.round(sw),
    Math.round(sh),
    Math.round(dx),
    Math.round(dy),
    Math.round(dw),
    Math.round(dh),
  );
}

function blitSprite(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  rect: [number, number, number, number],
  anchor: [number, number],
  worldX: number,
  worldY: number,
): void {
  const [sx, sy, sw, sh] = rect;
  blitNearest(
    ctx,
    sheet,
    sx,
    sy,
    sw,
    sh,
    Math.round(worldX - anchor[0]),
    Math.round(worldY - anchor[1]),
  );
}

function blitPlaced(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  frame: {
    rect: [number, number, number, number];
    place_terrain_px?: [number, number];
  },
): void {
  if (!frame.place_terrain_px) return;
  const [sx, sy, sw, sh] = frame.rect;
  const [dx, dy] = frame.place_terrain_px;
  blitNearest(ctx, sheet, sx, sy, sw, sh, dx, dy);
}

export interface RenderArenaOpts {
  /** Canvas buffer height (580 full, or 520 for 720 plinth crop). */
  height?: number;
  /** View-only AI lines. Must not feed the sim. */
  overlays?: boolean;
  /** Skill cast VFX from atlas art. Default on. */
  vfx?: boolean;
}

/**
 * Draw Layout B into a canvas sized to the display (1056×580 or 1056×520).
 * Props use tile-centre ground points; units use sim poses from the log.
 */
export function renderArena(
  ctx: CanvasRenderingContext2D,
  assets: WatchAssets,
  state: MatchViewState,
  opts: RenderArenaOpts = {},
): void {
  const W = ARENA_INTRINSIC.w;
  const H = opts.height ?? ARENA_INTRINSIC.h;
  const showVfx = opts.vfx !== false;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);

  const shake = showVfx ? ultShakeAt(state) : { shakeX: 0, shakeY: 0 };

  ctx.save();
  if (shake.shakeX || shake.shakeY) {
    ctx.translate(Math.round(shake.shakeX), Math.round(shake.shakeY));
  }

  // Terrain (source may be taller than crop height — blit top H rows only)
  blitNearest(ctx, assets.terrain, 0, 0, W, H, 0, 0, W, H);

  const sprites = assets.worldProps.sprites;
  const sheet = assets.propsSheet;

  for (const key of [
    "sanctuary-wash-blue",
    "sanctuary-wash-red",
    "sanctuary-threshold-blue",
    "sanctuary-threshold-red",
  ] as const) {
    const s = sprites[key];
    if (s) blitPlaced(ctx, sheet, s);
  }

  const zoneNeutral = sprites["zone-neutral"];
  if (zoneNeutral) blitPlaced(ctx, sheet, zoneNeutral);
  const zoneMark = sprites["zone-centre-mark"];
  if (zoneMark?.place_terrain_px) {
    blitPlaced(ctx, sheet, zoneMark);
  } else if (zoneMark) {
    // Zone centre is geometric (12.0, 8.0), not a tile-index pad.
    const [cx, cy] = assets.worldProps.placements.zone.centre_px;
    blitSprite(ctx, sheet, zoneMark.rect, zoneMark.anchor, cx, cy);
  }

  const orbDown = assets.worldProps.animations.orb?.down?.frames?.[0];
  if (orbDown) {
    for (const pad of assets.worldProps.placements.orb_pads) {
      // Prefer atlas ground_px (already tile-centre); fall back to tileCentre.
      const g = pad.ground_px
        ? { px: pad.ground_px[0], py: pad.ground_px[1] }
        : padGroundPx(pad.tile[0], pad.tile[1]);
      blitSprite(ctx, sheet, orbDown.rect, orbDown.anchor, g.px, g.py);
    }
  }
  const buffDown = assets.worldProps.animations.buff?.down?.frames?.[0];
  if (buffDown) {
    for (const pad of assets.worldProps.placements.buff_pads) {
      const g = pad.ground_px
        ? { px: pad.ground_px[0], py: pad.ground_px[1] }
        : padGroundPx(pad.tile[0], pad.tile[1]);
      blitSprite(ctx, sheet, buffDown.rect, buffDown.anchor, g.px, g.py);
    }
  }

  const units = Object.values(state.units);
  const items = sortDrawItems([
    ...units.map((unit) => ({
      kind: "unit" as const,
      unit,
      footY: unit.y * TILE_H,
      id: unit.id,
    })),
    ...assets.pillars.map((pillar) => ({
      kind: "pillar" as const,
      pillar,
      footY: pillar.sort_y_px,
      id: pillar.id,
    })),
  ]);

  for (const item of items) {
    if (item.kind === "pillar") {
      const p = item.pillar;
      const [sx, sy, sw, sh] = p.rect;
      const [dx, dy] = p.blit_at_terrain_px;
      // Skip pillars whose blit is entirely below the crop.
      if (dy >= H) continue;
      blitNearest(ctx, assets.pillarsSheet, sx, sy, sw, sh, dx, dy);
    } else {
      drawUnit(ctx, assets, state, item.unit);
    }
  }

  ctx.imageSmoothingEnabled = false;
  for (const orb of state.orbs) {
    if (!orb.up) continue;
    const px = orb.x * TILE_W;
    const py = orb.y * TILE_H;
    if (py >= H) continue;
    ctx.fillStyle = "#F2C14E";
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.zoneOwner) {
    const c = assets.worldProps.placements.zone.centre_px;
    ctx.strokeStyle = state.zoneOwner === "blue" ? "#4DA3FF" : "#F5477A";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c[0], c[1], 44, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (opts.overlays) {
    ctx.lineWidth = 1;
    for (const unit of Object.values(state.units)) {
      if (!unit.targetId) continue;
      const tgt = state.units[unit.targetId as keyof typeof state.units];
      if (!tgt) continue;
      ctx.strokeStyle = unit.team === "blue" ? "#4DA3FF" : "#F5477A";
      ctx.beginPath();
      ctx.moveTo(unit.x * TILE_W, unit.y * TILE_H);
      ctx.lineTo(tgt.x * TILE_W, tgt.y * TILE_H);
      ctx.stroke();
    }
  }

  // Skill VFX over bodies, under / with status plates; shake already applied.
  if (showVfx) {
    renderVfx(ctx, assets, state, { height: H });
  }

  ctx.restore();
}

function clipDuration(clip: BodyAnimClip | undefined, fallback: number): number {
  if (!clip || clip.n <= 0) return fallback;
  return (clip.n * clip.ms) / 1000;
}

function findClip(
  animations: Record<string, Record<string, BodyAnimClip>>,
  name: string,
  variant: string,
): BodyAnimClip | undefined {
  const aliases: Record<string, string[]> = {
    move: ["move", "walk"],
    walk: ["walk", "move"],
    cast: ["cast", "skill"],
    skill: ["skill", "cast"],
    dash: ["dash", "skill", "cast"],
    attack: ["attack"],
  };
  const names = aliases[name] ?? [name];
  for (const n of names) {
    const clip = animations[n]?.[variant];
    if (clip && clip.frames.length > 0) return clip;
  }
  return undefined;
}

function pickBodyAnim(
  unit: UnitView,
  now: number,
  attackDurS: number,
  hitDurS: number,
): { name: string; startedAt: number } {
  if (!unit.alive && unit.deathStartedAt != null) {
    return { name: "death", startedAt: unit.deathStartedAt };
  }
  if (
    unit.alive &&
    unit.castStartedAt != null &&
    now - unit.castStartedAt < Math.max(unit.castDur, 0.2)
  ) {
    const skill = (unit.castSkill ?? "").toLowerCase();
    if (skill.includes("dash")) {
      return { name: "dash", startedAt: unit.castStartedAt };
    }
    if (skill === "auto" || skill === "attack") {
      return { name: "attack", startedAt: unit.castStartedAt };
    }
    return { name: "cast", startedAt: unit.castStartedAt };
  }
  if (
    unit.alive &&
    unit.attackStartedAt != null &&
    now - unit.attackStartedAt < attackDurS
  ) {
    return { name: "attack", startedAt: unit.attackStartedAt };
  }
  if (
    unit.alive &&
    unit.hitStartedAt != null &&
    now - unit.hitStartedAt < hitDurS
  ) {
    return { name: "hit", startedAt: unit.hitStartedAt };
  }
  const moving =
    Math.abs(unit.vx) > MOVE_EPS || Math.abs(unit.vy) > MOVE_EPS;
  if (moving) return { name: "move", startedAt: 0 };
  return { name: "idle", startedAt: 0 };
}

function drawBodyFrame(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  frame: BodyFrame,
  footX: number,
  footY: number,
  sourceScale: number,
): void {
  const [x, y, w, h] = frame.rect;
  const [ax, ay] = frame.anchor;
  blitNearest(
    ctx,
    sheet,
    x * sourceScale,
    y * sourceScale,
    w * sourceScale,
    h * sourceScale,
    Math.round(footX - ax * PLAY_SCALE),
    Math.round(footY - ay * PLAY_SCALE),
    w * PLAY_SCALE,
    h * PLAY_SCALE,
  );
}

function drawUnit(
  ctx: CanvasRenderingContext2D,
  assets: WatchAssets,
  state: MatchViewState,
  unit: UnitView,
): void {
  const px = unit.x * TILE_W;
  const py = unit.y * TILE_H;
  const teamColor = unit.team === "blue" ? "#4DA3FF" : "#F5477A";

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(px, py, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = teamColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(px, py, 16, 7, 0, 0, Math.PI * 2);
  ctx.stroke();

  const atlas = assets.bodyAtlases[unit.champ];
  const sheet = assets.bodySheets[unit.champ];
  const sourceScale = assets.sheetScale[unit.champ] ?? 1;
  if (atlas && sheet) {
    const variant = variantKey(unit.team, unit.facing);
    const attackClip = findClip(atlas.animations, "attack", variant);
    const hitClip = findClip(atlas.animations, "hit", variant);
    const { name, startedAt } = pickBodyAnim(
      unit,
      state.t,
      clipDuration(attackClip, 0.5),
      clipDuration(hitClip, 0.25),
    );
    const clip =
      findClip(atlas.animations, name, variant) ??
      findClip(atlas.animations, "idle", variant);
    if (name === "dash") {
      const after =
        assets.artImages[
          `${unit.champ}/sheets/dash-afterimage-${unit.team}.png`
        ];
      if (after) {
        ctx.globalAlpha = 0.4;
        drawBodyFrame(
          ctx,
          after,
          { i: 0, rect: [1, 1, 18, 24], anchor: [9, 23], hit: false },
          px - 8,
          py,
          1,
        );
        ctx.globalAlpha = 1;
      }
    }
    if (clip && clip.frames.length > 0) {
      const fi = frameIndexAt(clip, startedAt, state.t);
      const frame = clip.frames[fi] ?? clip.frames[clip.frames.length - 1]!;
      drawBodyFrame(ctx, sheet, frame, px, py, sourceScale);
    }
    const falcon = assets.artImages[`${unit.champ}/sheets/falcon.png`];
    if (falcon && unit.alive) {
      const fi = Math.floor(state.t * 8) % 3;
      drawBodyFrame(
        ctx,
        falcon,
        {
          i: fi,
          rect: [1 + fi * 11, 1, 10, 8],
          anchor: [5, 6],
          hit: false,
        },
        px + (fi - 1) * 8,
        py - 28,
        1,
      );
    }
  } else {
    // Explicit labelled circle — missing art, not a silent dummy swap.
    ctx.fillStyle = unit.alive ? "#1A2130" : "#2A303C";
    ctx.beginPath();
    ctx.arc(px, py - 16, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = teamColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#EEF2F8";
    ctx.font = "bold 8px Barlow, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(unit.champ.slice(0, 4).toUpperCase(), px, py - 16);
  }

  if (unit.alive) {
    const barW = 28;
    const barH = 3;
    const bx = Math.round(px - barW / 2);
    const by = Math.round(py - ANCHOR_Y - 6);
    ctx.fillStyle = "#0B0E14";
    ctx.fillRect(bx, by, barW, barH);
    const frac = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
    ctx.fillStyle = teamColor;
    ctx.fillRect(bx, by, Math.round(barW * frac), barH);
  }
}

export const ARENA_SIZE = ARENA_INTRINSIC;
