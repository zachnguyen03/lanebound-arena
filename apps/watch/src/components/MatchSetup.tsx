import { Button } from "./ui/button";

interface Props {
  busy?: boolean;
  onStart: (seed: number) => void;
  onStartClockAi?: (seed: number) => void;
  onStartCadence?: (seed: number) => void;
  onExport?: () => void;
  onImportText?: (text: string) => void;
  canExport?: boolean;
  onOpenLab?: () => void;
  dirty?: boolean;
}

/** Start a live even-OVR match or round-trip a MatchConfig JSON. */
export function MatchSetup({
  busy,
  onStart,
  onStartClockAi,
  onStartCadence,
  onExport,
  onImportText,
  canExport,
  onOpenLab,
  dirty,
}: Props) {
  return (
    <div data-testid="match-setup" className="border border-line bg-panel p-3">
      <div className="font-condensed text-lg">LIVE MATCH</div>
      <p className="mt-1 text-sm text-dim">
        Runs an even match with the arena clock and AI.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          data-testid="btn-start-live"
          size="sm"
          variant="active"
          disabled={busy}
          onClick={() => onStart(20261122)}
        >
          Start seed 20261122
        </Button>
        <Button
          data-testid="btn-start-live-seed2"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => onStart(20261123)}
        >
          Start seed 20261123
        </Button>
        {onStartClockAi ? (
          <Button
            data-testid="btn-start-clock-ai"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onStartClockAi(20261122)}
          >
            Start clock AI 20261122
          </Button>
        ) : null}
        {onStartCadence ? (
          <Button
            data-testid="btn-start-cadence"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onStartCadence(20261122)}
          >
            Cadence (exp) 20261122
          </Button>
        ) : null}
        {onExport ? (
          <Button
            data-testid="btn-export-config"
            size="sm"
            variant="outline"
            disabled={!canExport}
            onClick={onExport}
          >
            Export config
          </Button>
        ) : null}
        {onOpenLab ? (
          <Button
            data-testid="btn-open-lab"
            size="sm"
            variant="outline"
            onClick={onOpenLab}
          >
            Lab
          </Button>
        ) : null}
        {dirty ? (
          <span data-testid="preset-dirty" className="self-center text-xs text-gold">
            preset dirty — applies on next run
          </span>
        ) : null}
        {onImportText ? (
          <label className="text-xs text-dim">
            Import JSON
            <input
              data-testid="config-file"
              type="file"
              accept="application/json,.json"
              className="ml-1 text-paper"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void file.text().then(onImportText);
              }}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
