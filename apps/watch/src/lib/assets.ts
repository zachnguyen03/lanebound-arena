import {
  collectAtlasFiles,
  normalizeChampAtlas,
  type ChampAtlas,
} from "./champ-atlas";
import { WATCH_CHAMP_SLUGS } from "./champ-assets";
import { parseVfxBlock, type VfxEntry } from "./vfx-atlas";

export interface PillarDef {
  id: "NW" | "NE" | "SW" | "SE";
  rect: [number, number, number, number];
  blit_at_terrain_px: [number, number];
  sort_y_px: number;
}

export interface AtlasFrame {
  rect: [number, number, number, number];
  anchor: [number, number];
  place_terrain_px?: [number, number];
}

export interface WorldPropsAtlas {
  sheet: string;
  sprites: Record<string, AtlasFrame>;
  animations: Record<
    string,
    Record<
      string,
      {
        frames: Array<{
          rect: [number, number, number, number];
          anchor: [number, number];
        }>;
        ms?: number;
        n?: number;
        loop?: boolean;
      }
    >
  >;
  placements: {
    orb_pads: Array<{ tile: [number, number]; ground_px: [number, number] }>;
    buff_pads: Array<{ tile: [number, number]; ground_px: [number, number] }>;
    zone: { centre_px: [number, number]; radius_tiles: number };
  };
}

export interface TeamPortraits {
  /** 64px, integer 1×. Blue prefers the painted portrait when the pack has one. */
  blue?: HTMLImageElement;
  red?: HTMLImageElement;
  /** 24px authored size for the narrow rail. */
  compact?: HTMLImageElement;
}

export interface WatchAssets {
  terrain: HTMLImageElement;
  pillarsSheet: HTMLImageElement;
  propsSheet: HTMLImageElement;
  pillars: PillarDef[];
  worldProps: WorldPropsAtlas;
  /** Body sheets keyed by champ slug. */
  bodySheets: Record<string, HTMLImageElement>;
  bodyAtlases: Record<string, ChampAtlas>;
  /**
   * 2 when the loaded PNG is already a 2× sheet (the training dummy).
   * 1 for authored 18×24 champion cells. The playfield still blits at 2×.
   */
  sheetScale: Record<string, number>;
  portraits: Record<string, TeamPortraits>;
  /** Extra sheets (VFX, falcon, afterimages) keyed `${slug}/${relative}`. */
  artImages: Record<string, HTMLImageElement>;
  /** Parsed atlas `vfx` blocks keyed by champ slug. */
  vfxAtlases: Record<string, Record<string, VfxEntry>>;
}

const BASE = "/arena-sandbox";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

const EXTRA_SLUGS = ["calder", "isra", "mirren", "torun"] as const;

function loadImageOptional(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img.width > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function loadChampion(slug: string): Promise<{
  atlas: ChampAtlas;
  sheet: HTMLImageElement;
  portraits: TeamPortraits;
  artImages: Record<string, HTMLImageElement>;
  vfx: Record<string, VfxEntry>;
} | null> {
  let res: Response;
  try {
    res = await fetch(`/champions/${slug}/atlas.json`);
  } catch {
    return null;
  }
  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!res.ok || type.includes("text/html")) return null;
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return null;
  }
  const atlas = normalizeChampAtlas(raw, slug);
  const sheetRel = atlas.sheet || `sheets/${slug}.png`;
  const sheet = await loadImageOptional(`/champions/${slug}/${sheetRel}`);
  if (!sheet) return null;

  const artImages: Record<string, HTMLImageElement> = {};
  const rels = new Set(collectAtlasFiles(slug, raw));
  // Huntress stores projectile/impact rects on a dedicated sheet plus pngs.
  if (slug === "huntress") {
    for (const extra of [
      "vfx/vfx-sheet.png",
      "vfx/projectile-basic-blue.png",
      "vfx/projectile-basic-red.png",
      "vfx/projectile-skill-blue.png",
      "vfx/projectile-skill-red.png",
      "vfx/impact-blue.png",
      "vfx/impact-red.png",
    ]) {
      rels.add(extra);
    }
  }
  await Promise.all(
    [...rels].map(async (rel) => {
      if (rel === sheetRel) return;
      const img = await loadImageOptional(`/champions/${slug}/${rel}`);
      if (img) artImages[`${slug}/${rel}`] = img;
    }),
  );

  const [painted, blue, red, compact] = await Promise.all([
    loadImageOptional(`/champions/portraits/painted/${slug}/${slug}-64.png`),
    loadImageOptional(`/champions/${slug}/portrait.png`),
    loadImageOptional(`/champions/${slug}/portrait/portrait-red.png`),
    loadImageOptional(`/champions/${slug}/portrait/portrait-24.png`),
  ]);
  const portraits: TeamPortraits = {};
  if (painted || blue) portraits.blue = painted ?? blue ?? undefined;
  if (red || portraits.blue) portraits.red = red ?? portraits.blue;
  if (compact) portraits.compact = compact;
  return { atlas, sheet, portraits, artImages, vfx: parseVfxBlock(raw) };
}

