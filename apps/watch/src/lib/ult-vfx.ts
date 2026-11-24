/**
 * Signature ult VFX (vfx-ults v1 + v2) and the shared kill burst.
 *
 * Art lives in public/ults/<slug>/: 1x strips + <slug>-timing.json. Strips are
 * blitted at the JSON's integer `scale_in_play` (2, Maelis legacy 4) with
 * nearest-neighbour, so the -2x files are not shipped.
 *
 * Two passes per frame (handoff v1 §3):
 *   ground  — after terrain, before bodies (plus Helvar `air-back`)
 *   air     — after bodies (Helvar `air-front`), then ult CC snap lines
 */
import type { MatchViewState, Team, UltFx } from "./types";

const TILE_W = 44;
const TILE_H = 32;
const BASE = "/ults";
const SNAP_LINE_S = 0.18;
const OUTLINE = "#0E1018";
const TEAM_MID: Record<Team, string> = { blue: "#4DA3FF", red: "#F5477A" };
const TEAM_LIGHT: Record<Team, string> = { blue: "#A0CCFF", red: "#FF96B0" };

export interface StripFrame {
  i: number;
  rect: [number, number, number, number];
  ms: number;
  hit?: boolean;
  phase?: string;
  loop?: boolean;
}

export interface UltLayer {
  cell: [number, number];
  anchor: [number, number];
  frames: StripFrame[];
  img: Record<Team, HTMLImageElement>;
}

type Layers = Partial<Record<"ground" | "air" | "air-back" | "air-front", UltLayer>>;

export interface UltArt {
  slug: string;
  scale: number;
  castS: number;
  landDelayS: number;
  layers: Layers;
  /** Authored facings (e, se, s, ne, n) for directional ults. */
  dirs?: Record<string, Layers>;
}

export interface KillBurstArt {
  normal: { ground: UltLayer; air: UltLayer };
  shutdown: { ground: UltLayer; air: UltLayer };
}

export interface UltArtSet {
  byChamp: Record<string, UltArt>;
  killBurst: KillBurstArt | null;
}

type Anchor = "aim" | "target" | "caster";
type Orient = "none" | "flip" | "8way";

/** Champion → art slug and placement rule (handoffs v1 §2, v2 §2–§3). */
export const ULT_RULES: Record<string, { slug: string; anchor: Anchor; orient: Orient }> = {
  mirren: { slug: "mirren-kiln-chorus", anchor: "aim", orient: "none" },
  isra: { slug: "isra-starfall-mortar", anchor: "aim", orient: "none" },
  sedge: { slug: "sedge-mire-drowse", anchor: "aim", orient: "none" },
  huntress: { slug: "huntress-horizon-volley", anchor: "aim", orient: "flip" },
  kerrig: { slug: "kerrig-reeling-cut", anchor: "target", orient: "8way" },
  rhedan: { slug: "rhedan-keelbreak", anchor: "target", orient: "flip" },
  saelo: { slug: "saelo-still-hour", anchor: "aim", orient: "none" },
  brannoch: { slug: "brannoch-stonefast", anchor: "caster", orient: "flip" },
  ysol: { slug: "ysol-vowbreak", anchor: "aim", orient: "none" },
  torun: { slug: "torun-lock-tide", anchor: "aim", orient: "none" },
  tolle: { slug: "tolle-upwelling", anchor: "aim", orient: "none" },
  calder: { slug: "calder-ash-panic", anchor: "aim", orient: "none" },
  helvar: { slug: "helvar-cliffwake", anchor: "caster", orient: "8way" },
  maelis: { slug: "maelis-duskburst", anchor: "aim", orient: "none" },
};

/** Ult strips run this long after the hit (ground linger is the longest). */
export const ULT_AFTER_HIT_S = 1.3;
/** Upper bound before the hit is known: 0.7 s cast + 1.2 s land + slack. */
export const ULT_PRE_HIT_MAX_S = 2.2;

// ---------------------------------------------------------------------------
// Loading

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

interface RawLayer {
  files: Record<Team, string>;
  cell: [number, number];
  anchor: [number, number];
  frames: StripFrame[];
}

async function loadLayer(dir: string, raw: RawLayer): Promise<UltLayer | null> {
  const [blue, red] = await Promise.all([
    loadImage(`${dir}/${raw.files.blue}`),
    loadImage(`${dir}/${raw.files.red}`),
  ]);
  if (!blue || !red) return null;
  return { cell: raw.cell, anchor: raw.anchor, frames: raw.frames, img: { blue, red } };
}

async function loadLayers(dir: string, raw: Record<string, RawLayer>): Promise<Layers> {
  const out: Layers = {};
  await Promise.all(
    (["ground", "air", "air-back", "air-front"] as const).map(async (k) => {
      if (!raw[k]) return;
      const layer = await loadLayer(dir, raw[k]!);
      if (layer) out[k] = layer;
    }),
  );
  return out;
}

