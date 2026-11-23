import { describe, expect, it } from "vitest";
import {
  collectAtlasFiles,
  normalizeChampAtlas,
  resolveAtlasFile,
} from "./champ-atlas";

describe("champion atlas files", () => {
  it("resolves the Maelis slow note to vfx/slow.png", () => {
    const note = "../sedge/vfx/slow.png (shared language) / vfx/slow.png";
    expect(resolveAtlasFile("maelis", note)).toBe("vfx/slow.png");
    expect(collectAtlasFiles("maelis", { status: { slow: { file: note } } })).toEqual([
      "vfx/slow.png",
    ]);
  });

  it("fills n and ms from fps when a clip only has frames", () => {
    const atlas = normalizeChampAtlas(
      {
        slug: "huntress",
        cell: [18, 24],
        anchor: [9, 23],
        sheet: "sheets/huntress.png",
        animations: {
          idle: {
            blue: {
              right: {
                loop: true,
                fps: 8,
                frames: [
                  { rect: [1, 1, 18, 24], anchor: [9, 23], index: 0 },
                  { rect: [20, 1, 18, 24], anchor: [9, 23], index: 1 },
                ],
              },
            },
          },
        },
      },
      "huntress",
    );
    const clip = atlas.animations.idle?.["blue-right"];
    expect(clip?.n).toBe(2);
    expect(clip?.ms).toBe(125);
    expect(clip?.loop).toBe(true);
    expect(clip?.frames[0]?.i).toBe(0);
  });
});
