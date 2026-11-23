import { useEffect, useMemo, useRef, useState } from "react";
import type { SimEvent } from "@watch/lib/types";
import { UNRENDERED_EVENT_TYPES } from "@watch/lib/types";
import { cn } from "@watch/lib/cn";
import { Button } from "./ui/button";

interface Props {
  events: readonly SimEvent[];
  currentTick: number;
  onJump: (tick: number) => void;
  onClose?: () => void;
}

/** Muted mark for events not yet drawn on the map (DEV drawer only). */
function UndrawnMark() {
  return (
    <span
      data-testid="event-undrawn-mark"
      title="Not drawn on map yet"
      aria-label="Not drawn on map yet"
      className="ml-1 inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-full border border-line-2 text-[8px] text-faint"
    >
      ·
    </span>
  );
}

export function EventLogPanel({
  events,
  currentTick,
  onJump,
  onClose,
}: Props) {
  const [filter, setFilter] = useState("");
  const [hideXp, setHideXp] = useState(true);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return events.filter((e) => {
      if (hideXp && e.type === "xp_gain") return false;
      if (!q) return true;
      const hay = `${e.type} ${e.seq} ${e.tick} ${JSON.stringify(e)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, filter, hideXp]);

  // Auto-scroll to the current tick on scrub / step / jump.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>(
      `[data-event-tick="${currentTick}"]`,
    );
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  }, [currentTick, filtered]);

  return (
    <aside
      data-testid="event-log-panel"
      className="flex h-full min-h-0 flex-col border border-line bg-panel"
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div>
          <h2 className="font-condensed text-lg tracking-wide">EVENT LOG</h2>
          <p className="text-xs text-dim">Dev tool · click to jump</p>
        </div>
        {onClose ? (
          <Button
            data-testid="btn-close-drawer"
            variant="outline"
            size="sm"
            onClick={onClose}
          >
            CLOSE
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 border-b border-line p-2">
        <input
          data-testid="event-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter type / id…"
          className="min-w-0 flex-1 border border-line-2 bg-field px-2 py-1 text-sm text-paper placeholder:text-faint"
        />
        <label className="flex items-center gap-1 text-xs text-dim">
          <input
            type="checkbox"
            checked={hideXp}
            onChange={(e) => setHideXp(e.target.checked)}
          />
          Hide xp_gain
        </label>
      </div>
      <ul
        ref={listRef}
        data-testid="event-list"
        className="min-h-0 flex-1 overflow-auto text-xs"
      >
        {filtered.length === 0 ? (
          <li className="p-3 text-dim">No events match.</li>
        ) : (
          filtered.map((e) => {
            const active = e.tick === currentTick;
            const undrawn = UNRENDERED_EVENT_TYPES.has(e.type);
            return (
              <li key={e.seq} data-event-tick={e.tick}>
                <button
                  type="button"
                  data-testid={`event-row-${e.seq}`}
                  onClick={() => onJump(e.tick)}
                  className={cn(
                    "flex w-full items-start gap-2 border-b border-line/60 px-2 py-1.5 text-left hover:bg-panel-2",
                    active && "bg-panel-2",
                  )}
                >
                  <span className="w-10 shrink-0 tabular-nums text-faint">
                    {e.tick}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center font-medium",
                      undrawn ? "text-dim" : "text-paper",
                    )}
                  >
                    {e.type}
                    {undrawn ? <UndrawnMark /> : null}
                  </span>
                  <span className="ml-auto truncate text-faint">seq {e.seq}</span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}
