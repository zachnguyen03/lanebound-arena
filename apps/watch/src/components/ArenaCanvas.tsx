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
}

/**
 * Always paints at CSS size === intrinsic buffer size (integer scale 1).
 * Never use max-width / height:auto — that caused fractional shrink.
 */
export function ArenaCanvas({ assets, state, mode, overlays }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = arenaDisplaySize(mode);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !assets || !state) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderArena(ctx, assets, state, { height: size.h, overlays: !!overlays });
  }, [assets, state, size.h, overlays]);

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
