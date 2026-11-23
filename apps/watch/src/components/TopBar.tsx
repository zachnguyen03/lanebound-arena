import { formatClock } from "@watch/lib/replay";
import type { MatchViewState } from "@watch/lib/types";
import type { Rect } from "@watch/lib/hud-layout";
import { absStyle } from "@watch/lib/hud-layout";
import { Button } from "./ui/button";

interface Props {
  state: MatchViewState | null;
  rect: Rect;
  compact?: boolean;
  drawerOpen?: boolean;
  onToggleDrawer?: () => void;
}

function clockCaption(state: MatchViewState | null): string {
  if (!state) return "NO MATCH LOADED";
  if (state.ended) {
    const w = (state.winner ?? "draw").toUpperCase();
    const r = (state.endReason ?? "clock").toUpperCase().replace(/_/g, " ");
    return `${w}, ${r}`;
  }
  const t = state.t;
  // SUDDEN DEATH only while live between 4:00 and 4:30.
  if (t >= 240 && t < 270) return "SUDDEN DEATH";
  if (t >= 180) return "FINAL MINUTE · 4:00";
  return "FIRST TO 10 · 4:00";
}

function statusLine(state: MatchViewState | null): string {
  if (!state) return "IDLE";
  if (state.ended) {
    return `END · ${(state.endReason ?? "?").toUpperCase()} · ${(state.winner ?? "").toUpperCase()}`;
  }
  return "LIVE REPLAY";
}

export function TopBar({
  state,
  rect,
  compact,
  drawerOpen,
  onToggleDrawer,
}: Props) {
  const t = state?.t ?? 0;
  return (
    <header
      data-testid="top-bar"
      style={absStyle(rect)}
      className="flex items-center justify-between gap-3 border-b border-line bg-panel px-3"
    >
      <div className="min-w-0">
        <div
          className={`font-condensed tracking-wide text-team-blue ${compact ? "text-base" : "text-xl"}`}
        >
          LANEBOUND
        </div>
        <div className="truncate text-[10px] text-dim">Arena Watch · sandbox</div>
      </div>
      <div className="flex items-center gap-4">
        <div
          className={`font-condensed tabular-nums text-team-blue ${compact ? "text-2xl" : "text-3xl"}`}
        >
          {state?.scoreBlue ?? 0}
        </div>
        <div className="text-center">
          <div
            className={`font-condensed tabular-nums tracking-wider ${compact ? "text-2xl" : "text-3xl"}`}
          >
            {formatClock(t)}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-dim">
            {clockCaption(state)}
          </div>
        </div>
        <div
          className={`font-condensed tabular-nums text-team-red ${compact ? "text-2xl" : "text-3xl"}`}
        >
          {state?.scoreRed ?? 0}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="min-w-0 text-right">
          <div
            className={`font-condensed tracking-wide text-team-red ${compact ? "text-base" : "text-xl"}`}
          >
            ARENA
          </div>
          <div className="truncate text-[10px] text-dim">{statusLine(state)}</div>
        </div>
        {onToggleDrawer ? (
          <Button
            data-testid="btn-toggle-drawer"
            variant={drawerOpen ? "active" : "outline"}
            size="sm"
            onClick={onToggleDrawer}
          >
            LOG
          </Button>
        ) : null}
      </div>
    </header>
  );
}
