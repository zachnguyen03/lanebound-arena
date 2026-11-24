import { useEffect, useRef } from "react";
import { Button } from "../ui/button";
import type { BatchResult, DashboardMark, DashboardRow } from "@lab/types";

interface Props {
  result: BatchResult | null;
  phase: "empty" | "loading" | "ready";
  onLoadFile: (result: BatchResult) => void;
  onLoadError: (msg: string) => void;
}

function markClass(mark: DashboardMark): string {
  switch (mark) {
    case "pass":
      return "border-emerald-700/60 bg-emerald-950/40 text-emerald-300";
    case "fail":
      return "border-team-red/50 bg-team-red-dark text-team-red";
    case "under-powered":
      return "border-gold/40 bg-[#2a2210] text-gold";
    case "report":
      return "border-line-2 bg-panel-2 text-dim";
  }
}

function Row({ row }: { row: DashboardRow }) {
  return (
    <tr
      data-testid={`dash-row-${row.id}`}
      data-mark={row.mark}
      data-sample-size={row.sample_size}
      className="border-b border-line align-top"
    >
      <td className="py-3 pr-3 font-medium">{row.metric}</td>
      <td className="py-3 pr-3 text-dim">{row.target}</td>
      <td className="py-3 pr-3 font-mono text-sm">{row.value}</td>
      <td className="py-3 pr-3 tabular-nums" data-testid={`dash-n-${row.id}`}>
        N={row.sample_size}
      </td>
      <td className="py-3">
        <span
          className={`inline-block border px-2 py-0.5 text-xs uppercase tracking-wide ${markClass(row.mark)}`}
          data-testid={`dash-mark-${row.id}`}
        >
          {row.mark}
        </span>
        {row.notes ? (
          <div className="mt-1 max-w-xs text-xs text-faint">{row.notes}</div>
        ) : null}
      </td>
    </tr>
  );
}

export function DashboardView({
  result,
  phase,
  onLoadFile,
  onLoadError,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onInject = (ev: Event) => {
      const detail = (ev as CustomEvent<BatchResult>).detail;
      if (detail?.dashboard?.rows) onLoadFile(detail);
    };
    window.addEventListener("lab-inject-results", onInject);
    return () => window.removeEventListener("lab-inject-results", onInject);
  }, [onLoadFile]);

  return (
    <section data-testid="dashboard-view">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-condensed text-3xl tracking-wide">Results dashboard</h1>
          <p className="mt-1 max-w-xl text-sm text-dim">
            Every §6.5 row with pass / fail / under-powered and the sample size
            always visible. Load a BatchResult JSON from the CLI or a prior lab run.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            data-testid="btn-load-results"
            onClick={() => fileRef.current?.click()}
          >
            Load results JSON
          </Button>
          <input
            ref={fileRef}
            data-testid="results-file"
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void file.text().then((text) => {
                try {
                  const data = JSON.parse(text) as BatchResult;
                  if (!data.dashboard?.rows || !Array.isArray(data.summaries)) {
                    throw new Error("Not a BatchResult (missing dashboard.rows / summaries)");
                  }
                  onLoadFile(data);
                } catch (err) {
                  onLoadError(
                    err instanceof Error ? err.message : "Could not parse results",
                  );
                }
              });
            }}
          />
          {result ? (
            <Button
              size="sm"
              variant="outline"
              data-testid="btn-export-dash-json"
              onClick={() => {
                const blob = new Blob([`${JSON.stringify(result, null, 2)}\n`], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${result.batch_id}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export JSON
            </Button>
          ) : null}
        </div>
      </div>

      {phase === "loading" ? (
        <div
          data-testid="dashboard-loading"
          className="mt-10 border border-line bg-panel/60 px-6 py-16 text-center text-dim"
        >
          Loading results…
        </div>
      ) : null}

      {phase === "empty" && !result ? (
        <div
          data-testid="dashboard-empty"
          className="mt-10 border border-dashed border-line-2 bg-panel/40 px-6 py-16 text-center"
        >
          <div className="font-condensed text-xl text-dim">No batch loaded</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-faint">
            Run <code className="text-paper">npm run batch -- --n 100</code> then
            load <code className="text-paper">lab/s5/batch-results.json</code>, or
            use the file picker above.
          </p>
        </div>
      ) : null}

      {result ? (
        <div className="mt-6 overflow-x-auto border border-line bg-panel/80">
          <div className="flex flex-wrap gap-4 border-b border-line px-4 py-3 text-xs text-dim">
            <span data-testid="dash-batch-id">{result.batch_id}</span>
            <span data-testid="dash-n-finished">
              finished {result.n_finished}/{result.n_requested}
              {result.cancelled ? " (cancelled)" : ""}
            </span>
            <span className="font-mono">{result.config_hash.slice(0, 12)}…</span>
          </div>
          <table className="w-full min-w-[960px] text-left text-sm" data-testid="dash-table">
            <thead className="bg-panel-2 text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-4 py-2">Metric</th>
                <th className="px-2 py-2">Target</th>
                <th className="px-2 py-2">Value</th>
                <th className="px-2 py-2">Sample</th>
                <th className="px-2 py-2">Mark</th>
              </tr>
            </thead>
            <tbody className="px-4">
              {result.dashboard.rows.map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
