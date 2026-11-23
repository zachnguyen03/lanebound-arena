import { describe, expect, it } from "vitest";
import {
  build1080Layout,
  HUD_1080,
  layoutForPushDrawer,
  DRAWER_W,
} from "./hud-layout";

describe("build1080Layout", () => {
  it("matches canonical HUD_1080 at 1920×200 rails", () => {
    const built = build1080Layout(1920, 200);
    expect(built.canvas).toEqual(HUD_1080.canvas);
    expect(built.left_rail).toEqual(HUD_1080.left_rail);
    expect(built.right_rail).toEqual(HUD_1080.right_rail);
    expect(built.arena_map).toEqual(HUD_1080.arena_map);
    expect(built.kill_feed).toEqual(HUD_1080.kill_feed);
  });

  it("drawer-open layout fits rails+map in remaining width at 1920", () => {
    const layout = layoutForPushDrawer(1920);
    const [stageW] = layout.canvas;
    expect(stageW).toBe(1920 - DRAWER_W);
    expect(stageW).toBe(1600);
    // 112 + 1056 + 112 = 1280 core
    expect(layout.left_rail[2]).toBe(112);
    expect(layout.right_rail[2]).toBe(112);
    expect(layout.arena_map[2]).toBe(1056);
    expect(layout.arena_map[3]).toBe(580);
    // Everything within stage
    expect(layout.left_rail[0]).toBeGreaterThanOrEqual(0);
    expect(layout.right_rail[0] + layout.right_rail[2]).toBeLessThanOrEqual(
      stageW,
    );
    expect(layout.arena_map[0] + layout.arena_map[2]).toBeLessThanOrEqual(
      stageW,
    );
  });
});
