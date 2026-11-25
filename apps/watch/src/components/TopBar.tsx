import { TopHud } from "./TopHud";
import type { MatchViewState } from "@watch/lib/types";
import type { Rect } from "@watch/lib/hud-layout";
import { absStyle } from "@watch/lib/hud-layout";
import { Button } from "./ui/button";

interface Props {
  state: MatchViewState | null;
  rect: Rect;
  compact?: boolean;
  drawerOpen?: boolean;
  onToggleDrawer?: () => void;
  overlays?: boolean;
  onToggleOverlays?: () => void;
  vfx?: boolean;
  onToggleVfx?: () => void;
}

function statusLine(state: MatchViewState | null): string {
  if (!state) return "IDLE";
  if (state.ended) {
    return "MATCH OVER";
  }
  return "LIVE REPLAY";
}

export function TopBar({
  state,
  rect,
  compact,
  drawerOpen,
  onToggleDrawer,
  overlays,
  onToggleOverlays,
  vfx,
  onToggleVfx,
}: Props) {
  return (
    <header
      data-testid="top-bar"
      style={{ ...absStyle(rect), zIndex: 40 }}
      className="pointer-events-none overflow-visible bg-field"
    >
      <div className="absolute inset-x-0" style={{ top: compact ? Math.max(0, (rect[3] - 30) / 2) : 4 }}>
        {state ? (
          <TopHud state={state} compact={!!compact} />
        ) : (
          <div className="pt-2 text-center text-[10px] uppercase tracking-widest text-dim">
            No match loaded
          </div>
        )}
      </div>
      <div
        className="pointer-events-auto absolute inset-y-0 right-3 flex items-center gap-2"
      >
        <div className="hud-in text-[10px] uppercase tracking-wider text-dim" style={{ fontFamily: "HudInter, Barlow, sans-serif" }}>
          {statusLine(state)}
        </div>
        {onToggleVfx ? (
          <Button
            data-testid="btn-toggle-vfx"
            variant={vfx ? "active" : "outline"}
            size="sm"
            onClick={onToggleVfx}
            title="Skill VFX"
          >
            FX
          </Button>
        ) : null}
        {onToggleOverlays ? (
          <Button
            data-testid="btn-toggle-overlays"
            variant={overlays ? "active" : "outline"}
            size="sm"
            onClick={onToggleOverlays}
          >
            AI
          </Button>
        ) : null}
        {onToggleDrawer ? (
          <Button
            data-testid="btn-toggle-drawer"
            variant={drawerOpen ? "active" : "outline"}
            size="sm"
            onClick={onToggleDrawer}
          >
            LOG
          </Button>
        ) : null}
      </div>
    </header>
  );
}
