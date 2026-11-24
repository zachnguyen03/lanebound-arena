import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { loadWatchAssets, type WatchAssets } from "@watch/lib/assets";
import {
  absStyle,
  arenaDisplaySize,
  DRAWER_W,
  layoutFor,
  layoutForPushDrawer,
  MIN_VIEWPORT,
  pickHudMode,
  type HudMode,
} from "@watch/lib/hud-layout";
import { parseJsonl } from "@watch/lib/parse-log";
import { ReplayEngine } from "@watch/lib/replay";
import { countActiveVfx } from "@watch/lib/render-vfx";
import { CHAMP_ART, type Speed } from "@watch/lib/types";
import { ArenaCanvas } from "./ArenaCanvas";
import {
  championAssetMissing,
  championAssetPaths,
  WATCH_CHAMP_SLUGS,
} from "@watch/lib/champ-assets";
import {
  ConfigError,
  exportConfigJson,
  importConfigJson,
  runFromConfig,
  runClockAiMatch,
  runWatchMatch,
} from "@watch/lib/live-match";
import type { MatchConfig } from "@sim/types";
import type { SimEvent } from "@watch/lib/types";
import { CardToastSlot, DockPanels } from "./DockPanels";
import { DecisionStrip } from "./DecisionStrip";
import { DevPanel } from "./DevPanel";
import { EventLogPanel } from "./EventLogPanel";
import { KillFeed } from "./KillFeed";
import { LogLoader } from "./LogLoader";
import { MatchSetup } from "./MatchSetup";
import { TeamRail } from "./TeamRail";
import { TopBar } from "./TopBar";
import { TransportBar } from "./TransportBar";

type LoadPhase = "boot" | "empty" | "loading" | "ready" | "error";
/** 1080: column push + stage shift. 720: modal over dimmed stage. */
type DrawerMode = "push" | "modal";

const SAMPLE_URL = "/samples/seed-20261122.jsonl";

