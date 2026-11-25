import type { CSSProperties, ReactNode } from "react";
import { formatClock } from "@watch/lib/replay";
import type { MatchViewState, PointView, Team } from "@watch/lib/types";
import "./hud.css";

/** Top HUD v3-C cluster. Geometry from the v3-C handoff (full 72 px, compact 30 px). */
const GEOM = {
  full: { h: 72, cap: 10, pts: 30, ident: 112, score: 56, well: 122, join: 6, gold: 80 },
  compact: { h: 29, cap: 6, pts: 66, ident: 78, score: 40, well: 100, join: 4, gold: 72 },
} as const;

export type HudPhase = "normal" | "final" | "sudden" | "end";

export function hudPhase(state: MatchViewState): HudPhase {
  if (state.ended) return "end";
  if (state.t >= 240 && state.t < 270) return "sudden";
  if (state.t >= 180) return "final";
  return "normal";
}

const TAG: Record<Team, string> = { blue: "BLUE", red: "RED" };
const CREST: Record<Team, string> = { blue: "/hud/crest-hkw-64.png", red: "/hud/crest-ntd-64.png" };
const TACTIC: Record<string, string> = { hold_the_pit: "HOLD", hunt: "HUNT", starve: "STARVE" };

function endReason(state: MatchViewState): string {
  const r = state.endReason ?? "clock";
  if (state.winner === "draw") return "CLOCK";
  if (r.startsWith("first_to")) return `FIRST TO ${state.scoreToWin}`;
  return r.toUpperCase().replace(/_/g, " ");
}

function aggLabel(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** Seconds left on the majority tick, ticking down between 0.5 s feed updates. */
export function majorityLeft(state: MatchViewState): number {
  const m = state.majority;
  return m ? Math.max(0, m.leftS - (state.t - m.at)) : 0;
}

function Marker({ p, size, settled }: { p: PointView; size: number; settled: boolean }) {
  const contested = !settled && p.contested;
  const capturing = !settled && !contested && p.by && (p.progress ?? 0) > 0 && p.by !== p.owner;
  const cls = contested ? "contested" : p.owner ?? "";
  const deg = Math.round((p.progress ?? 0) * 360);
  const ring = (inset: number, w: number, color: string): CSSProperties => ({
    inset,
    background: `conic-gradient(${color} 0 ${deg}deg, transparent 0)`,
    WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${w}px), #000 calc(100% - ${w}px))`,
    mask: `radial-gradient(farthest-side, transparent calc(100% - ${w}px), #000 calc(100% - ${w}px))`,
  });
  return (
    <div
      data-testid={`hud-point-${p.id}`}
      data-state={contested ? "contested" : capturing ? "capturing" : p.owner ? "owned" : "neutral"}
      className={`hud-mk ${cls}`}
      style={{ width: size, height: size, fontSize: size <= 14 ? 8 : 10 }}
      title={`${p.id}: ${p.owner ?? "neutral"}${capturing ? `, ${p.by} capturing ${Math.round((p.progress ?? 0) * 100)}%` : ""}${contested ? ", contested" : ""}`}
    >
      {p.id[0]!.toUpperCase()}
      {capturing ? (
        <>
          <span className="hud-mk-arc" style={ring(-3, 2.5, "var(--gold)")} />
          <span className="hud-mk-arc" style={ring(-0.5, 1.5, `var(--${p.by})`)} />
        </>
      ) : null}
    </div>
  );
}

interface Props {
  state: MatchViewState;
  compact: boolean;
  /** Team tags (career clubs); BLUE / RED when unset. */
  tags?: Record<Team, string>;
}

