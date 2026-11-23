import { useRef, useState } from "react";
import { Button } from "../ui/button";
import type { BatchResult } from "@lab/types";

interface Props {
  stagedOverrides: Record<string, unknown>;
  onResult: (result: BatchResult) => void;
}

/**
 * In-browser batch is a thin status + file loader. The authoritative runner is
 * the Node CLI (`npm run batch`) so PM can run 2,000 games unattended (B3 /
 * sandbox plan §3.1). This panel documents the command and can load its output.
 */
export function BatchPanel({ stagedOverrides, onResult }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const dirty = Object.keys(stagedOverrides).length > 0;

  return (
    <section data-testid="batch-panel" className="max-w-3xl">
      <h1 className="font-condensed text-3xl tracking-wide">Batch</h1>
      <p className="mt-1 text-sm text-dim">
        Headless Node CLI — same <code className="text-paper">simulate(config)</code>{" "}
        as Watch. Progress and cancel live on the CLI; load the JSON here for the
        dashboard.
      </p>

      <div className="mt-6 space-y-4 border border-line bg-panel/70 p-4">
        <div className="font-condensed text-lg text-dim">COMMANDS</div>
        <pre
          data-testid="batch-commands"
          className="overflow-x-auto bg-field/80 p-3 text-xs leading-relaxed text-paper"
        >{`# 100-game even batch (seeds 20261122..)
npm run batch -- --n 100 --seed 20261122 --out lab/s5

# Cancel after ~20 games (partial export kept)
npm run batch -- --n 100 --seed 20261122 --cancel-after 20 --out lab/s5/cancel

# Official lab
npm run batch -- --n 2000 --seed 20261122 --out lab/s5/lab2000

# Isolation six deltas (preview N=50; claim band needs --n 400)
npm run isolation -- --n 50 --out lab/s5`}</pre>

        {dirty ? (
          <p data-testid="batch-staged-note" className="text-sm text-gold">
            Staged tuning overrides ({Object.keys(stagedOverrides).join(", ")}) apply
            on the next CLI run only if you pass them via a preset file — mid-batch
            edits never rewrite a running sim.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="active"
            data-testid="btn-load-batch-json"
            onClick={() => fileRef.current?.click()}
          >
            Load batch-results.json
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="batch-file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => {
                try {
                  const data = JSON.parse(text) as BatchResult;
                  if (!data.summaries || !data.dashboard) {
                    throw new Error("Missing summaries/dashboard");
                  }
                  onResult(data);
                  setNote(
                    `Loaded ${data.n_finished}/${data.n_requested} games (${data.batch_id})`,
                  );
                } catch (err) {
                  setNote(
                    err instanceof Error ? err.message : "Failed to load batch JSON",
                  );
                }
              });
            }}
          />
        </div>
        {note ? (
          <p data-testid="batch-note" className="text-sm text-dim">
            {note}
          </p>
        ) : null}
      </div>
    </section>
  );
}
