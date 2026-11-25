import { useEffect, useRef } from "react";
import type { WatchAssets } from "@watch/lib/assets";
import type { HudMode } from "@watch/lib/hud-layout";
import { arenaDisplaySize } from "@watch/lib/hud-layout";
import { renderArena } from "@watch/lib/render-arena";
import type { MatchViewState } from "@watch/lib/types";

interface Props {
  assets: WatchAssets | null;
  state: MatchViewState | null;
  mode: HudMode;
  overlays?: boolean;
  vfx?: boolean;
  /**
   * While playing: fraction [0, 1) of the current 100 ms tick already elapsed.
   * The canvas then redraws every animation frame with `t` advanced inside the
   * tick, so VFX clocks (60 ms frames, projectile lerp) are not quantised.
   */
  subTick?: () => number;
}

/**
 * Always paints at CSS size === intrinsic buffer size (integer scale 1).
 * Never use max-width / height:auto — that caused fractional shrink.
 */
export function ArenaCanvas({ assets, state, mode, overlays, vfx, subTick }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = arenaDisplaySize(mode);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !assets || !state) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const opts = { height: size.h, overlays: !!overlays, vfx: vfx !== false };
    if (!subTick) {
      renderArena(ctx, assets, state, opts);
      return;
    }
    let raf = 0;
    let prev = 0;
    const draw = () => {
      // The playback loop wraps the fraction before React hands us the next
      // tick's state; hold at the tick's end instead of jumping back.
      let frac = Math.min(0.999, Math.max(0, subTick()));
      if (frac < prev) frac = 0.999;
      prev = frac;
      renderArena(ctx, assets, { ...state, t: state.t + frac * 0.1 }, opts);
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [assets, state, size.h, overlays, vfx, subTick]);

  return (
    <canvas
      ref={ref}
      width={size.w}
      height={size.h}
      style={{
        width: size.w,
        height: size.h,
        imageRendering: "pixelated",
        display: "block",
        flexShrink: 0,
      }}
      className="pixelated bg-field"
      data-testid="arena-canvas"
      data-arena-w={size.w}
      data-arena-h={size.h}
      aria-label="Arena playfield"
    />
  );
}
