import { cn } from "@watch/lib/cn";
import type { TeamPortraits } from "@watch/lib/assets";
import type { HudLayout } from "@watch/lib/hud-layout";
import type { MatchViewState, Slot, Team } from "@watch/lib/types";
import { SLOT_LABEL, SLOTS } from "@watch/lib/types";

interface Props {
  side: Team;
  state: MatchViewState;
  layout: HudLayout;
  portraits?: Record<string, TeamPortraits>;
}

export function TeamRail({ side, state, layout, portraits }: Props) {
  const rail = side === "blue" ? layout.left_rail : layout.right_rail;
  const tf = layout.team_frames;
  const [fw, fh] = tf.size;

  return (
    <div
      data-testid={`rail-only-${side}`}
      style={{
        position: "absolute",
        left: rail[0],
        top: rail[1],
        width: rail[2],
        height: rail[3],
      }}
      className="overflow-hidden"
    >
      {SLOTS.map((slot: Slot, i) => {
        const u = state.units[`${side}:${slot}`]!;
        const fill = side === "blue" ? "bg-team-blue" : "bg-team-red";
        const frac = u.alive ? Math.max(0, Math.min(1, u.hp / u.maxHp)) : 0;
        const y = tf.y0 - rail[1] + i * (fh + tf.gap);
        const compact = fw <= 112;
        const pack = portraits?.[u.champ];
        const compactArt =
          pack?.compact &&
          pack.compact.naturalWidth === 24 &&
          pack.compact.naturalHeight === 24
            ? pack.compact
            : undefined;
        const portrait = compact ? compactArt : pack?.[side];
        const portraitPx = compact ? 24 : 64;
        return (
          <div
            key={slot}
            data-testid={`frame-${u.id}`}
            style={{
              position: "absolute",
              left: 0,
              top: y,
              width: fw,
              height: fh,
            }}
            className={cn(
              "box-border border border-line bg-panel-2 p-1.5",
              side === "blue"
                ? "border-l-2 border-l-team-blue"
                : "border-r-2 border-r-team-red",
            )}
          >
            <div className="flex h-full items-start gap-1.5">
              <div
                className={cn(
                  "flex shrink-0 items-center justify-center overflow-hidden border border-line-2 font-bold",
                  portrait
                    ? ""
                    : compact
                      ? "h-7 w-7 text-[8px]"
                      : "h-10 w-10 text-[9px]",
                  u.alive ? "bg-field" : "bg-line text-faint",
                )}
                style={
                  portrait
                    ? { width: portraitPx + 2, height: portraitPx + 2 }
                    : undefined
                }
                title={
                  u.fallback ? `Missing body art (${u.champ})` : u.champ
                }
              >
                {portrait ? (
                  <img
                    src={portrait.src}
                    alt=""
                    width={portraitPx}
                    height={portraitPx}
                    data-testid={`portrait-${u.id}`}
                    className="pixelated shrink-0"
                    style={{
                      width: portraitPx,
                      height: portraitPx,
                      imageRendering: "pixelated",
                    }}
                  />
                ) : (
                  u.champ.slice(0, 3).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "truncate font-condensed font-semibold uppercase",
                    compact ? "text-[11px] leading-4" : "text-sm",
                  )}
                >
                  {u.champ === "unknown" ? SLOT_LABEL[slot] : u.champ}
                </div>
                <div className={cn("flex justify-between gap-1", compact ? "text-[10px] leading-3" : "text-xs")}>
                  <span data-testid={`kda-${u.id}`} className="tabular-nums text-paper" title="Kills / Deaths / Assists">
                    {u.kda.k}
                    <span className="text-faint"> / </span>
                    {u.kda.d}
                    <span className="text-faint"> / </span>
                    {u.kda.a}
                  </span>
                  <span className="text-dim">L{u.level}</span>
                </div>
                <div className={cn("mt-0.5 w-full bg-field", compact ? "h-1" : "h-1.5")}>
                  <div
                    className={cn("h-full", fill)}
                    style={{ width: `${frac * 100}%` }}
                  />
                </div>
                <div className="mt-0.5 text-[9px] tabular-nums text-dim">
                  {u.alive
                    ? `${Math.round(u.hp)}/${Math.round(u.maxHp)}`
                    : "DEAD"}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
