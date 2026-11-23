import { Button } from "./ui/button";
import { formatClock } from "@watch/lib/replay";
import type { Speed } from "@watch/lib/types";
import { cn } from "@watch/lib/cn";

const SPEEDS: Speed[] = [0.5, 1, 2, 4];

interface Props {
  playing: boolean;
  tick: number;
  maxTick: number;
  speed: Speed;
  seed: number | null;
  disabled?: boolean;
  onPlayPause: () => void;
  onStep: () => void;
  onScrub: (tick: number) => void;
  onSpeed: (s: Speed) => void;
}

export function TransportBar({
  playing,
  tick,
  maxTick,
  speed,
  seed,
  disabled,
  onPlayPause,
  onStep,
  onScrub,
  onSpeed,
}: Props) {
  const t = tick / 10;
  return (
    <div
      data-testid="watch-transport"
      className="flex flex-col gap-2 rounded-none border border-line bg-panel p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          data-testid="btn-play-pause"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onPlayPause}
        >
          {playing ? "PAUSE" : "PLAY"}
        </Button>
        <Button
          data-testid="btn-step"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onStep}
        >
          STEP ▸
        </Button>
        <div className="flex items-center gap-1" data-testid="speed-group">
          {SPEEDS.map((s) => (
            <Button
              key={s}
              data-testid={`btn-speed-${s}`}
              size="sm"
              variant={speed === s ? "active" : "outline"}
              disabled={disabled}
              onClick={() => onSpeed(s)}
              className={cn(speed === s && "border-paper")}
            >
              {s}x
            </Button>
          ))}
        </div>
        <div className="ml-auto font-condensed text-lg tabular-nums text-paper">
          {formatClock(t)}
          <span className="ml-2 text-sm text-dim">
            tick {tick}/{maxTick}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <input
          data-testid="scrubber"
          type="range"
          min={0}
          max={Math.max(maxTick, 1)}
          value={tick}
          disabled={disabled}
          onChange={(e) => onScrub(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-paper"
          aria-label="Scrub timeline"
        />
        <span className="shrink-0 text-xs text-dim tabular-nums">
          SEED {seed ?? "—"}
        </span>
      </div>
    </div>
  );
}