async function loadUlt(slug: string): Promise<UltArt | null> {
  const dir = `${BASE}/${slug}`;
  let json: Record<string, any>;
  try {
    const res = await fetch(`${dir}/${slug}-timing.json`);
    if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html")) return null;
    json = await res.json();
  } catch {
    return null;
  }
  const layers = await loadLayers(dir, json.layers);
  if (!layers.ground && !layers.air) return null;
  let dirs: UltArt["dirs"];
  const authored = json.directions?.authored as Record<string, { layers: Record<string, RawLayer> }> | undefined;
  if (authored) {
    dirs = {};
    await Promise.all(
      Object.entries(authored).map(async ([facing, v]) => {
        dirs![facing] = await loadLayers(dir, v.layers);
      }),
    );
  }
  return {
    slug,
    scale: typeof json.scale_in_play === "number" ? json.scale_in_play : 2,
    castS: json.cast_s ?? 0.5,
    landDelayS: json.land_delay_s ?? 0,
    layers,
    dirs,
  };
}

async function loadKillBurst(): Promise<KillBurstArt | null> {
  const dir = `${BASE}/kill-burst`;
  try {
    const json = await (await fetch(`${dir}/kill-burst-timing.json`)).json();
    const v = json.variants;
    const [ng, na, sg, sa] = await Promise.all([
      loadLayer(dir, v.normal.layers.ground),
      loadLayer(dir, v.normal.layers.air),
      loadLayer(dir, v.shutdown.layers.ground),
      loadLayer(dir, v.shutdown.layers.air),
    ]);
    if (!ng || !na || !sg || !sa) return null;
    return { normal: { ground: ng, air: na }, shutdown: { ground: sg, air: sa } };
  } catch {
    return null;
  }
}

export async function loadUltArt(): Promise<UltArtSet> {
  const champs = Object.keys(ULT_RULES);
  const [arts, killBurst] = await Promise.all([
    Promise.all(champs.map((c) => loadUlt(ULT_RULES[c]!.slug))),
    loadKillBurst(),
  ]);
  const byChamp: Record<string, UltArt> = {};
  champs.forEach((c, i) => {
    if (arts[i]) byChamp[c] = arts[i]!;
  });
  return { byChamp, killBurst };
}

// ---------------------------------------------------------------------------
// Timing

const isWindup = (f: StripFrame) => f.phase === "windup";

/**
 * Strip frame at time t. Wind-up frames loop from `t0`; the remaining frames
 * play once so that the `hit` frame starts exactly at `hitT`.
 */
export function stripFrameAt(
  frames: StripFrame[],
  t0: number,
  hitT: number,
  t: number,
): StripFrame | null {
  const wind = frames.filter(isWindup);
  const post = frames.filter((f) => !isWindup(f));
  let preHitMs = 0;
  for (const f of post) {
    if (f.hit) break;
    preHitMs += f.ms;
  }
  const postStart = hitT - preHitMs / 1000;
  if (t < t0) return null;
  if (t < postStart) {
    if (wind.length === 0) return null;
    const cycle = wind.reduce((s, f) => s + f.ms, 0);
    let ms = ((t - t0) * 1000) % cycle;
    for (const f of wind) {
      if (ms < f.ms) return f;
      ms -= f.ms;
    }
    return wind[wind.length - 1]!;
  }
  let ms = (t - postStart) * 1000;
  for (const f of post) {
    if (ms < f.ms) return f;
    ms -= f.ms;
  }
  return null;
}

export function ultHitT(fx: UltFx, art: UltArt): number {
  return fx.hitT ?? fx.startedAt + art.castS + art.landDelayS;
}

/** 8-way facing of a screen-space vector; w/sw/nw resolve to flipped e/se/ne. */
export function facing8(dx: number, dy: number): { dir: string; flip: boolean } {
  const names = ["e", "se", "s", "sw", "w", "nw", "n", "ne"] as const;
  const ang = Math.atan2(dy * TILE_H, dx * TILE_W);
  const idx = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  const name = names[idx]!;
  const mirror: Record<string, string> = { w: "e", sw: "se", nw: "ne" };
  return mirror[name] ? { dir: mirror[name]!, flip: true } : { dir: name, flip: false };
}

// ---------------------------------------------------------------------------
// Drawing

