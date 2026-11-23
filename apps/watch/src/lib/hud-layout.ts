/**
 * Positions from arena-sandbox/hud/hud-layout.json — pixel-exact, no CSS scale.
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

export const HUD_1080: HudLayout = {
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

export const ARENA_INTRINSIC = { w: 1056, h: 580 } as const;
/** 720: plinth cropped to 8 px → visible map height 520. */
export const ARENA_720_CROP_H = 520;

export const DRAWER_W = 320;
export const MIN_VIEWPORT = { w: 1280, h: 720 } as const;

export function pickHudMode(viewportW: number): HudMode {
  return viewportW >= 1920 ? "1080" : "720";
}

export function layoutFor(mode: HudMode): HudLayout {
  return mode === "1080" ? HUD_1080 : HUD_720;
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
