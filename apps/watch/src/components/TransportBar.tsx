import { Button } from "./ui/button";
import { formatClock } from "@watch/lib/replay";
import type { Speed } from "@watch/lib/types";
import { cn } from "@watch/lib/cn";

const SPEEDS: Speed[] = [0.5, 1, 2, 4, 8];

interface Props {
  playing: boolean;
  tick: number;
  maxTick: number;
  speed: Speed;
  seed: number | null;
  disabled?: boolean;
  compact?: boolean;
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
  compact,
  onPlayPause,
  onStep,
  onScrub,
  onSpeed,
}: Props) {
  const t = tick / 10;
  return (
    <div
      data-testid="watch-transport"
      className={cn(
        "flex h-full flex-col justify-center gap-1.5 border border-line bg-panel",
        compact ? "p-1.5" : "p-2",
      )}
    >
      <div className="flex flex-wrap items-center gap-1">
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
        <div className="flex flex-wrap items-center gap-0.5" data-testid="speed-group">
          {SPEEDS.map((s) => (
            <Button
              key={s}
              data-testid={`btn-speed-${s}`}
              size="sm"
              variant={speed === s ? "active" : "outline"}
              disabled={disabled}
              onClick={() => onSpeed(s)}
              className={cn("px-1.5", speed === s && "border-paper")}
            >
              {s}x
            </Button>
          ))}
        </div>
        <div className="ml-auto font-condensed text-base tabular-nums">
          {formatClock(t)}
          <span className="ml-1 text-[10px] text-dim">
            {tick}/{maxTick}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
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
        <span className="shrink-0 text-[10px] text-dim tabular-nums">
          SEED {seed ?? "—"}
        </span>
      </div>
    </div>
  );
}
