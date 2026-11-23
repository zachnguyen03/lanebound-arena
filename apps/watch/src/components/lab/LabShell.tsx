import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/button";
import { BatchPanel } from "./BatchPanel";
import { DashboardView } from "./DashboardView";
import { TuningPanel } from "./TuningPanel";
import type { BatchResult, ConstantsPreset } from "@lab/types";

type LabTab = "batch" | "dashboard" | "tuning";

interface Props {
  onBackToWatch: () => void;
  /** Staged constant overrides shared with Watch (apply on next run only). */
  stagedOverrides: Record<string, unknown>;
  onStagedOverrides: (next: Record<string, unknown>) => void;
  dirty: boolean;
}

export function LabShell({
  onBackToWatch,
  stagedOverrides,
  onStagedOverrides,
  dirty,
}: Props) {
  const [tab, setTab] = useState<LabTab>("dashboard");
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"empty" | "loading" | "ready">("empty");

  useEffect(() => {
    // Try to load the default lab proof file if present (dev / preview).
    let cancelled = false;
    setPhase("loading");
    fetch("/lab/batch-results.json")
      .then(async (r) => {
        if (!r.ok) throw new Error("no bundled results");
        return r.json() as Promise<BatchResult>;
      })
      .then((data) => {
        if (cancelled) return;
        setBatchResult(data);
        setPhase("ready");
        setLoadError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setPhase("empty");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onLoaded = useCallback((result: BatchResult) => {
    setBatchResult(result);
    setPhase("ready");
    setLoadError(null);
    setTab("dashboard");
  }, []);

  const onPreset = useCallback(
    (preset: ConstantsPreset) => {
      onStagedOverrides(preset.overrides);
    },
    [onStagedOverrides],
  );

  return (
    <div
      data-testid="lab-shell"
      className="min-h-screen bg-field text-paper"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 50% at 50% -20%, #1a2740 0%, transparent 55%), linear-gradient(180deg, #0b0e14 0%, #0e1420 100%)",
      }}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="font-condensed text-2xl tracking-wide">LANEBOUND LAB</div>
        <nav className="flex flex-wrap gap-2" data-testid="lab-tabs">
          {(
            [
              ["batch", "Batch"],
              ["dashboard", "Dashboard"],
              ["tuning", "Tuning"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? "active" : "outline"}
              data-testid={`lab-tab-${id}`}
              onClick={() => setTab(id)}
            >
              {label}
            </Button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {dirty ? (
            <span
              data-testid="preset-dirty"
              className="text-xs text-gold"
            >
              preset dirty — applies on next run
            </span>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            data-testid="btn-back-watch"
            onClick={onBackToWatch}
          >
            Watch
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        {loadError ? (
          <p className="mb-4 text-sm text-team-red">{loadError}</p>
        ) : null}

        {tab === "batch" ? (
          <BatchPanel
            stagedOverrides={stagedOverrides}
            onResult={onLoaded}
          />
        ) : null}

        {tab === "dashboard" ? (
          <DashboardView
            result={batchResult}
            phase={phase}
            onLoadFile={onLoaded}
            onLoadError={setLoadError}
          />
        ) : null}

        {tab === "tuning" ? (
          <TuningPanel
            overrides={stagedOverrides}
            onChange={onStagedOverrides}
            onPresetLoaded={onPreset}
          />
        ) : null}
      </main>
    </div>
  );
}
