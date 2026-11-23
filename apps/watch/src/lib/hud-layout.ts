/**
 * Positions from arena-sandbox/hud/hud-layout.json — pixel-exact, no CSS scale.
 * When the 1080 event drawer is open, the stage is rebuilt to fit the remaining
 * width (flex column) so rails + 1:1 map stay in-viewport — no translateX.
 */

export type HudMode = "1080" | "720";

export type Rect = readonly [x: number, y: number, w: number, h: number];

export interface HudLayout {
  canvas: readonly [number, number];
  top_bar: Rect;
  left_rail: Rect;
  right_rail: Rect;
  dock: Rect;
  playfield_region: Rect;
  arena_map: Rect;
  kill_feed: Rect;
  banner_slot: Rect;
  card_toast_slot: Rect;
  team_frames: {
    size: readonly [number, number];
    gap: number;
    blue_x: number;
    red_x: number;
    y0: number;
  };
  dock_panels: {
    zone: Rect;
    pickups: Rect;
    fight_call: Rect;
    watch_transport: Rect;
    kill_feed?: Rect;
  };
}

export const ARENA_INTRINSIC = { w: 1056, h: 580 } as const;
/** 720: plinth cropped to 8 px → visible map height 520. */
export const ARENA_720_CROP_H = 520;

export const DRAWER_W = 320;
export const MIN_VIEWPORT = { w: 1280, h: 720 } as const;

const MAP_W = ARENA_INTRINSIC.w;
const MAP_H = ARENA_INTRINSIC.h;
const KILL_FEED_W = 216;
const KILL_FEED_H = 136;

/** Canonical 1920×1080 layout (matches hud-layout.json) — kept byte-exact. */
const HUD_1080_CANONICAL: HudLayout = {
  canvas: [1920, 1080],
  top_bar: [0, 0, 1920, 56],
  left_rail: [0, 56, 200, 856],
  right_rail: [1720, 56, 200, 856],
  dock: [0, 912, 1920, 168],
  playfield_region: [200, 56, 1520, 856],
  arena_map: [432, 194, 1056, 580],
  kill_feed: [1496, 194, 216, 136],
  banner_slot: [804, 64, 312, 44],
  card_toast_slot: [750, 800, 420, 72],
  team_frames: {
    size: [200, 120],
    gap: 8,
    blue_x: 0,
    red_x: 1720,
    y0: 168,
  },
  dock_panels: {
    zone: [16, 920, 440, 152],
    pickups: [464, 920, 480, 152],
    fight_call: [952, 920, 380, 152],
    watch_transport: [1340, 920, 564, 152],
  },
};

/**
 * Build a 1080-tall stage of width `stageW`.
 * Rail width 200 matches hud-layout.json; 112 is used when the drawer
 * consumes 320 px so 112+1056+112=1280 fits in the remaining 1600.
 */
