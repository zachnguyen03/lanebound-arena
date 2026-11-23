import { formatClock } from "@watch/lib/replay";
import type { MatchViewState } from "@watch/lib/types";

interface Props {
  state: MatchViewState | null;
}

export function TopBar({ state }: Props) {
  const t = state?.t ?? 0;
  const caption =
    t >= 240 ? "SUDDEN DEATH" : t >= 180 ? "FINAL MINUTE · 4:00" : "FIRST TO 10 · 4:00";

  return (
    <header
      data-testid="top-bar"
      className="flex items-center justify-between gap-4 border-b border-line bg-panel px-4 py-2"
    >
      <div className="min-w-0">
        <div className="font-condensed text-xl tracking-wide text-team-blue">
          LANEBOUND
        </div>
        <div className="truncate text-xs text-dim">Arena Watch · sandbox</div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <div className="font-condensed text-3xl tabular-nums text-team-blue">
            {state?.scoreBlue ?? 0}
          </div>
        </div>
        <div className="text-center">
          <div className="font-condensed text-3xl tabular-nums tracking-wider">
            {formatClock(t)}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-dim">
            {caption}
          </div>
        </div>
        <div className="text-left">
          <div className="font-condensed text-3xl tabular-nums text-team-red">
            {state?.scoreRed ?? 0}
          </div>
        </div>
      </div>
      <div className="hidden min-w-0 text-right sm:block">
        <div className="font-condensed text-xl tracking-wide text-team-red">
          ARENA
        </div>
        <div className="truncate text-xs text-dim">
          {state?.ended
            ? `END · ${state.endReason ?? "?"} · ${state.winner ?? ""}`
            : "LIVE REPLAY"}
        </div>
      </div>
    </header>
  );
}
