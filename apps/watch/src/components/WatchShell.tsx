import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadWatchAssets, type WatchAssets } from "@watch/lib/assets";
import {
  absStyle,
  arenaDisplaySize,
  DRAWER_W,
  layoutFor,
  MIN_VIEWPORT,
  pickHudMode,
  type HudMode,
} from "@watch/lib/hud-layout";
import { parseJsonl } from "@watch/lib/parse-log";
import { ReplayEngine } from "@watch/lib/replay";
import type { Speed } from "@watch/lib/types";
import { ArenaCanvas } from "./ArenaCanvas";
import { CardToastSlot, DockPanels } from "./DockPanels";
import { DevPanel } from "./DevPanel";
import { EventLogPanel } from "./EventLogPanel";
import { KillFeed } from "./KillFeed";
import { LogLoader } from "./LogLoader";
import { TeamRail } from "./TeamRail";
import { TopBar } from "./TopBar";
import { TransportBar } from "./TransportBar";
type LoadPhase = "boot" | "empty" | "loading" | "ready" | "error";

const SAMPLE_URL = "/samples/seed-20261122.jsonl";

function useViewport() {
  const [size, setSize] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1920,
    h: typeof window !== "undefined" ? window.innerHeight : 1080,
  }));
  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

export function WatchShell() {
  const vp = useViewport();
  const mode: HudMode = pickHudMode(vp.w);
  const layout = layoutFor(mode);
  const belowMin = vp.w < MIN_VIEWPORT.w || vp.h < MIN_VIEWPORT.h;

  const [assets, setAssets] = useState<WatchAssets | null>(null);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [phase, setPhase] = useState<LoadPhase>("boot");
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<ReplayEngine | null>(null);
  const [sourceName, setSourceName] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  const jump = (t: number) => {
    setPlaying(false);
    setTick(t);
  };

  const [stageW, stageH] = layout.canvas;

  const mapSize = arenaDisplaySize(mode);
  // Centre the 1056 map inside the arena_map slot when the slot is wider (1080).
  const mapSlot = layout.arena_map;
  const mapLeft = mapSlot[0] + Math.floor((mapSlot[2] - mapSize.w) / 2);
  const mapTop = mapSlot[1] + Math.floor((mapSlot[3] - mapSize.h) / 2);

  const killFeedRect =
    mode === "720" && layout.dock_panels.kill_feed
      ? layout.dock_panels.kill_feed
      : layout.kill_feed;

  return (
    <div
      className="flex min-h-screen bg-field text-paper"
      data-testid="watch-root"
      data-hud-mode={mode}
      data-drawer-open={drawerOpen ? "true" : "false"}
    >
      {/* Main column — shrinks when drawer pushes in; never covered. */}
      <div
        className="min-w-0 flex-1"
        style={{ overflowX: "auto", overflowY: "auto" }}
      >
        {belowMin ? (
          <div
            data-testid="desktop-notice"
            className="sticky top-0 z-50 border-b border-line bg-panel px-4 py-2 text-center text-sm text-dim"
          >
            Best viewed on desktop (minimum 1280×720)
          </div>
        ) : null}

        <div
          data-testid="hud-stage"
          className="relative bg-field"
          style={{
            width: stageW,
            height: stageH,
            minWidth: stageW,
            minHeight: stageH,
          }}
        >
          <TopBar
            state={state}
            rect={layout.top_bar}
            compact={mode === "720"}
            drawerOpen={drawerOpen}
            onToggleDrawer={() => setDrawerOpen((o) => !o)}
          />

          {phase === "boot" || phase === "loading" ? (
            <div
              data-testid="loading-state"
              style={absStyle(layout.playfield_region)}
              className="flex items-center justify-center bg-panel"
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
              style={absStyle(layout.playfield_region)}
              className="flex items-center justify-center border border-team-red bg-team-red-dark p-4"
              role="alert"
            >
              {assetsError ?? "Failed to start Watch"}
            </div>
          ) : null}

          {phase !== "boot" && phase !== "error" && !engine ? (
            <div
              data-testid="empty-state"
              style={absStyle(layout.playfield_region)}
              className="overflow-auto bg-panel p-4"
            >
              <LogLoader
                onLoadText={loadText}
                onLoadSample={() => void loadSample()}
              />
              {error ? (
                <p className="mt-2 text-sm text-team-red" role="alert">
                  {error}
                </p>
              ) : (
                <p className="mt-2 text-sm text-dim">
                  No match loaded. Drop a log or load the bundled seed 20261122
                  sample.
                </p>
              )}
            </div>
          ) : null}

          {engine && state ? (
            <>
              <TeamRail side="blue" state={state} layout={layout} />
              <TeamRail side="red" state={state} layout={layout} />

              {/* Map frame sized to the canvas (centred in the slot if wider). */}
              <div
                data-testid="arena-map-slot"
                style={{
                  position: "absolute",
                  left: mapLeft,
                  top: mapTop,
                  width: mapSize.w,
                  height: mapSize.h,
                }}
                className="overflow-hidden border border-line bg-field"
              >
                <ArenaCanvas assets={assets} state={state} mode={mode} />
              </div>

              <KillFeed
                events={engine.events}
                currentTick={tick}
                rect={killFeedRect}
                onJump={jump}
              />

              <CardToastSlot rect={layout.card_toast_slot} />

              <DockPanels
                state={state}
                zone={layout.dock_panels.zone}
                pickups={layout.dock_panels.pickups}
                fightCall={layout.dock_panels.fight_call}
              />

              <div
                style={absStyle(layout.dock_panels.watch_transport)}
                className="box-border"
              >
                <TransportBar
                  playing={playing}
                  tick={tick}
                  maxTick={engine.maxTick}
                  speed={speed}
                  seed={state.seed}
                  compact={mode === "720"}
                  onPlayPause={() => setPlaying((p) => !p)}
                  onStep={onStep}
                  onScrub={(t) => jump(t)}
                  onSpeed={setSpeed}
                />
              </div>
            </>
          ) : null}
        </div>

        {/* Below-stage utilities (loader / dev) — outside the fixed HUD chrome */}
        {engine ? (
          <div className="grid gap-3 p-3" style={{ width: stageW }}>
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
        ) : null}
      </div>

      {/* Event log drawer — flex sibling push (never overlays controls). */}
      {drawerOpen ? (
        <div
          data-testid="event-drawer"
          data-overlay="drawer"
          className="flex h-screen shrink-0 flex-col border-l border-line bg-panel"
          style={{ width: DRAWER_W }}
        >
          <EventLogPanel
            events={engine?.events ?? []}
            currentTick={tick}
            onJump={jump}
            onClose={() => setDrawerOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
