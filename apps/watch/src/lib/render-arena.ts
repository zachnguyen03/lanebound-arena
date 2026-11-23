import type { WatchAssets } from "./assets";
import { sortDrawItems } from "./draw-order";
import { padGroundPx } from "./spawn";
import type { MatchViewState, UnitView } from "./types";
import { ARENA_INTRINSIC } from "./hud-layout";

const TILE_W = 44;
const TILE_H = 32;
const BODY_W = 36;
const BODY_H = 48;
const ANCHOR_X = 18;
const ANCHOR_Y = 46;

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
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);

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
      drawUnit(ctx, item.unit);
    }
  }
}

function drawUnit(ctx: CanvasRenderingContext2D, unit: UnitView): void {
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

  const left = Math.round(px - ANCHOR_X);
  const top = Math.round(py - ANCHOR_Y);
  ctx.fillStyle = unit.alive ? "#1A2130" : "#2A303C";
  ctx.fillRect(left, top, BODY_W, BODY_H);
  ctx.strokeStyle = teamColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(left + 1, top + 1, BODY_W - 2, BODY_H - 2);

  ctx.fillStyle = "#EEF2F8";
  ctx.font = "bold 9px Barlow, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label =
    unit.champ === "dummy" ? "DUMMY" : unit.champ.slice(0, 6).toUpperCase();
  ctx.fillText(label, px, top + BODY_H / 2 - 4);
  ctx.fillStyle = "#A1ACBF";
  ctx.font = "8px Barlow, sans-serif";
  ctx.fillText(`L${unit.level}`, px, top + BODY_H / 2 + 8);

  if (unit.alive) {
    const barW = 28;
    const barH = 3;
    const bx = Math.round(px - barW / 2);
    const by = top - 6;
    ctx.fillStyle = "#0B0E14";
    ctx.fillRect(bx, by, barW, barH);
    const frac = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
    ctx.fillStyle = teamColor;
    ctx.fillRect(bx, by, Math.round(barW * frac), barH);
  }
}

export const ARENA_SIZE = ARENA_INTRINSIC;
