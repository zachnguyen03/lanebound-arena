import { useMemo } from "react";
import { runPointsMatch } from "@watch/lib/live-match";
import { ReplayEngine } from "@watch/lib/replay";
import type { MatchViewState, SimEvent } from "@watch/lib/types";
import { TopHud } from "./TopHud";

/** ?hud — every top-HUD state at full and compact size, for design review. */
export function HudGallery() {
  const states = useMemo(() => {
    const eng = new ReplayEngine(runPointsMatch(20261122).result.events as unknown as SimEvent[]);
    const base = eng.stateAt(1340);
    const mk = (over: Partial<MatchViewState>): MatchViewState => ({ ...base, ...over });
    const story = base.points.map((p) =>
      p.id === "north"
        ? { ...p, owner: "blue" as const, by: null, progress: 0, contested: false }
        : p.id === "centre"
          ? { ...p, owner: "red" as const, by: "red" as const, progress: 0, contested: true }
          : { ...p, owner: "red" as const, by: "blue" as const, progress: 0.62, contested: false },
    );
    const n = {
      points: story,
      scoreBlue: 9,
      scoreRed: 15,
      t: 134,
      majority: { team: "red" as const, leftS: 7, at: 134 },
      split: { blue: { kills: 6, obj: 3, objAt: 120 }, red: { kills: 5, obj: 10, objAt: 127 } },
    };
    const end = (winner: "blue" | "red" | "draw"): Partial<MatchViewState> => ({
      ...n,
      ended: true,
      winner,
      endReason: winner === "draw" ? "clock" : "first_to_10",
      scoreBlue: winner === "blue" ? 28 : 24,
      scoreRed: winner === "red" ? 28 : 24,
    });
    return [
      ["normal (red majority)", mk(n)],
      ["blue majority", mk({ ...n, majority: { team: "blue", leftS: 11, at: 134 } })],
      ["final minute", mk({ ...n, t: 201 })],
      ["sudden death", mk({ ...n, t: 252, scoreBlue: 18, scoreRed: 22 })],
      ["no majority", mk({ ...n, majority: null })],
      ["mode off", mk({ ...n, points: [], majority: null, scoreToWin: 10, scoreBlue: 4, scoreRed: 6 })],
      ["end red", mk(end("red"))],
      ["end blue", mk(end("blue"))],
      ["end draw", mk(end("draw"))],
    ] as const;
  }, []);

  return (
    <div data-testid="hud-gallery" className="min-h-screen bg-field p-6 text-paper">
      {(["full", "compact"] as const).map((size) => (
        <section key={size} className="mb-8">
          <h2 className="mb-3 font-condensed text-lg text-dim">{size.toUpperCase()}</h2>
          {states.map(([label, s]) => (
            <div key={label} data-testid={`hud-gallery-${size}-${label.replace(/\W+/g, "-")}`} className="mb-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-faint">{label}</div>
              <div style={{ width: 1280, padding: "4px 0", background: "#0b0e14", border: "1px solid #252e40" }}>
                <TopHud state={s} compact={size === "compact"} />
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