function blitFrame(
  ctx: CanvasRenderingContext2D,
  layer: UltLayer,
  frame: StripFrame,
  team: Team,
  wx: number,
  wy: number,
  scale: number,
  flip: boolean,
): void {
  const [sx, sy, sw, sh] = frame.rect;
  const [ax, ay] = layer.anchor;
  const ax2 = flip ? layer.cell[0] - ax : ax;
  const dx = Math.round(wx - ax2 * scale);
  const dy = Math.round(wy - ay * scale);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (flip) {
    ctx.translate(dx + sw * scale, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(layer.img[team], sx, sy, sw, sh, 0, 0, sw * scale, sh * scale);
  } else {
    ctx.drawImage(layer.img[team], sx, sy, sw, sh, dx, dy, sw * scale, sh * scale);
  }
  ctx.restore();
}

function ultOrientation(fx: UltFx, art: UltArt): { layers: Layers; flip: boolean } {
  const rule = ULT_RULES[fx.champ];
  if (rule?.orient === "8way" && art.dirs) {
    const { dir, flip } = facing8(fx.dirX, fx.dirY);
    return { layers: art.dirs[dir] ?? art.layers, flip };
  }
  if (rule?.orient === "flip") return { layers: art.layers, flip: fx.facingLeft };
  return { layers: art.layers, flip: false };
}

/** Clip out the caster's enemy sanctuary (Isra kit: no damage inside it). */
export interface SanctuaryRect {
  team: Team;
  x: number;
  y: number;
  w: number;
  h: number;
}

function drawUlt(
  ctx: CanvasRenderingContext2D,
  art: UltArt,
  fx: UltFx,
  t: number,
  keys: Array<keyof Layers>,
  sanctuaries: SanctuaryRect[],
): void {
  const hitT = ultHitT(fx, art);
  const { layers, flip } = ultOrientation(fx, art);
  const clip =
    fx.champ === "isra"
      ? sanctuaries.find((s) => s.team !== fx.team) ?? null
      : null;
  for (const key of keys) {
    const layer = layers[key];
    if (!layer) continue;
    const frame = stripFrameAt(layer.frames, fx.startedAt, hitT, t);
    if (!frame) continue;
    if (clip) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-4096, -4096, 8192, 8192);
      ctx.rect(clip.x, clip.y, clip.w, clip.h);
      ctx.clip("evenodd");
    }
    blitFrame(ctx, layer, frame, fx.team, fx.anchorX * TILE_W, fx.anchorY * TILE_H, art.scale, flip);
    if (clip) ctx.restore();
  }
}

function drawKillBurst(
  ctx: CanvasRenderingContext2D,
  art: KillBurstArt,
  kb: { team: Team; shutdown: boolean; x: number; y: number; startedAt: number },
  t: number,
  pass: "ground" | "air",
): void {
  const v = kb.shutdown ? art.shutdown : art.normal;
  const layer = v[pass];
  // No wind-up: f1 hold-off starts at the death, f2 (hit) one frame later.
  const hitT = kb.startedAt + (layer.frames[0]?.ms ?? 0) / 1000;
  const frame = stripFrameAt(layer.frames, kb.startedAt, hitT, t);
  if (!frame) return;
  // Air anchors on the chest: foot + (0, -12) at 1x.
  const lift = pass === "air" ? 12 * 2 : 0;
  blitFrame(ctx, layer, frame, kb.team, kb.x * TILE_W, kb.y * TILE_H - lift, 2, false);
}

/** Is this status an ult CC (the source's ult landed within 0.25 s)? */
export function ultForStatus(
  state: MatchViewState,
  sourceId: string | null | undefined,
  startedAt: number,
): UltFx | null {
  if (!sourceId) return null;
  for (const fx of state.effects.ults) {
    if (fx.unitId !== sourceId || fx.hitT == null) continue;
    if (startedAt >= fx.hitT - 0.05 && startedAt <= fx.hitT + 0.25) return fx;
  }
  return null;
}

function drawSnapLines(ctx: CanvasRenderingContext2D, state: MatchViewState, t: number): void {
  for (const st of state.effects.statuses) {
    if (t < st.startedAt || t >= st.startedAt + SNAP_LINE_S) continue;
    const fx = ultForStatus(state, st.sourceId, st.startedAt);
    if (!fx) continue;
    const src = state.units[fx.unitId];
    const tgt = state.units[st.targetId];
    if (!src || !tgt || src.id === tgt.id) continue;
    const x0 = src.x * TILE_W;
    const y0 = src.y * TILE_H - 24;
    const x1 = tgt.x * TILE_W;
    const y1 = tgt.y * TILE_H - 24;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = TEAM_LIGHT[fx.team];
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

/** Caster-coloured ring around an ult CC plate (handoff v1 §7). */
export function drawCasterRing(
  ctx: CanvasRenderingContext2D,
  team: Team,
  cx: number,
  cy: number,
  r: number,
): void {
  ctx.save();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = TEAM_MID[team];
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function renderUltPass(
  ctx: CanvasRenderingContext2D,
  ults: UltArtSet | undefined,
  state: MatchViewState,
  pass: "ground" | "air",
  sanctuaries: SanctuaryRect[] = [],
): void {
  if (!ults) return;
  const t = state.t;
  for (const fx of state.effects.ults) {
    if (t < fx.startedAt || t >= fx.endsAt) continue;
    const art = ults.byChamp[fx.champ];
    if (!art) continue;
    const split = !!(art.layers["air-back"] && art.layers["air-front"]);
    const keys: Array<keyof Layers> =
      pass === "ground"
        ? split
          ? ["ground", "air-back"]
          : ["ground"]
        : split
          ? ["air-front"]
          : ["air"];
    drawUlt(ctx, art, fx, t, keys, sanctuaries);
  }
  if (ults.killBurst) {
    for (const kb of state.effects.killBursts) {
      if (t < kb.startedAt || t >= kb.endsAt) continue;
      drawKillBurst(ctx, ults.killBurst, kb, t, pass);
    }
  }
  if (pass === "air") drawSnapLines(ctx, state, t);
}

export function hasUltArt(ults: UltArtSet | undefined, champ: string): boolean {
  return !!ults?.byChamp[champ];
}

