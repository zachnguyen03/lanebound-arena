/**
 * VFX tuning gallery (`/?vfx=huntress:Q`). Dev tool, view-only.
 *
 * Replays real casts from two fixed matches (every shipped champion) through
 * the normal ReplayEngine + renderArena, loops a window around one cast, and
 * edits the live VFX_TUNING table. Hitbox overlay = kit radius/width, the
 * reference the art should match. "Copy JSON" → paste into public/vfx-tuning.json.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { loadWatchAssets, type WatchAssets } from "@watch/lib/assets";
import { ARENA_INTRINSIC } from "@watch/lib/hud-layout";
import { canonicalConfig, runFromConfig } from "@watch/lib/live-match";
import { renderArena } from "@watch/lib/render-arena";
import { ReplayEngine } from "@watch/lib/replay";
import { skillMetaByName, type SkillMeta } from "@watch/lib/skill-meta";
import type { MatchEffects, MatchViewState } from "@watch/lib/types";
import { tuneFor, VFX_TUNING, type VfxTune } from "@watch/lib/vfx-tuning";

const TILE_W = 44;
const TILE_H = 32;
const PRE_S = 0.4;
const POST_S = 2.2;
const EXTRA_BLUE = ["torun", "calder", "isra", "huntress", "mirren"];

interface Cast {
  engine: ReplayEngine;
  unitId: string;
  team: string;
  t: number;
  skillId: string;
}

function buildEngines(assets: WatchAssets): ReplayEngine[] {
  const known = new Set<string>(["dummy", ...Object.keys(assets.bodyAtlases)]);
  const a = canonicalConfig(20261122);
  const b = canonicalConfig(20261125);
  b.blue = { ...b.blue, picks: EXTRA_BLUE.slice() };
  return [a, b].map((c) => new ReplayEngine(runFromConfig(c).result.events, known));
}

/** Every cast of `champ:key` in both matches (autos: projectile spawns). */
function findCasts(engines: ReplayEngine[], champ: string, key: string): Cast[] {
  const out: Cast[] = [];
  for (const engine of engines) {
    const end = engine.stateAt(engine.maxTick);
    const champOf = (id: string) => end.units[id as keyof typeof end.units]?.champ;
    if (key === "auto") {
      for (const p of end.effects.projectiles) {
        if (p.isAuto && p.champ === champ && out.length < 40) {
          out.push({ engine, unitId: p.unitId, team: p.team, t: p.spawnT, skillId: p.skillId });
        }
      }
      continue;
    }
    for (const ev of engine.eventsUpTo(engine.maxTick)) {
      if (ev.type !== "cast_start") continue;
      const id = String(ev.unit_id);
      if (champOf(id) !== champ) continue;
      const meta = skillMetaByName(String(ev.skill_id));
      if (meta?.key !== key) continue;
      out.push({ engine, unitId: id, team: id.split(":")[0]!, t: ev.t, skillId: String(ev.skill_id) });
    }
  }
  return out;
}

/** Keep only effects from the selected caster so the frame is readable. */
function isolate(effects: MatchEffects, unitId: string): MatchEffects {
  const mine = <T extends { unitId?: string; sourceId?: string | null }>(l: T[]) =>
    l.filter((x) => x.unitId === unitId || x.sourceId === unitId);
  return {
    telegraphs: mine(effects.telegraphs),
    projectiles: mine(effects.projectiles),
    hitFlashes: mine(effects.hitFlashes),
    statuses: mine(effects.statuses),
    skillTags: mine(effects.skillTags),
    ultPulses: mine(effects.ultPulses),
    casterFlashes: mine(effects.casterFlashes),
    ults: mine(effects.ults),
    killBursts: [],
    damageNums: [],
  };
}