export async function loadWatchAssets(): Promise<WatchAssets> {
  const champSlugs = [...WATCH_CHAMP_SLUGS, ...EXTRA_SLUGS];
  const [terrain, pillarsSheet, propsSheet, tilesJson, propsJson, dummySheet, dummyAtlas, champs] =
    await Promise.all([
      loadImage(`${BASE}/terrain/layoutB-terrain-2x.png`),
      loadImage(`${BASE}/terrain/layoutB-pillars-2x.png`),
      loadImage(`${BASE}/props/world-props.png`),
      fetch(`${BASE}/terrain/layoutB-tiles.json`).then((r) => r.json()),
      fetch(`${BASE}/props/world-props.json`).then((r) => r.json()),
      loadImage(`${BASE}/dummy/dummy-2x.png`),
      fetch(`${BASE}/dummy/atlas.json`).then((r) => r.json()) as Promise<ChampAtlas>,
      Promise.all(champSlugs.map((slug) => loadChampion(slug))),
    ]);

  const rawPillars = tilesJson.pillars as Record<
    string,
    {
      rect: [number, number, number, number];
      blit_at_terrain_px: [number, number];
      sort_y_px: number;
    }
  >;
  const pillars: PillarDef[] = (["NW", "NE", "SW", "SE"] as const).map((id) => ({
    id,
    rect: rawPillars[id]!.rect,
    blit_at_terrain_px: rawPillars[id]!.blit_at_terrain_px,
    sort_y_px: rawPillars[id]!.sort_y_px,
  }));

  const bodySheets: Record<string, HTMLImageElement> = { dummy: dummySheet };
  const bodyAtlases: Record<string, ChampAtlas> = {
    dummy: normalizeChampAtlas(dummyAtlas, "dummy"),
  };
  const sheetScale: Record<string, number> = { dummy: 2 };
  const portraits: Record<string, TeamPortraits> = {};
  const artImages: Record<string, HTMLImageElement> = {};
  const vfxAtlases: Record<string, Record<string, VfxEntry>> = {};
  champs.forEach((loaded, i) => {
    if (!loaded) return;
    const slug = champSlugs[i]!;
    bodySheets[slug] = loaded.sheet;
    bodyAtlases[slug] = loaded.atlas;
    sheetScale[slug] = 1;
    portraits[slug] = loaded.portraits;
    Object.assign(artImages, loaded.artImages);
    vfxAtlases[slug] = loaded.vfx;
  });

  return {
    terrain,
    pillarsSheet,
    propsSheet,
    pillars,
    worldProps: propsJson as WorldPropsAtlas,
    bodySheets,
    bodyAtlases,
    sheetScale,
    portraits,
    artImages,
    vfxAtlases,
  };
}
