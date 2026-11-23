import type { ChampAtlas } from "./champ-atlas";

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

export interface WatchAssets {
  terrain: HTMLImageElement;
  pillarsSheet: HTMLImageElement;
  propsSheet: HTMLImageElement;
  pillars: PillarDef[];
  worldProps: WorldPropsAtlas;
  /** Body sheets keyed by champ slug (2× nearest-neighbour sheet). */
  bodySheets: Record<string, HTMLImageElement>;
  bodyAtlases: Record<string, ChampAtlas>;
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

export async function loadWatchAssets(): Promise<WatchAssets> {
  const [terrain, pillarsSheet, propsSheet, tilesJson, propsJson, dummySheet, dummyAtlas] =
    await Promise.all([
      loadImage(`${BASE}/terrain/layoutB-terrain-2x.png`),
      loadImage(`${BASE}/terrain/layoutB-pillars-2x.png`),
      loadImage(`${BASE}/props/world-props.png`),
      fetch(`${BASE}/terrain/layoutB-tiles.json`).then((r) => r.json()),
      fetch(`${BASE}/props/world-props.json`).then((r) => r.json()),
      loadImage(`${BASE}/dummy/dummy-2x.png`),
      fetch(`${BASE}/dummy/atlas.json`).then((r) => r.json()) as Promise<ChampAtlas>,
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

  return {
    terrain,
    pillarsSheet,
    propsSheet,
    pillars,
    worldProps: propsJson as WorldPropsAtlas,
    bodySheets: { dummy: dummySheet },
    bodyAtlases: { dummy: dummyAtlas },
  };
}
