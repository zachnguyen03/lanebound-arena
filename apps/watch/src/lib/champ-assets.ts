/** Paths Watch probes for authored champion art. Missing files are listed, never swapped for dummy. */

export const WATCH_CHAMP_SLUGS = [
  "brannoch",
  "sedge",
  "kerrig",
  "huntress",
  "ysol",
  "rhedan",
  "tolle",
  "helvar",
  "maelis",
  "saelo",
] as const;

export function championAssetPaths(slug: string): string[] {
  return [
    `/champions/${slug}/atlas.json`,
    `/champions/${slug}/portrait.png`,
  ];
}
