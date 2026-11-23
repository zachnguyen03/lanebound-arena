import { useMemo } from "react";
import { absStyle, type Rect } from "@watch/lib/hud-layout";
import type { SimEvent } from "@watch/lib/types";

interface Props {
  events: readonly SimEvent[];
  currentTick: number;
  rect: Rect;
  onJump: (tick: number) => void;
}

/** Compact takedown / key-event strip in the HUD kill_feed slot. */
export function KillFeed({ events, currentTick, rect, onJump }: Props) {
  const rows = useMemo(() => {
    const interesting = events.filter((e) =>
      [
        "death",
        "takedown_score",
        "match_start",
        "match_end",
        "level_up",
        "respawn",
      ].includes(e.type),
    );
    // Prefer deaths; fall back to recent interesting events near current tick.
    const deaths = interesting.filter((e) => e.type === "death");
    const src = deaths.length > 0 ? deaths : interesting;
    const near = src.filter((e) => e.tick <= currentTick).slice(-8);
    return near.length > 0 ? near : src.slice(0, 8);
  }, [events, currentTick]);

  return (
    <div
      data-testid="kill-feed"
      style={absStyle(rect)}
      className="box-border flex flex-col overflow-hidden border border-line bg-panel"
    >
      <div className="border-b border-line px-2 py-1 font-condensed text-xs tracking-wide text-dim">
        TAKEDOWN LOG
      </div>
      <ul className="min-h-0 flex-1 overflow-auto text-[10px]">
        {rows.length === 0 ? (
          <li className="p-2 text-faint">No takedowns yet</li>
        ) : (
          rows.map((e) => (
            <li key={e.seq}>
              <button
                type="button"
                data-testid={`kill-feed-row-${e.seq}`}
                className="flex w-full gap-1 px-2 py-0.5 text-left hover:bg-panel-2"
                onClick={() => onJump(e.tick)}
              >
                <span className="w-8 shrink-0 tabular-nums text-faint">{e.tick}</span>
                <span className="truncate text-paper">{e.type}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
