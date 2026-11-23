import { useMemo, useState } from "react";
import type { SimEvent } from "@watch/lib/types";
import { UNRENDERED_EVENT_TYPES } from "@watch/lib/types";
import { cn } from "@watch/lib/cn";

interface Props {
  events: readonly SimEvent[];
  currentTick: number;
  onJump: (tick: number) => void;
}

export function EventLogPanel({ events, currentTick, onJump }: Props) {
  const [filter, setFilter] = useState("");
  const [hideXp, setHideXp] = useState(true);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return events.filter((e) => {
      if (hideXp && e.type === "xp_gain") return false;
      if (!q) return true;
      const hay = `${e.type} ${e.seq} ${e.tick} ${JSON.stringify(e)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [events, filter, hideXp]);

  return (
    <aside
      data-testid="event-log-panel"
      className="flex h-full min-h-0 flex-col border border-line bg-panel"
    >
      <div className="border-b border-line px-3 py-2">
        <h2 className="font-condensed text-lg tracking-wide">EVENT LOG</h2>
        <p className="text-xs text-dim">Click a row to jump to its tick.</p>
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
        data-testid="event-list"
        className="min-h-0 flex-1 overflow-auto text-xs"
      >
        {filtered.length === 0 ? (
          <li className="p-3 text-dim">No events match.</li>
        ) : (
          filtered.map((e) => {
            const active = e.tick === currentTick;
            const unrendered = UNRENDERED_EVENT_TYPES.has(e.type);
            return (
              <li key={e.seq}>
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
                      "font-medium",
                      unrendered ? "text-dim" : "text-paper",
                    )}
                  >
                    {e.type}
                    {unrendered ? " · TODO" : ""}
                  </span>
                  <span className="ml-auto truncate text-faint">
                    seq {e.seq}
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