export function build1080Layout(
  stageW: number,
  railW: 200 | 112 = 200,
): HudLayout {
  if (stageW === 1920 && railW === 200) return HUD_1080_CANONICAL;

  const H = 1080;
  const topH = 56;
  const dockH = 168;
  const dockY = H - dockH;
  const playfieldW = stageW - 2 * railW;
  const playfieldH = H - topH - dockH;
  const mapX = railW + Math.floor((playfieldW - MAP_W) / 2);
  const mapY = 194;
  const mapEnd = mapX + MAP_W;
  const rightRailX = stageW - railW;
  const gapAfterMap = rightRailX - mapEnd;
  const killInMargin = gapAfterMap >= KILL_FEED_W + 8;

  const frameH = railW >= 200 ? 120 : 96;
  const frameGap = railW >= 200 ? 8 : 6;
  const frameY0 = railW >= 200 ? 168 : 56;

  const kill_feed: Rect = killInMargin
    ? [mapEnd + 8, mapY, KILL_FEED_W, KILL_FEED_H]
    : [0, 0, 0, 0]; // unused; dock_panels.kill_feed used instead

  // Dock: pack zone / pickups / (kill) / fight / transport across stageW.
  const dockPad = 8;
  const killDock = !killInMargin;
  const slots = killDock ? 5 : 4;
  const inner = stageW - dockPad * 2;
  const gap = 8;
  const cell = Math.floor((inner - gap * (slots - 1)) / slots);
  let x = dockPad;
  const zone: Rect = [x, dockY + 8, cell, dockH - 16];
  x += cell + gap;
  const pickups: Rect = [x, dockY + 8, cell, dockH - 16];
  x += cell + gap;
  let dockKill: Rect | undefined;
  if (killDock) {
    dockKill = [x, dockY + 8, cell, dockH - 16];
    x += cell + gap;
  }
  const fight_call: Rect = [x, dockY + 8, cell, dockH - 16];
  x += cell + gap;
  const watch_transport: Rect = [
    x,
    dockY + 8,
    stageW - dockPad - x,
    dockH - 16,
  ];

  const bannerW = Math.min(312, Math.floor(stageW * 0.2));
  const toastW = Math.min(420, Math.floor(stageW * 0.28));

  return {
    canvas: [stageW, H],
    top_bar: [0, 0, stageW, topH],
    left_rail: [0, topH, railW, playfieldH],
    right_rail: [rightRailX, topH, railW, playfieldH],
    dock: [0, dockY, stageW, dockH],
    playfield_region: [railW, topH, playfieldW, playfieldH],
    arena_map: [mapX, mapY, MAP_W, MAP_H],
    kill_feed: killInMargin
      ? kill_feed
      : (dockKill as Rect),
    banner_slot: [
      Math.floor((stageW - bannerW) / 2),
      topH + 8,
      bannerW,
      railW >= 200 ? 44 : 36,
    ],
    card_toast_slot: [
      Math.floor((stageW - toastW) / 2),
      dockY - 80,
      toastW,
      railW >= 200 ? 72 : 44,
    ],
    team_frames: {
      size: [railW, frameH],
      gap: frameGap,
      blue_x: 0,
      red_x: rightRailX,
      y0: frameY0,
    },
    dock_panels: {
      zone,
      pickups,
      fight_call,
      watch_transport,
      ...(dockKill ? { kill_feed: dockKill } : {}),
    },
  };
}

/** Canonical 1920×1080 layout (matches hud-layout.json). */
export const HUD_1080: HudLayout = HUD_1080_CANONICAL;

export const HUD_720: HudLayout = {
  canvas: [1280, 720],
  top_bar: [0, 0, 1280, 44],
  left_rail: [0, 44, 112, 528],
  right_rail: [1168, 44, 112, 528],
  dock: [0, 572, 1280, 148],
  playfield_region: [112, 44, 1056, 528],
  arena_map: [112, 48, 1056, 520],
  kill_feed: [566, 578, 220, 136],
  banner_slot: [544, 48, 192, 36],
  card_toast_slot: [510, 90, 260, 44],
  team_frames: {
    size: [112, 96],
    gap: 6,
    blue_x: 0,
    red_x: 1168,
    y0: 56,
  },
  dock_panels: {
    zone: [8, 578, 266, 136],
    pickups: [282, 578, 276, 136],
    kill_feed: [566, 578, 220, 136],
    fight_call: [794, 578, 196, 136],
    watch_transport: [998, 578, 270, 136],
  },
};

export function pickHudMode(viewportW: number): HudMode {
  return viewportW >= 1920 ? "1080" : "720";
}

export function layoutFor(mode: HudMode): HudLayout {
  return mode === "1080" ? HUD_1080 : HUD_720;
}

/**
 * Layout used while the 1080 push-drawer is open.
 * Remaining width = viewport − drawer; rails 112 so core 1280 centres in 1600.
 */
export function layoutForPushDrawer(viewportW: number): HudLayout {
  const stageW = Math.max(1280, viewportW - DRAWER_W);
  return build1080Layout(stageW, 112);
}

export function arenaDisplaySize(mode: HudMode): { w: number; h: number } {
  if (mode === "720") return { w: ARENA_INTRINSIC.w, h: ARENA_720_CROP_H };
  return { w: ARENA_INTRINSIC.w, h: ARENA_INTRINSIC.h };
}

export function absStyle(r: Rect): {
  position: "absolute";
  left: number;
  top: number;
  width: number;
  height: number;
} {
  return {
    position: "absolute",
    left: r[0],
    top: r[1],
    width: r[2],
    height: r[3],
  };
}
