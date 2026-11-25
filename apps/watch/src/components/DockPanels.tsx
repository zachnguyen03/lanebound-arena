import type { ReactNode } from "react";
import { absStyle, type Rect } from "@watch/lib/hud-layout";
import type { MatchViewState, PointView } from "@watch/lib/types";
import { majorityLeft } from "./TopHud";

const POINT_NAME: Record<string, string> = { north: "North", centre: "Centre", south: "South" };
const TEAM_CLS = { blue: "text-team-blue", red: "text-team-red" } as const;

function pointStatus(p: PointView, ended: boolean): ReactNode {
  const owner = p.owner ? <span className={TEAM_CLS[p.owner]}>{p.owner.toUpperCase()}</span> : <span>neutral</span>;
  if (ended) return owner;
  if (p.contested) return <>{owner} · contested</>;
  if (p.by && p.by !== p.owner && (p.progress ?? 0) > 0) {
    return (
      <>
        {owner} · <span className={TEAM_CLS[p.by]}>{p.by.toUpperCase()}</span> capturing {Math.round((p.progress ?? 0) * 100)}%
      </>
    );
  }
  return owner;
}

function Panel({
  testId,
  title,
  rect,
  children,
}: {
  testId: string;
  title: string;
  rect: Rect;
  children?: ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      style={absStyle(rect)}
      className="box-border overflow-hidden border border-line bg-panel p-2"
    >
      <div
        data-testid="dock-title"
        className="truncate whitespace-nowrap break-normal font-condensed text-sm leading-none text-dim"
      >
        {title}
      </div>
      <div className="mt-1 text-xs text-faint">{children}</div>
    </div>
  );
}

interface Props {
  state: MatchViewState | null;
  zone: Rect;
  pickups: Rect;
  fightCall: Rect;
}

/** Austere dock chrome — zone/orb/buff/fight visuals await log events. */
export function DockPanels({ state, zone, pickups, fightCall }: Props) {
  return (
    <>
      {state && state.points.length > 0 ? (
        <Panel testId="dock-zone" title="OBJECTIVES" rect={zone}>
          <ul className="space-y-0.5">
            {state.points.map((p) => (
              <li key={p.id} data-testid={`dock-point-${p.id}`} className="flex gap-2">
                <span className="w-12 shrink-0 text-dim">{POINT_NAME[p.id] ?? p.id}</span>
                <span className="truncate text-paper">{pointStatus(p, state.ended)}</span>
              </li>
            ))}
          </ul>
          <div data-testid="dock-majority" className="mt-1.5 text-dim">
            {state.ended ? null : state.majority ? (
              <>
                Majority <span className={TEAM_CLS[state.majority.team]}>{state.majority.team.toUpperCase()}</span> · +1 in{" "}
                {Math.ceil(majorityLeft(state))} s
              </>
            ) : (
              "No majority"
            )}
          </div>
        </Panel>
      ) : (
      <Panel testId="dock-zone" title="ZONE" rect={zone}>
        {state?.zoneOwner
          ? `${state.zoneOwner.toUpperCase()} owns the pit`
          : "Neutral"}
        {state ? (
          <div className="mt-1 text-dim">
            Score {state.scoreBlue}–{state.scoreRed}
          </div>
        ) : null}
      </Panel>
      )}
      <Panel testId="dock-pickups" title="PICKUPS" rect={pickups}>
        {state
          ? `${state.orbs.filter((o) => o.up).length} orbs up · ${state.buffs.filter((b) => b.up).length} buffs up`
          : "No pickup events yet"}
      </Panel>
      <Panel testId="dock-fight-call" title="FIGHT CALL" rect={fightCall}>
        {state?.fightBlue || state?.fightRed
          ? `BLUE ${state.fightBlue?.commit ?? "—"} · RED ${state.fightRed?.commit ?? "—"}`
          : "No fight calls yet"}
      </Panel>
    </>
  );
}

/** Reserves the hud-layout card-toast rect; no outline until a toast is shown. */
export function CardToastSlot({
  rect,
  visible = false,
}: {
  rect: Rect;
  /** When true, draw the toast chrome; v1 never shows one. */
  visible?: boolean;
}) {
  return (
    <div
      data-testid="card-toast-slot"
      data-toast-visible={visible ? "true" : "false"}
      style={absStyle(rect)}
      className={
        visible
          ? "box-border border border-line bg-panel"
          : "box-border border border-transparent bg-transparent"
      }
      aria-hidden={!visible}
      title={visible ? "Card toast" : undefined}
    />
  );
}
