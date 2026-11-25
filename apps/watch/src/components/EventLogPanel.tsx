import { useEffect, useMemo, useRef, useState } from "react";
import type { SimEvent } from "@watch/lib/types";
import { UNRENDERED_EVENT_TYPES } from "@watch/lib/types";
import { eventTypeLabel } from "@watch/lib/event-labels";
import { cn } from "@watch/lib/cn";
import { Button } from "./ui/button";

interface Props {
  events: readonly SimEvent[];
  currentTick: number;
  onJump: (tick: number) => void;
  onClose?: () => void;
}

/** Muted mark for events not yet drawn on the map. */
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

/**
 * Event type label. At text-xs the default space glyph is ~2px and reads as
 * "Levelup" in the docked drawer — bump word-spacing so the gap stays visible.
 */
function EventTypeLabel({ type }: { type: string }) {
  const label = eventTypeLabel(type);
  return (
    <span
      data-testid="event-type-label"
      data-event-type={type}
      data-label={label}
      className="whitespace-nowrap font-medium tracking-normal [word-spacing:0.35em]"
    >
      {label}
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
    const showTape = import.meta.env.DEV;
    return events.filter((e) => {
      if (!showTape && (e.type === "pos" || e.type === "move")) return false;
      if (hideXp && e.type === "xp_gain") return false;
      if (!q) return true;
      const label = eventTypeLabel(e.type).toLowerCase();
      const hay =
        `${e.type} ${label} ${e.seq} ${e.tick} ${JSON.stringify(e)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, filter, hideXp]);

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
          <p className="text-xs text-dim">Click a row to jump</p>
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
          aria-label="Filter events"
          className="min-w-0 flex-1 border border-line-2 bg-field px-2 py-1 text-sm text-paper"
        />
        <label className="flex items-center gap-1 text-xs text-dim">
          <input
            type="checkbox"
            checked={hideXp}
            onChange={(e) => setHideXp(e.target.checked)}
          />
          Hide XP gains
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
                      "inline-flex items-center",
                      undrawn ? "text-dim" : "text-paper",
                    )}
                  >
                    <EventTypeLabel type={e.type} />
                    {undrawn ? <UndrawnMark /> : null}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}
