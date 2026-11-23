import { useMemo } from "react";
import { absStyle, type Rect } from "@watch/lib/hud-layout";
import { formatKillFeedRow } from "@watch/lib/kill-feed-format";
import type { SimEvent } from "@watch/lib/types";

interface Props {
  events: readonly SimEvent[];
  currentTick: number;
  rect: Rect;
  onJump: (tick: number) => void;
  onDeath?: (event: SimEvent) => void;
}

/**
 * Takedown log per hud-spec: killer, victim, assists / score rows.
 * Only death / takedown_score — never level_up or other noise.
 */
export function KillFeed({ events, currentTick, rect, onJump, onDeath }: Props) {
  const rows = useMemo(() => {
    return events
      .filter(
        (e) =>
          (e.type === "death" || e.type === "takedown_score") &&
          e.tick <= currentTick,
      )
      .slice(-12);
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
          <li className="p-2 text-faint" data-testid="kill-feed-empty">
            No takedowns yet
          </li>
        ) : (
          rows.map((e) => (
            <li key={e.seq}>
              <button
                type="button"
                data-testid={`kill-feed-row-${e.seq}`}
                data-event-type={e.type}
                className="flex w-full gap-1 px-2 py-0.5 text-left hover:bg-panel-2"
                onClick={() => {
                  onJump(e.tick);
                  if (e.type === "death") onDeath?.(e);
                }}
              >
                <span className="w-8 shrink-0 tabular-nums text-faint">
                  {e.tick}
                </span>
                <span className="truncate text-paper">
                  {formatKillFeedRow(e)}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
