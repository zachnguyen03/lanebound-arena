import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadWatchAssets, type WatchAssets } from "@watch/lib/assets";
import { cn } from "@watch/lib/cn";
import { parseJsonl } from "@watch/lib/parse-log";
import { ReplayEngine } from "@watch/lib/replay";
import type { MatchViewState, Slot, Speed } from "@watch/lib/types";
import { SLOT_LABEL, SLOTS } from "@watch/lib/types";
import { ArenaCanvas } from "./ArenaCanvas";
import { DevPanel } from "./DevPanel";
import { EventLogPanel } from "./EventLogPanel";
import { LogLoader } from "./LogLoader";
import { TopBar } from "./TopBar";
import { TransportBar } from "./TransportBar";

type LoadPhase = "boot" | "empty" | "loading" | "ready" | "error";

const SAMPLE_URL = "/samples/seed-20261122.jsonl";

export function WatchShell() {
  const [assets, setAssets] = useState<WatchAssets | null>(null);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [phase, setPhase] = useState<LoadPhase>("boot");
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<ReplayEngine | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const accRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    loadWatchAssets()
      .then((a) => {
        if (cancelled) return;
        setAssets(a);
        setPhase("empty");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setAssetsError(e instanceof Error ? e.message : "Asset load failed");
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadText = useCallback((text: string, name: string) => {
    setPhase("loading");
    setError(null);
    setPlaying(false);
    try {
      const events = parseJsonl(text);
      if (events.length === 0) throw new Error("Log is empty");
      const eng = new ReplayEngine(events);
      setEngine(eng);
      setSourceName(name);
      setTick(0);
      setPhase("ready");
    } catch (e) {
      setEngine(null);
      setError(e instanceof Error ? e.message : "Failed to parse log");
      setPhase("empty");
    }
  }, []);

  const loadSample = useCallback(async () => {
    setPhase("loading");
    setError(null);
    setPlaying(false);
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) throw new Error(`Sample fetch failed (${res.status})`);
      const text = await res.text();
      loadText(text, "samples/seed-20261122.jsonl");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sample load failed");
      setPhase("empty");
    }
  }, [loadText]);

  const state = useMemo(
    () => (engine ? engine.stateAt(tick) : null),
    [engine, tick],
  );

  useEffect(() => {
    if (!playing || !engine) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      accRef.current = 0;
      return;
    }
    const tickMs = 100 / speed;
    const step = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;
      accRef.current += dt;
      let advanced = 0;
      while (accRef.current >= tickMs) {
        accRef.current -= tickMs;
        advanced += 1;
      }
      if (advanced > 0) {
        setTick((t) => {
          const next = Math.min(engine.maxTick, t + advanced);
          if (next >= engine.maxTick) setPlaying(false);
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, engine, speed]);

  const onStep = () => {
    setPlaying(false);
    if (!engine) return;
    setTick((t) => Math.min(engine.maxTick, t + 1));
  };

  return (
    <div className="flex min-h-screen flex-col bg-field text-paper">
      <TopBar state={state} />

      <div className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col gap-3 p-3 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {phase === "boot" || phase === "loading" ? (
            <div
              data-testid="loading-state"
              className="flex min-h-[240px] items-center justify-center border border-line bg-panel"
            >
              <div className="text-center">
                <div className="font-condensed text-2xl">LOADING</div>
                <p className="mt-1 text-sm text-dim">
                  {phase === "boot"
                    ? "Fetching arena art…"
                    : "Parsing event log…"}
                </p>
              </div>
            </div>
          ) : null}

          {phase === "error" ? (
            <div
              data-testid="error-state"
              className="border border-team-red bg-team-red-dark p-4"
              role="alert"
            >
              {assetsError ?? "Failed to start Watch"}
            </div>
          ) : null}

          {phase !== "boot" && phase !== "error" && !engine ? (
            <div data-testid="empty-state" className="space-y-3">
              <LogLoader
                onLoadText={loadText}
                onLoadSample={() => void loadSample()}
              />
              {error ? (
                <p className="text-sm text-team-red" role="alert">
                  {error}
                </p>
              ) : (
                <p className="text-sm text-dim">
                  No match loaded. Drop a log or load the bundled seed 20261122
                  sample.
                </p>
              )}
            </div>
          ) : null}

          {engine && state ? (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(140px,200px)_minmax(0,1fr)_minmax(140px,200px)]">
              <div className="hidden xl:block" data-testid="left-rail-wrap">
                <TeamRail side="blue" state={state} />
              </div>

              <div className="flex flex-col gap-3">
                <div className="overflow-x-auto border border-line bg-field">
                  <ArenaCanvas assets={assets} state={state} />
                </div>

                <TransportBar
                  playing={playing}
                  tick={tick}
                  maxTick={engine.maxTick}
                  speed={speed}
                  seed={state.seed}
                  onPlayPause={() => setPlaying((p) => !p)}
                  onStep={onStep}
                  onScrub={(t) => {
                    setPlaying(false);
                    setTick(t);
                  }}
                  onSpeed={setSpeed}
                />

                <div className="grid grid-cols-2 gap-2 xl:hidden">
                  <TeamRail side="blue" state={state} />
                  <TeamRail side="red" state={state} />
                </div>

                <LogLoader
                  onLoadText={loadText}
                  onLoadSample={() => void loadSample()}
                />
                <DevPanel
                  state={state}
                  digest={engine.digest}
                  sourceName={sourceName}
                />
              </div>

              <div className="hidden xl:block" data-testid="right-rail-wrap">
                <TeamRail side="red" state={state} />
              </div>
            </div>
          ) : null}
        </div>

        <div className="h-[360px] w-full shrink-0 lg:h-auto lg:min-h-[640px] lg:w-[300px]">
          <EventLogPanel
            events={engine?.events ?? []}
            currentTick={tick}
            onJump={(t) => {
              setPlaying(false);
              setTick(t);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function TeamRail({
  side,
  state,
}: {
  side: "blue" | "red";
  state: MatchViewState;
}) {
  return (
    <div data-testid={`rail-only-${side}`} className="flex flex-col gap-2">
      <div
        className={cn(
          "font-condensed text-sm",
          side === "blue" ? "text-team-blue" : "text-right text-team-red",
        )}
      >
        {side.toUpperCase()}
      </div>
      {SLOTS.map((slot: Slot) => {
        const u = state.units[`${side}:${slot}`]!;
        const fill = side === "blue" ? "bg-team-blue" : "bg-team-red";
        const frac = u.alive ? Math.max(0, Math.min(1, u.hp / u.maxHp)) : 0;
        return (
          <div
            key={slot}
            data-testid={`frame-${u.id}`}
            className={cn(
              "border border-line bg-panel-2 p-2",
              side === "blue"
                ? "border-l-2 border-l-team-blue"
                : "border-r-2 border-r-team-red",
            )}
          >
            <div className="flex items-start gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center border border-line-2 text-[9px] font-bold",
                  u.alive ? "bg-field" : "bg-line text-faint",
                )}
                title={u.fallback ? `fallback:${u.champ}` : u.champ}
              >
                {u.champ.slice(0, 3).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-1">
                  <span className="truncate font-condensed text-sm uppercase">
                    {SLOT_LABEL[slot]}
                  </span>
                  <span className="text-xs text-dim">L{u.level}</span>
                </div>
                <div className="mt-1 h-1.5 w-full bg-field">
                  <div
                    className={cn("h-full", fill)}
                    style={{ width: `${frac * 100}%` }}
                  />
                </div>
                <div className="mt-0.5 text-[10px] tabular-nums text-dim">
                  {u.alive ? `${Math.round(u.hp)}/${u.maxHp}` : "DEAD"}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
