import type { WatchAssets } from "./assets";
import type { MatchViewState, UnitView } from "./types";

const TILE_W = 44;
const TILE_H = 32;
const BODY_W = 36;
const BODY_H = 48;
const ANCHOR_X = 18;
const ANCHOR_Y = 46;

/** Integer nearest-neighbour blit from sheet rect to destination. */
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
  const dx = Math.round(worldX - anchor[0]);
  const dy = Math.round(worldY - anchor[1]);
  blitNearest(ctx, sheet, sx, sy, sw, sh, dx, dy);
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

/**
 * Draw Layout B terrain + static props + y-sorted pillars/units into a
 * 1056×580 canvas. Gold only via zone / buff art from the CD sheet.
 */
export function renderArena(
  ctx: CanvasRenderingContext2D,
  assets: WatchAssets,
  state: MatchViewState,
): void {
  const W = 1056;
  const H = 580;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);

  // 1. Terrain
  blitNearest(ctx, assets.terrain, 0, 0, W, H, 0, 0, W, H);

  const sprites = assets.worldProps.sprites;
  const sheet = assets.propsSheet;

  // 2. Sanctuary washes + thresholds
  for (const key of [
    "sanctuary-wash-blue",
    "sanctuary-wash-red",
    "sanctuary-threshold-blue",
    "sanctuary-threshold-red",
  ] as const) {
    const s = sprites[key];
    if (s) blitPlaced(ctx, sheet, s);
  }

  // 3. Zone (neutral only in this shell — ownership is unrendered TODO)
  const zoneNeutral = sprites["zone-neutral"];
  if (zoneNeutral) blitPlaced(ctx, sheet, zoneNeutral);
  const zoneMark = sprites["zone-centre-mark"];
  if (zoneMark?.place_terrain_px) {
    blitPlaced(ctx, sheet, zoneMark);
  } else if (zoneMark) {
    const [cx, cy] = assets.worldProps.placements.zone.centre_px;
    blitSprite(ctx, sheet, zoneMark.rect, zoneMark.anchor, cx, cy);
  }

  // 4. Orb pads (empty down) + buff pads (down — buff.up is gold @ 1:30, unrendered until events)
  const orbDown = assets.worldProps.animations.orb?.down?.frames?.[0];
  if (orbDown) {
    for (const pad of assets.worldProps.placements.orb_pads) {
      blitSprite(
        ctx,
        sheet,
        orbDown.rect,
        orbDown.anchor,
        pad.ground_px[0],
        pad.ground_px[1],
      );
    }
  }
  const buffDown = assets.worldProps.animations.buff?.down?.frames?.[0];
  if (buffDown) {
    for (const pad of assets.worldProps.placements.buff_pads) {
      blitSprite(
        ctx,
        sheet,
        buffDown.rect,
        buffDown.anchor,
        pad.ground_px[0],
        pad.ground_px[1],
      );
    }
  }

  // 5. Units + pillars y-sorted
  const units = Object.values(state.units);
  type DrawItem =
    | { kind: "unit"; unit: UnitView; footY: number }
    | { kind: "pillar"; pillar: (typeof assets.pillars)[number]; footY: number };

  const items: DrawItem[] = [
    ...units.map((unit) => ({
      kind: "unit" as const,
      unit,
      footY: unit.y * TILE_H,
    })),
    ...assets.pillars.map((pillar) => ({
      kind: "pillar" as const,
      pillar,
      footY: pillar.sort_y_px,
    })),
  ];

  // Sort by foot Y; pillars draw after units with foot_y < sort_y (same as CD rule).
  items.sort((a, b) => {
    if (a.footY !== b.footY) return a.footY - b.footY;
    if (a.kind !== b.kind) return a.kind === "unit" ? -1 : 1;
    return 0;
  });

  for (const item of items) {
    if (item.kind === "pillar") {
      const p = item.pillar;
      const [sx, sy, sw, sh] = p.rect;
      const [dx, dy] = p.blit_at_terrain_px;
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

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(px, py, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Team ring
  ctx.strokeStyle = teamColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(px, py, 16, 7, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Labelled placeholder body (no CD dummy sheet in arena-sandbox pack)
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
  const label = unit.champ === "dummy" ? "DUMMY" : unit.champ.slice(0, 6).toUpperCase();
  ctx.fillText(label, px, top + BODY_H / 2 - 4);
  ctx.fillStyle = "#A1ACBF";
  ctx.font = "8px Barlow, sans-serif";
  ctx.fillText(`L${unit.level}`, px, top + BODY_H / 2 + 8);

  // Floating HP bar
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

export const ARENA_SIZE = { w: 1056, h: 580 } as const;
