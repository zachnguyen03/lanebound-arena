import type { MatchViewState } from "@watch/lib/types";

interface Props {
  state: MatchViewState | null;
  digest: string | null;
  sourceName: string | null;
}

export function DevPanel({ state, digest, sourceName }: Props) {
  const fallbacks = state?.fallbackChamps ?? [];
  return (
    <div
      data-testid="dev-panel"
      className="border border-line bg-panel p-3 text-xs text-dim"
    >
      <div className="mb-1 font-condensed text-sm text-paper">DEV · FALLBACKS</div>
      <div className="space-y-1 break-all">
        <div>source: {sourceName ?? "—"}</div>
        <div>digest: {digest ?? "—"}</div>
        <div>
          champ fallbacks:{" "}
          {fallbacks.length === 0 ? (
            <span className="text-paper">none</span>
          ) : (
            <span className="text-paper">{fallbacks.join(", ")}</span>
          )}
        </div>
        <div className="text-faint">
          No CD dummy body sheet in arena-sandbox P0; labelled placeholders used.
        </div>
      </div>
    </div>
  );
}
