import type { ReactNode } from "react";
import { absStyle, type Rect } from "@watch/lib/hud-layout";
import type { MatchViewState } from "@watch/lib/types";

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
      <div className="font-condensed text-sm tracking-wide text-dim">{title}</div>
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

/** Austere dock chrome — zone/orb/buff/fight visuals are unrendered TODOs. */
export function DockPanels({ state, zone, pickups, fightCall }: Props) {
  return (
    <>
      <Panel testId="dock-zone" title="ZONE" rect={zone}>
        Neutral · unrendered until zone events
        {state ? (
          <div className="mt-1 text-dim">Score {state.scoreBlue}–{state.scoreRed}</div>
        ) : null}
      </Panel>
      <Panel testId="dock-pickups" title="PICKUPS" rect={pickups}>
        8 orbs · 2 flank buffs · empty pads drawn on map
      </Panel>
      <Panel testId="dock-fight-call" title="FIGHT CALL" rect={fightCall}>
        No fight_call in log · TODO
      </Panel>
    </>
  );
}

export function CardToastSlot({ rect }: { rect: Rect }) {
  return (
    <div
      data-testid="card-toast-slot"
      style={absStyle(rect)}
      className="box-border border border-dashed border-line-2 bg-transparent"
      aria-hidden
      title="Card toast slot (empty in v1)"
    />
  );
}