export function TopHud({ state, compact, tags = TAG }: Props) {
  const g = compact ? GEOM.compact : GEOM.full;
  const phase = hudPhase(state);
  const points = state.points.length > 0;
  const settled = phase === "end";
  const holder = !settled && points ? state.majority?.team ?? null : null;
  const left = majorityLeft(state);
  const tickS = state.majorityTickS || 15;
  const ptsSide: Team = holder === "blue" ? "red" : "blue";
  const endCls = phase === "end" ? `end-${state.winner ?? "draw"}` : "";

  /** One-shot effects mount only right after their event, so scrubbing never replays them. */
  const justScored = (team: Team) => state.split[team].objAt >= 0 && state.t - state.split[team].objAt < 0.5;
  const score = (team: Team) => (team === "blue" ? state.scoreBlue : state.scoreRed);

  const markers = (
    <div
      data-testid="hud-points"
      className="flex items-center justify-center"
      style={{
        width: g.pts,
        height: "100%",
        flexDirection: compact ? "row" : "column",
        gap: compact ? 6 : 3,
      }}
    >
      {state.points.map((p) => (
        <Marker key={p.id} p={p} size={compact ? 14 : 18} settled={settled} />
      ))}
    </div>
  );

  const identity = (team: Team) => {
    const t = state.tactics[team];
    const s = state.split[team];
    const mirror = team === "red";
    return (
      <div
        className={`flex h-full flex-col justify-center ${mirror ? "items-end hud-bleed-red" : "items-start hud-bleed-blue"}`}
        style={{ width: g.ident, padding: compact ? "0 6px" : "0 8px" }}
      >
        <div className={`flex items-center gap-1.5 ${mirror ? "flex-row-reverse" : ""}`}>
          <img src={CREST[team]} alt="" width={compact ? 16 : 26} height={compact ? 16 : 26} className="pixelated" />
          <span className={`hud-tm hud-tag ${team}`} style={{ fontSize: compact ? 14 : 20 }}>
            {tags[team]}
          </span>
        </div>
        {!compact && t ? (
          <div
            data-testid={`hud-tactic-${team}`}
            className={`hud-tm hud-chip ${team} mt-1`}
            title={`Tactic ${TACTIC[t.preset] ?? t.preset}, aggression ${aggLabel(t.aggression)} (−1 cautious, 0 normal, +1 aggressive)`}
          >
            {TACTIC[t.preset] ?? t.preset.toUpperCase()} {aggLabel(t.aggression)}
          </div>
        ) : null}
        {!compact && phase !== "end" && points ? (
          <div data-testid={`hud-source-${team}`} className="hud-in hud-src mt-0.5">
            {s.kills} kills · {s.obj} obj
          </div>
        ) : null}
      </div>
    );
  };

  const scoreCol = (team: Team) => (
    <div
      className="relative flex h-full items-center justify-center"
      style={{ width: g.score }}
    >
      <span
        data-testid={`hud-score-${team}`}
        className={`hud-ox hud-score ${team}`}
        style={{ fontSize: compact ? 22 : 42 }}
      >
        {score(team)}
      </span>
      {justScored(team) && phase !== "end" ? (
        <span key={state.split[team].obj} className="hud-pop" style={{ top: compact ? -2 : 2, fontSize: compact ? 10 : 14 }}>
          +1
        </span>
      ) : null}
    </div>
  );

  const gold = (side: Team) => {
    const digits = String(Math.ceil(left)).padStart(2, "0");
    const deg = Math.round(Math.min(1, left / tickS) * 360);
    const rd = compact ? 9 : 16;
    const ring = (
      <div
        className="hud-ring hud-ox"
        style={{
          width: rd * 2,
          height: rd * 2,
          background: `conic-gradient(var(--on-gold) 0 ${deg}deg, rgb(200,150,40) 0)`,
          fontWeight: 800,
          fontSize: compact ? 10 : 20,
        }}
      >
        <span
          className="hud-ring grid place-items-center"
          style={{
            width: rd * 2 - (compact ? 4 : 6),
            height: rd * 2 - (compact ? 4 : 6),
            background: "var(--gold)",
          }}
        >
          {compact ? null : digits}
        </span>
      </div>
    );
    return (
      <div
        data-testid="hud-majority"
        data-team={holder}
        className={`hud-gold relative flex h-full items-center justify-center hud-tm ${side === "blue" ? "hud-gold-l" : "hud-gold-r"}`}
        style={{ width: g.gold, gap: compact ? 4 : 2, flexDirection: compact ? "row" : "column" }}
        title={`${TAG[holder!]} holds the majority: +1 in ${Math.ceil(left)} s`}
      >
        {justScored(holder!) ? <span key={state.split[holder!].obj} className="hud-shine" /> : null}
        {compact ? (
          <>
            <span style={{ fontWeight: 700, fontSize: 12 }}>{TAG[holder!].slice(0, 3)}</span>
            <span className="hud-ox" style={{ fontWeight: 800, fontSize: 13 }}>{digits}</span>
            {ring}
          </>
        ) : (
          <>
            <span style={{ fontWeight: 700, fontSize: 13, lineHeight: 1 }}>{TAG[holder!]}</span>
            <span style={{ fontWeight: 600, fontSize: 9, lineHeight: 1 }}>TICK</span>
            {ring}
          </>
        )}
      </div>
    );
  };

  const teamCap = (team: Team, w: number) => (
    <div style={{ width: w, height: "100%" }}>
      <div className={`hud-teamcap ${team}`} />
    </div>
  );

  /** One wing, listed from the centre outward. */
  const wing = (team: Team) => {
    const items: ReactNode[] = [scoreCol(team), identity(team)];
    if (holder === team) items.push(teamCap(team, g.join), gold(team));
    else {
      if (points && ptsSide === team) items.push(markers);
      items.push(teamCap(team, g.cap));
    }
    const isLeft = team === "blue";
    return (
      <div
        data-testid={`hud-wing-${team}`}
        className={`hud-seg ${isLeft ? "hud-cap-l" : "hud-cap-r"}`}
        style={{
          [isLeft ? "right" : "left"]: `calc(50% + ${g.well / 2}px)`,
          flexDirection: isLeft ? "row-reverse" : "row",
        }}
      >
        {items.map((n, i) => (
          <div key={i} className="contents">
            {n}
          </div>
        ))}
      </div>
    );
  };

  const target = state.scoreToWin || 10;
  const prog = (team: Team) => `${Math.min(1, score(team) / target) * 50}%`;
  const wellBody =
    phase === "end" ? (
      <>
        <div className="hud-ox hud-clock" style={{ fontSize: compact ? 12 : 20, fontWeight: 800 }}>
          {state.winner === "draw" || !state.winner ? "DRAW" : `${TAG[state.winner]} WINS`}
        </div>
        <div className="hud-in hud-target" style={{ fontSize: compact ? 8 : 11, marginTop: compact ? 1 : 4 }}>
          {endReason(state)}
        </div>
      </>
    ) : (
      <>
        <div data-testid="top-bar-clock" className="hud-ox hud-clock" style={{ fontSize: compact ? 14 : 22 }}>
          {formatClock(state.t)}
        </div>
        {compact ? (
          phase === "normal" ? (
            <div className="hud-in hud-target" style={{ fontSize: 9, marginTop: 1 }}>
              TO {target}
            </div>
          ) : null
        ) : (
          <div className="hud-in hud-target" style={{ fontSize: 11, marginTop: 3 }}>
            {phase === "final" ? "FINAL MINUTE" : phase === "sudden" ? "SUDDEN DEATH" : `FIRST TO ${target}`}
          </div>
        )}
        {!compact && points && !holder && phase === "normal" ? (
          <div className="hud-in hud-target" style={{ fontSize: 9, marginTop: 1 }}>
            NO MAJORITY
          </div>
        ) : null}
      </>
    );

  // Cluster bounds for the one-shot overlays (flash / end wipe).
  const wingW = (team: Team) =>
    g.score + g.ident + (holder === team ? g.join + g.gold : g.cap + (points && ptsSide === team ? g.pts : 0));

  return (
    <div
      data-testid="top-hud"
      data-phase={phase}
      data-majority={holder ?? "none"}
      className={`hud ${compact ? "compact" : ""} ${phase} ${endCls}`}
      style={{ height: g.h, width: "100%" }}
      aria-label={`Blue ${state.scoreBlue}, Red ${state.scoreRed}, ${formatClock(state.t)}`}
    >
      {wing("blue")}
      <div
        data-testid="hud-well"
        className="hud-seg hud-well"
        style={{ left: `calc(50% - ${g.well / 2}px)`, width: g.well }}
      >
        <div
          className="hud-wellcore flex flex-col items-center justify-center"
          style={
            phase === "sudden"
              ? { width: g.well - 8, height: g.h - (compact ? 8 : 18), marginBottom: compact ? 2 : 6 }
              : { width: "100%", height: "100%" }
          }
        >
          {wellBody}
        </div>
        {phase !== "end" ? (
          <>
            <div className="hud-progtrack" />
            <div data-testid="hud-progress-blue" className="hud-prog blue" style={{ width: prog("blue") }} />
            <div data-testid="hud-progress-red" className="hud-prog red" style={{ width: prog("red") }} />
          </>
        ) : null}
      </div>
      {wing("red")}
      {(phase === "final" && state.t < 181) || phase === "end" ? (
        <div
          key={phase}
          className={phase === "final" ? "hud-flash" : "hud-wipe"}
          style={{
            left: `calc(50% - ${g.well / 2 + wingW("blue")}px)`,
            width: g.well + wingW("blue") + wingW("red"),
          }}
        />
      ) : null}
    </div>
  );
}