function drawHitbox(ctx: CanvasRenderingContext2D, state: MatchViewState, meta: SkillMeta | null, unitId: string): void {
  if (!meta) return;
  ctx.save();
  ctx.strokeStyle = "#FFE14D";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  const at = (x: number, y: number) => [x * TILE_W, y * TILE_H] as const;
  for (const tl of state.effects.telegraphs) {
    if (tl.unitId !== unitId || state.t < tl.startedAt || state.t >= tl.endsAt + 0.6) continue;
    const caster = state.units[tl.unitId];
    if (meta.radius > 0) {
      const [cx, cy] = at(tl.aimX, tl.aimY);
      ctx.beginPath();
      ctx.ellipse(cx, cy, meta.radius * TILE_W, meta.radius * TILE_H, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (caster && meta.telegraph === "line") {
      const [x0, y0] = at(caster.x, caster.y);
      const dx = tl.aimX - caster.x;
      const dy = tl.aimY - caster.y;
      const len = Math.hypot(dx, dy) || 1;
      const [x1, y1] = at(caster.x + (dx / len) * meta.range, caster.y + (dy / len) * meta.range);
      // Half-width offset in tiles, perpendicular to the cast.
      const ox = (-dy / len) * (meta.width / 2);
      const oy = (dx / len) * (meta.width / 2);
      ctx.beginPath();
      ctx.moveTo(x0 + ox * TILE_W, y0 + oy * TILE_H);
      ctx.lineTo(x1 + ox * TILE_W, y1 + oy * TILE_H);
      ctx.lineTo(x1 - ox * TILE_W, y1 - oy * TILE_H);
      ctx.lineTo(x0 - ox * TILE_W, y0 - oy * TILE_H);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}

const SLIDERS: Array<{ k: keyof VfxTune; min: number; max: number; step: number }> = [
  { k: "scale", min: 0.25, max: 2, step: 0.25 },
  { k: "dx", min: -40, max: 40, step: 1 },
  { k: "dy", min: -40, max: 40, step: 1 },
  { k: "alpha", min: 0, max: 1, step: 0.05 },
  { k: "timeMul", min: 0.25, max: 3, step: 0.05 },
  { k: "leadS", min: -0.5, max: 0.5, step: 0.02 },
];

export function VfxGallery() {
  const [assets, setAssets] = useState<WatchAssets | null>(null);
  const [engines, setEngines] = useState<ReplayEngine[]>([]);
  const [sel, setSel] = useState(() => new URLSearchParams(location.search).get("vfx") || "huntress:Q");
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(0.5);
  const [only, setOnly] = useState(true);
  const [hitbox, setHitbox] = useState(true);
  const [rel, setRel] = useState(0); // seconds since window start
  const [, bump] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    void loadWatchAssets().then((a) => {
      setAssets(a);
      setEngines(buildEngines(a));
    });
  }, []);

  const [champ, key] = sel.split(":") as [string, string];
  const casts = useMemo(() => (engines.length ? findCasts(engines, champ, key) : []), [engines, champ, key]);
  const cast = casts[Math.min(idx, casts.length - 1)];
  const meta = cast ? skillMetaByName(cast.skillId) : null;
  const options = useMemo(() => {
    const champs = new Set<string>();
    for (const e of engines) for (const u of Object.values(e.stateAt(0).units)) champs.add(u.champ);
    return [...champs].sort().flatMap((c) => ["Q", "W", "R", "auto"].map((k) => `${c}:${k}`));
  }, [engines]);

  // Clock: loop [cast.t - PRE_S, cast.t + POST_S] at `speed`.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = ((now - last) / 1000) * speed;
      last = now;
      setRel((r) => (r + dt) % (PRE_S + POST_S));
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !assets || !cast) return;
    const t = Math.max(0, cast.t - PRE_S + rel);
    const base = cast.engine.stateAt(Math.floor(t * 10 + 1e-9));
    const state: MatchViewState = {
      ...base,
      t,
      effects: only ? isolate(base.effects, cast.unitId) : base.effects,
    };
    renderArena(ctx, assets, state, { height: ARENA_INTRINSIC.h, vfx: true });
    if (hitbox) drawHitbox(ctx, state, meta, cast.unitId);
    // 2× zoom around the caster/aim midpoint.
    const zctx = zoomRef.current?.getContext("2d");
    const caster = state.units[cast.unitId as keyof typeof state.units];
    const tl = base.effects.telegraphs.find((x) => x.unitId === cast.unitId && Math.abs(x.startedAt - cast.t) < 0.05);
    if (zctx && caster) {
      // Area skills: centre on the aim. Lines: midpoint caster → aim.
      const k = meta && meta.radius > 0 ? 1 : 0.5;
      const mx = (caster.x + ((tl?.aimX ?? caster.x) - caster.x) * k) * TILE_W;
      const my = (caster.y + ((tl?.aimY ?? caster.y) - caster.y) * k) * TILE_H;
      const w = 352 / 2;
      const h = 192 / 2;
      zctx.imageSmoothingEnabled = false;
      zctx.fillStyle = "#000";
      zctx.fillRect(0, 0, 704, 384);
      zctx.drawImage(ctx.canvas, mx - w, my - h, w * 2, h * 2, 0, 0, 704, 384);
    }
  }, [assets, cast, rel, only, hitbox, meta]);

  const tuneKey = `${champ}:${key}`;
  const tune = tuneFor(champ, key === "auto" ? null : key, key === "auto");
  const setTune = (k: keyof VfxTune, v: number) => {
    VFX_TUNING[tuneKey] = { ...VFX_TUNING[tuneKey], [k]: v };
    bump((n) => n + 1);
  };
  const tLabel = cast ? (cast.t - PRE_S + rel).toFixed(2) : "-";

  return (
    <div style={{ padding: 12, color: "#ddd", background: "#111", minHeight: "100vh", fontFamily: "monospace", fontSize: 13 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <select data-testid="vfx-skill" value={sel} onChange={(e) => { setSel(e.target.value); setIdx(0); history.replaceState(null, "", `?vfx=${e.target.value}`); }}>
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
        <span>{meta ? `${meta.name} (${meta.shape}, r ${meta.radius}, w ${meta.width}, range ${meta.range})` : key}</span>
        <button onClick={() => setIdx((i) => Math.max(0, i - 1))}>◀</button>
        <span data-testid="vfx-cast">cast {casts.length ? idx + 1 : 0}/{casts.length} {cast ? `${cast.team} t=${cast.t.toFixed(1)}` : ""}</span>
        <button onClick={() => setIdx((i) => Math.min(casts.length - 1, i + 1))}>▶</button>
        <button onClick={() => setPlaying((p) => !p)}>{playing ? "pause" : "play"}</button>
        <button onClick={() => { setPlaying(false); setRel((r) => Math.max(0, r - 1 / 60)); }}>-1f</button>
        <button onClick={() => { setPlaying(false); setRel((r) => r + 1 / 60); }}>+1f</button>
        {[0.25, 0.5, 1].map((s) => (
          <button key={s} style={{ fontWeight: s === speed ? "bold" : undefined }} onClick={() => setSpeed(s)}>{s}×</button>
        ))}
        <label><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> caster only</label>
        <label><input type="checkbox" checked={hitbox} onChange={(e) => setHitbox(e.target.checked)} /> hitbox</label>
      </div>
      <input
        data-testid="vfx-scrub"
        type="range" min={0} max={PRE_S + POST_S} step={0.01} value={rel} style={{ width: 1056 }}
        onChange={(e) => { setPlaying(false); setRel(Number(e.target.value)); }}
      />
      <span> t={tLabel}</span>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <canvas ref={canvasRef} data-testid="vfx-canvas" width={ARENA_INTRINSIC.w} height={ARENA_INTRINSIC.h} style={{ imageRendering: "pixelated" }} />
        <div>
          <canvas ref={zoomRef} data-testid="vfx-zoom" data-hit-rel={meta ? PRE_S + meta.cast_s + meta.land_delay_s : PRE_S} width={704} height={384} style={{ imageRendering: "pixelated", border: "1px solid #333" }} />
          <div style={{ marginTop: 8 }}>
            <b>{tuneKey}</b> (view only; merges "*" &lt; "{champ}" &lt; "{tuneKey}")
            {SLIDERS.map(({ k, min, max, step }) => (
              <div key={k} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ width: 60 }}>{k}</span>
                <input type="range" min={min} max={max} step={step} value={tune[k]} onChange={(e) => setTune(k, Number(e.target.value))} />
                <span>{tune[k]}</span>
              </div>
            ))}
            <button onClick={() => { delete VFX_TUNING[tuneKey]; bump((n) => n + 1); }}>reset {tuneKey}</button>{" "}
            <button onClick={() => void navigator.clipboard.writeText(JSON.stringify(VFX_TUNING, null, 2) + "\n")}>copy JSON</button>
            <pre data-testid="vfx-json" style={{ maxWidth: 704, whiteSpace: "pre-wrap" }}>{JSON.stringify(VFX_TUNING, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