function useViewport() {
  const [size, setSize] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 1920,
    h: typeof window !== "undefined" ? window.innerHeight : 1080,
  }));
  useEffect(() => {
    const onResize = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

interface WatchShellProps {
  /** Staged §15 overrides from the Lab tuning panel — applied on next run only. */
  stagedConstants?: Record<string, unknown>;
  onOpenLab?: () => void;
  dirty?: boolean;
}

export function WatchShell({
  stagedConstants = {},
  onOpenLab,
  dirty = false,
}: WatchShellProps = {}) {
  const vp = useViewport();
  const mode: HudMode = pickHudMode(vp.w);
  const belowMin = vp.w < MIN_VIEWPORT.w || vp.h < MIN_VIEWPORT.h;
  const drawerMode: DrawerMode = mode === "1080" ? "push" : "modal";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [overlays, setOverlays] = useState(false);
  const [vfx, setVfx] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [liveConfig, setLiveConfig] = useState<MatchConfig | null>(null);
  const [deathEvent, setDeathEvent] = useState<SimEvent | null>(null);
  const [missingAssets, setMissingAssets] = useState<string[]>([]);
  const [artChecked, setArtChecked] = useState(false);
  const [exportedJson, setExportedJson] = useState<string | null>(null);
  const [liveDigest, setLiveDigest] = useState<string | null>(null);
  const pushOpen = drawerOpen && drawerMode === "push";
  const modalOpen = drawerOpen && drawerMode === "modal";
  // 1080 + drawer: rebuild stage to fit remaining width (no translateX).
  const layout =
    pushOpen ? layoutForPushDrawer(vp.w) : layoutFor(mode);

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
  const speedRef = useRef(1);
  /** Elapsed fraction of the current tick, for sub-tick VFX drawing. */
  const subTick = useCallback(() => (accRef.current * speedRef.current) / 100, []);
  const modalRef = useRef<HTMLDivElement>(null);

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
      const eng = new ReplayEngine(events, artReady(assets));
      setEngine(eng);
      setLiveDigest(eng.digest);
      setSourceName(name);
      setTick(0);
      setPhase("ready");
    } catch (e) {
      setEngine(null);
      setError(e instanceof Error ? e.message : "Failed to parse log");
      setPhase("empty");
    }
  }, [assets]);

  const startLive = useCallback(
    (seed: number, preset: "hold_the_pit" | "clock_ai" = "hold_the_pit") => {
      setPhase("loading");
      setError(null);
      setConfigError(null);
      setPlaying(false);
      try {
        const { config, result, digest } =
          preset === "clock_ai"
            ? runClockAiMatch(seed, stagedConstants)
            : runWatchMatch(seed, stagedConstants);
        const eng = new ReplayEngine(result.events, artReady(assets));
        setEngine(eng);
        setLiveDigest(digest);
        setLiveConfig(config);
        setSourceName(
          preset === "clock_ai" ? `clock AI seed ${seed}` : `live seed ${seed}`,
        );
        setTick(0);
        setDeathEvent(null);
        setPhase("ready");
      } catch (e) {
        if (e instanceof ConfigError) {
          setConfigError(e.message);
          setError(null);
        } else {
          setError(e instanceof Error ? e.message : "Match failed");
        }
        setPhase("empty");
      }
    },
    [assets, stagedConstants],
  );

  const importConfig = useCallback((text: string) => {
    setPhase("loading");
    setPlaying(false);
    try {
      const config = importConfigJson(text);
      const { result, digest, config: canonical } = runFromConfig(config);
      const eng = new ReplayEngine(result.events, artReady(assets));
      setEngine(eng);
      setLiveDigest(digest);
      setLiveConfig(canonical);
      setSourceName("imported config");
      setTick(0);
      setPhase("ready");
      setConfigError(null);
    } catch (e) {
      setError(null);
      if (e instanceof SyntaxError) {
        setConfigError("That file is not valid JSON.");
      } else if (e instanceof ConfigError) {
        setConfigError(e.message);
      } else {
        setConfigError(
          e instanceof Error ? e.message : "Could not load that match file.",
        );
      }
      setPhase("empty");
    }
  }, [assets]);

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

  useEffect(() => {
    let cancelled = false;
    const slugs = WATCH_CHAMP_SLUGS;
    void (async () => {
      const missing: string[] = [];
      for (const slug of slugs) {
        for (const path of championAssetPaths(slug)) {
          if (await championAssetMissing(path)) missing.push(path);
        }
      }
      if (!cancelled) {
        setMissingAssets(missing);
        setArtChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    speedRef.current = speed;
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

  // Escape closes the drawer at every size (push + modal).
  useEffect(() => {
    if (!drawerOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setDrawerOpen(false);
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [drawerOpen]);

  // Focus trap for modal drawer only.
  useEffect(() => {
    if (!drawerOpen || drawerMode !== "modal") return;
    const root = modalRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusables[0];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || focusables.length === 0) return;
      const list = [...focusables];
      const i = list.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey) {
        if (i <= 0) {
          e.preventDefault();
          list[list.length - 1]?.focus();
        }
      } else if (i === list.length - 1) {
        e.preventDefault();
        list[0]?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, drawerMode]);

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
  // Below the desktop minimum, scale the 1280 HUD to the viewport width so
  // every control stays hittable without horizontal scroll. Banner is fixed.
  const fitScale = belowMin ? Math.min(1, vp.w / stageW) : 1;
  const scaled = fitScale < 1;

  const mapSize = arenaDisplaySize(mode);
  const mapSlot = layout.arena_map;
  const mapLeft = mapSlot[0] + Math.floor((mapSlot[2] - mapSize.w) / 2);
  const mapTop = mapSlot[1] + Math.floor((mapSlot[3] - mapSize.h) / 2);

  const killFeedRect = layout.dock_panels.kill_feed ?? layout.kill_feed;

  const drawerPanel = (
    <EventLogPanel
      events={engine?.events ?? []}
      currentTick={tick}
      onJump={jump}
      onClose={() => setDrawerOpen(false)}
    />
  );

  return (
    <div
      className="flex min-h-screen bg-field text-paper"
      data-testid="watch-root"
      data-hud-mode={mode}
      data-drawer-open={drawerOpen ? "true" : "false"}
      data-drawer-mode={drawerMode}
      data-overlays={overlays ? "true" : "false"}
      data-vfx={vfx ? "true" : "false"}
      data-vfx-count={state ? String(countActiveVfx(state)) : "0"}
      data-fit-scale={fitScale.toFixed(4)}
      data-match-end={
        (engine?.events.find((e) => e.type === "match_end")?.reason as
          | string
          | undefined) ?? ""
      }
      data-digest={liveDigest ?? engine?.digest ?? ""}
      data-art-checked={artChecked ? "true" : "false"}
    >
      {belowMin ? (
        <div
          data-testid="desktop-notice"
          className="fixed left-0 right-0 top-0 z-50 border-b border-line bg-panel px-4 py-2 text-center text-sm text-dim"
        >
          Best viewed on desktop (minimum 1280×720)
        </div>
      ) : null}

      <div
        className={
          pushOpen
            ? "flex min-w-0 flex-1 flex-col items-center overflow-hidden"
            : "min-w-0 flex-1"
        }
        style={{
          overflowX: pushOpen || scaled ? "hidden" : "auto",
          overflowY: "auto",
          paddingTop: belowMin ? 40 : 0,
        }}
      >
        <div
          data-testid="hud-fit"
          style={
            scaled
              ? {
                  width: stageW * fitScale,
                  // Stage only; utilities sit in a second scaled block below.
                  height: stageH * fitScale,
                  overflow: "hidden",
                }
              : undefined
          }
        >
        <div
          data-testid="hud-stage"
          className="relative bg-field"
          style={{
            width: stageW,
            height: stageH,
            minWidth: stageW,
            minHeight: stageH,
            transform: scaled ? `scale(${fitScale})` : undefined,
            transformOrigin: "top left",
          }}
        >
          <TopBar
            state={state}
            rect={layout.top_bar}
            compact={mode === "720" || pushOpen}
            drawerOpen={drawerOpen}
            onToggleDrawer={() => setDrawerOpen((o) => !o)}
            overlays={overlays}
            onToggleOverlays={() => setOverlays((o) => !o)}
            vfx={vfx}
            onToggleVfx={() => setVfx((o) => !o)}
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
              <MatchSetup
                busy={phase === "loading"}
                onStart={startLive}
                onStartClockAi={(seed) => startLive(seed, "clock_ai")}
                onImportText={importConfig}
                onOpenLab={onOpenLab}
                dirty={dirty}
              />
              {configError ? (
                <p
                  data-testid="config-error"
                  className="mt-2 text-sm text-team-red"
                  role="alert"
                >
                  {configError}
                </p>
              ) : null}
              <LogLoader
                onLoadText={loadText}
                onLoadSample={() => void loadSample()}
              />
              {missingAssets.length > 0 ? (
                <MissingArtList paths={missingAssets} />
              ) : null}
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
              <TeamRail
                side="blue"
                state={state}
                layout={layout}
                portraits={assets?.portraits}
              />
              <TeamRail
                side="red"
                state={state}
                layout={layout}
                portraits={assets?.portraits}
              />

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
                <ArenaCanvas
                  assets={assets}
                  state={state}
                  mode={mode}
                  overlays={overlays}
                  vfx={vfx}
                  subTick={playing ? subTick : undefined}
                />
              </div>

              <KillFeed
                events={engine.events}
                currentTick={tick}
                rect={killFeedRect}
                onJump={jump}
                onDeath={(ev) => {
                  setDeathEvent(ev);
                  jump(ev.tick);
                }}
              />

              <CardToastSlot rect={layout.card_toast_slot} />

              {deathEvent ? (
                <div
                  data-testid="decision-strip-slot"
                  style={decisionStripBox(layout)}
                  className="z-30"
                >
                  <DecisionStrip
                    events={engine.events}
                    death={deathEvent}
                    onClose={() => setDeathEvent(null)}
                  />
                </div>
              ) : null}

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
                  compact={mode === "720" || pushOpen}
                  onPlayPause={() => setPlaying((p) => !p)}
                  onStep={onStep}
                  onScrub={(t) => jump(t)}
                  onSpeed={setSpeed}
                />
              </div>
            </>
          ) : null}
        </div>
        </div>

        {engine ? (
          <div
            data-testid="below-stage-utilities"
            style={{ width: scaled ? vp.w : stageW }}
            className="border-t border-line bg-field"
          >
            {!scaled && vp.h > stageH ? (
              <div
                data-testid="under-hud-spacer"
                aria-hidden
                className="border-b border-line bg-field"
                style={{ height: vp.h - stageH }}
              />
            ) : null}
            <div className="px-3 pt-2 font-condensed text-xs tracking-wide text-dim">
              UTILITIES
            </div>
            <div className="grid gap-3 p-3 pt-2">
              <MatchSetup
                busy={phase === "loading"}
                onStart={startLive}
                onStartClockAi={(seed) => startLive(seed, "clock_ai")}
                onExport={() => {
                  if (!liveConfig) return;
                  const json = exportConfigJson(liveConfig);
                  setExportedJson(json);
                }}
                onImportText={importConfig}
                canExport={!!liveConfig}
                onOpenLab={onOpenLab}
                dirty={dirty}
              />
              {exportedJson ? (
                <pre
                  data-testid="exported-config"
                  className="max-h-40 overflow-auto text-[10px] text-dim"
                >
                  {exportedJson}
                </pre>
              ) : null}
              {configError ? (
                <p data-testid="config-error" className="text-sm text-team-red" role="alert">
                  {configError}
                </p>
              ) : null}
              {missingAssets.length > 0 ? (
                <MissingArtList paths={missingAssets} />
              ) : null}
              <LogLoader
                onLoadText={loadText}
                onLoadSample={() => void loadSample()}
              />
              {import.meta.env.DEV ? (
                <DevPanel
                  state={state}
                  digest={liveDigest}
                  sourceName={sourceName}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* 1080: real flex column — stage re-centres in remaining width (no transform). */}
      {pushOpen ? (
        <div
          data-testid="event-drawer"
          data-drawer-kind="push"
          className="flex h-screen shrink-0 flex-col border-l border-line bg-panel"
          style={{ width: DRAWER_W }}
        >
          {drawerPanel}
        </div>
      ) : null}

      {/* 720: modal over dimmed stage; focus trapped; Close / Escape. */}
      {modalOpen ? (
        <div
          ref={modalRef}
          data-testid="event-drawer"
          data-drawer-kind="modal"
          data-overlay="drawer-modal"
          className="pointer-events-none fixed inset-0 z-[60] flex items-start justify-center pt-12"
          role="dialog"
          aria-label="Event log"
        >
          {/* Not aria-modal: this dim layer does not take clicks, so transport stays usable. */}
          <div
            data-testid="drawer-backdrop"
            className="absolute inset-0 bg-black/55"
            aria-hidden
          />
          {/* Height capped above the 720 dock (y≈572) so kill-feed / transport stay hittable. */}
          <div
            className="pointer-events-auto relative z-[61] flex max-h-[500px] w-full max-w-md flex-col border border-line bg-panel shadow-lg"
            style={{ width: DRAWER_W }}
          >
            {drawerPanel}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function artReady(assets: WatchAssets | null): Set<string> {
  const set = new Set<string>(CHAMP_ART);
  if (!assets) return set;
  for (const slug of Object.keys(assets.bodyAtlases)) set.add(slug);
  return set;
}

function decisionStripBox(layout: {
  dock: readonly [number, number, number, number];
  playfield_region: readonly [number, number, number, number];
}) {
  const height = 148;
  const play = layout.playfield_region;
  const width = Math.min(720, play[2] - 16);
  const left = play[0] + Math.floor((play[2] - width) / 2);
  const top = layout.dock[1] - height - 4;
  return {
    position: "absolute" as const,
    left,
    top,
    width,
    height,
  };
}

function MissingArtList({ paths }: { paths: string[] }) {
  return (
    <div data-testid="missing-assets" className="mt-3 text-xs text-dim">
      <div className="font-condensed text-sm text-paper">MISSING CHAMPION ART</div>
      <p className="mt-1 text-paper">
        Champion pictures are not in this build. These files are missing:
      </p>
      <ul>
        {paths.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}
