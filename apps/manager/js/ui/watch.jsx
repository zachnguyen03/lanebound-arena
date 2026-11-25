// Watch match view inside the manager: re-simulates a summary's MatchConfig with unit positions and plays it with
// Watch's ReplayEngine, arena renderer, top HUD, kill banner and player rails (720 layout, top 572 px of the stage).
import { createRoot } from 'react-dom/client';
import { simulate } from '@sim/simulate';
import { loadWatchAssets } from '@watch/lib/assets';
import { HUD_720 } from '@watch/lib/hud-layout';
import { ReplayEngine } from '@watch/lib/replay';
import { CHAMP_ART } from '@watch/lib/types';
import { ArenaCanvas } from '@watch/components/ArenaCanvas';
import { TopHud } from '@watch/components/TopHud';
import { TeamRail } from '@watch/components/TeamRail';
import { KillBanner } from '@watch/components/KillBanner';
import './watch.css';

export const STAGE = { w: 1280, h: 572 };
let assetsP = null;
const L = HUD_720, [mx, my, mw, mh] = L.arena_map;

function Stage({ assets, engine, tick, next, subTick, names }) {
  const state = engine.stateAt(tick);
  return (
    <div className="watch-stage relative bg-field" style={{ width: STAGE.w, height: STAGE.h }}>
      <div className="absolute inset-x-0 top-0 z-40" style={{ height: L.top_bar[3] }}>
        <div className="absolute inset-x-0" style={{ top: 7 }}><TopHud state={state} compact /></div>
        <span className="watch-name blue">{names[0]}</span><span className="watch-name red">{names[1]}</span>
      </div>
      <TeamRail side="blue" state={state} layout={L} portraits={assets?.portraits} />
      <TeamRail side="red" state={state} layout={L} portraits={assets?.portraits} />
      <div className="absolute overflow-hidden border border-line bg-field" style={{ left: mx, top: my, width: mw, height: mh }}>
        {assets ? <ArenaCanvas assets={assets} state={state} mode="720" vfx subTick={subTick} next={next} /> : <div className="p-4 text-dim">Loading arena…</div>}
        <KillBanner events={engine.events} currentTick={tick} state={state} portraits={assets?.portraits} />
      </div>
    </div>
  );
}

// Mounts the view in el. opts: { names: [blue, red], speed, paused, startT, scale, onTick(t), onEnd() }.
// Returns a controller: setSpeed(n) (0 pauses), seek(t), toEnd(), destroy(). t is in seconds.
export function mountMatch(el, config, opts = {}) {
  const engine = new ReplayEngine(simulate({ ...config, debug_pos: true }).events, new Set([...CHAMP_ART, ...config.blue.picks, ...config.red.picks]));
  const root = createRoot(el);
  let assets = null, tick = Math.min(engine.maxTick, Math.round((opts.startT ?? 0) * 10)), speed = opts.paused ? 0 : (opts.speed ?? 1), acc = 0, last = null, raf = 0, ended = false;
  if (opts.scale && opts.scale !== 1) Object.assign(el.style, { width: `${STAGE.w * opts.scale}px`, height: `${STAGE.h * opts.scale}px`, overflow: 'hidden' });
  const subTick = () => (acc * speed) / 100;
  const draw = () => {
    const playing = speed > 0 && tick < engine.maxTick;
    root.render(<div style={opts.scale ? { transform: `scale(${opts.scale})`, transformOrigin: 'top left' } : undefined}>
      <Stage assets={assets} engine={engine} tick={tick} next={playing ? engine.stateAt(tick + 1) : null} subTick={playing ? subTick : undefined} names={opts.names ?? ['Blue', 'Red']} />
    </div>);
    opts.onTick?.(tick / 10);
    if (tick >= engine.maxTick && !ended) { ended = true; opts.onEnd?.(); }
  };
  const loop = ts => {
    if (!el.isConnected) return api.destroy();
    if (speed > 0 && tick < engine.maxTick) {
      acc += ts - (last ?? ts);
      const ms = 100 / speed; let n = 0;
      while (acc >= ms) { acc -= ms; n++; }
      if (n) { tick = Math.min(engine.maxTick, tick + n); draw(); }
    }
    last = ts;
    raf = requestAnimationFrame(loop);
  };
  const api = {
    maxT: engine.maxTick / 10,
    setSpeed(s) { speed = s; acc = 0; draw(); },
    seek(t) { tick = Math.max(0, Math.min(engine.maxTick, Math.round(t * 10))); acc = 0; if (tick < engine.maxTick) ended = false; draw(); },
    toEnd() { api.seek(api.maxT); },
    destroy() { cancelAnimationFrame(raf); setTimeout(() => root.unmount()); },
  };
  (assetsP ??= loadWatchAssets()).then(a => { assets = a; if (el.isConnected) draw(); }).catch(e => console.warn('Arena art failed to load', e));
  draw();
  raf = requestAnimationFrame(loop);
  return api;
}
