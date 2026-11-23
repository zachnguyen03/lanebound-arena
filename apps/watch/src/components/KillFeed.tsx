import { useMemo } from "react";
import { absStyle, type Rect } from "@watch/lib/hud-layout";
import type { SimEvent } from "@watch/lib/types";

interface Props {
  events: readonly SimEvent[];
  currentTick: number;
  rect: Rect;
  onJump: (tick: number) => void;
}

function shortId(id: unknown): string {
  if (typeof id !== "string" || id.length === 0) return "?";
  // "blue:adc" → "B ADC"
  const [team, slot] = id.split(":");
  const t = team === "blue" ? "B" : team === "red" ? "R" : "?";
  const s = (slot ?? "?").toUpperCase();
  return `${t} ${s}`;
}

function formatDeathRow(e: SimEvent): string {
  const victim = shortId(e.unit_id);
  const killer =
    e.killer_id == null || e.killer_id === ""
      ? "—"
      : shortId(e.killer_id);
  const assists = Array.isArray(e.assists)
    ? (e.assists as unknown[]).map(shortId).filter(Boolean)
    : [];
  const assistPart =
    assists.length > 0 ? ` (+${assists.join(", ")})` : "";
  return `${killer} → ${victim}${assistPart}`;
}

/**
 * Takedown log per hud-spec: killer, victim, assists.
 * Only death / takedown_score rows — never level_up or other noise.
 */
export function KillFeed({ events, currentTick, rect, onJump }: Props) {
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
                className="flex w-full gap-1 px-2 py-0.5 text-left hover:bg-panel-2"
                onClick={() => onJump(e.tick)}
              >
                <span className="w-8 shrink-0 tabular-nums text-faint">
                  {e.tick}
                </span>
                <span className="truncate text-paper">
                  {e.type === "death"
                    ? formatDeathRow(e)
                    : `takedown · ${shortId(e.team)}`}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
