import { useEffect, useRef } from "react";
import type { WatchAssets } from "@watch/lib/assets";
import { ARENA_SIZE, renderArena } from "@watch/lib/render-arena";
import type { MatchViewState } from "@watch/lib/types";

interface Props {
  assets: WatchAssets | null;
  state: MatchViewState | null;
  className?: string;
}

export function ArenaCanvas({ assets, state, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !assets || !state) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderArena(ctx, assets, state);
  }, [assets, state]);

  return (
    <canvas
      ref={ref}
      width={ARENA_SIZE.w}
      height={ARENA_SIZE.h}
      className={`pixelated max-w-full h-auto bg-field ${className ?? ""}`}
      data-testid="arena-canvas"
      aria-label="Arena playfield"
    />
  );
}
