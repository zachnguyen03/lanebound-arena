import { useMemo, useState } from "react";
import {
  deathDecisionStrip,
  filterDecisions,
  formatDecision,
} from "@watch/lib/decisions";
import type { SimEvent } from "@watch/lib/types";

interface Props {
  events: readonly SimEvent[];
  death: SimEvent;
  onClose: () => void;
}

export function DecisionStrip({ events, death, onClose }: Props) {
  const [filter, setFilter] = useState("");
  const strip = useMemo(
    () => deathDecisionStrip(events, death),
    [events, death],
  );
  const killer = filterDecisions(strip.killer, filter);
  const victim = filterDecisions(strip.victim, filter);

  return (
    <div
      data-testid="decision-strip"
      className="border border-line bg-panel p-2 text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-condensed text-sm tracking-wide">
          DECISIONS · last 5 s · tick {strip.tick}
        </div>
        <button
          type="button"
          data-testid="btn-close-decisions"
          className="border border-line-2 px-2 py-0.5"
          onClick={onClose}
        >
          CLOSE
        </button>
      </div>
      <label className="mt-2 flex items-center gap-2 text-dim">
        Filter unit
        <input
          data-testid="decision-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-line-2 bg-field px-1 py-0.5 text-paper"
        />
      </label>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <StripCol title={`Killer ${strip.killerId ?? "—"}`} rows={killer} />
        <StripCol title={`Victim ${strip.victimId ?? "—"}`} rows={victim} />
      </div>
    </div>
  );
}

function StripCol({ title, rows }: { title: string; rows: SimEvent[] }) {
  return (
    <div data-testid="decision-col">
      <div className="text-dim">{title}</div>
      <ul className="mt-1 max-h-40 overflow-auto">
        {rows.length === 0 ? (
          <li className="text-faint">No decisions in this window.</li>
        ) : (
          rows.map((e) => (
            <li key={e.seq} className="truncate text-paper">
              {formatDecision(e)}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
