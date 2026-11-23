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

/**
 * True when the URL is missing. A 200 HTML document from the SPA fallback
 * is not an asset: require the content-type, then decode JSON or the image.
 */
export async function championAssetMissing(path: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(path);
  } catch {
    return true;
  }
  const type = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!res.ok || type.includes("text/html")) return true;
  if (path.endsWith(".png")) {
    if (!type.startsWith("image/")) return true;
    try {
      const bitmap = await createImageBitmap(await res.blob());
      const ok = bitmap.width > 0 && bitmap.height > 0;
      bitmap.close();
      return !ok;
    } catch {
      return true;
    }
  }
  if (path.endsWith(".json")) {
    if (!type.includes("json") && !type.startsWith("text/plain")) return true;
    try {
      JSON.parse(await res.text());
      return false;
    } catch {
      return true;
    }
  }
  return true;
}
