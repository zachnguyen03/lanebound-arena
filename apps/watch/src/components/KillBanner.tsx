import { useMemo } from "react";
import type { TeamPortraits } from "@watch/lib/assets";
import type { MatchViewState, SimEvent, Team, UnitId } from "@watch/lib/types";

interface Props {
  events: readonly SimEvent[];
  currentTick: number;
  state: MatchViewState;
  portraits?: Record<string, TeamPortraits>;
}

/** Ticks a kill stays on the map banner (10 Hz → 4 s). */
const SHOW_TICKS = 40;

/** Map-corner kill banner: killer portrait, kill icon, victim portrait. */
export function KillBanner({ events, currentTick, state, portraits }: Props) {
  const rows = useMemo(
    () =>
      events
        .filter((e) => e.type === "death" && e.tick <= currentTick && e.tick > currentTick - SHOW_TICKS)
        .slice(-3),
    [events, currentTick],
  );
  if (rows.length === 0) return null;

  const face = (id: unknown) => {
    if (typeof id !== "string") return null;
    const u = state.units[id as UnitId];
    if (!u) return null;
    const team = id.split(":")[0] as Team;
    const img = portraits?.[u.champ]?.[team];
    const ring = team === "blue" ? "border-team-blue shadow-[0_0_3px_#4da3ff]" : "border-team-red shadow-[0_0_3px_#f5477a]";
    return img ? (
      <img src={img.src} alt={u.champ} className={`h-6 w-6 border ${ring} object-cover`} />
    ) : (
      <span className={`flex h-6 w-6 items-center justify-center border ${ring} bg-panel text-[8px] uppercase text-paper`}>
        {u.champ.slice(0, 2)}
      </span>
    );
  };

  return (
    <div data-testid="kill-banner" className="pointer-events-none absolute right-1.5 top-1.5 z-10 flex flex-col items-end gap-1">
      {rows.map((e) => (
        <div
          key={e.seq}
          className="flex items-center gap-1 px-1.5 py-0.5"
          style={{
            background: "linear-gradient(#1c2230, #121722)",
            boxShadow: "inset 0 1px 0 rgba(90,104,136,0.55), inset 0 -1px 0 #3a4660",
            clipPath: "polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)",
          }}
        >
          {face(e.killer_id)}
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-paper" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M3 3l10 10M13 3L3 13M2 11l3 3M14 11l-3 3" />
          </svg>
          {face(e.unit_id)}
        </div>
      ))}
    </div>
  );
}
