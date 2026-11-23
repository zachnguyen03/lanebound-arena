import { describe, expect, it } from "vitest";
import { compareDrawOrder, sortDrawItems } from "./draw-order";

describe("pillar / unit draw order", () => {
  it("draws pillar before unit when footY === sort_y_px (unit in front)", () => {
    const items = sortDrawItems([
      { kind: "unit" as const, footY: 128, id: "blue:mid" },
      { kind: "pillar" as const, footY: 128, id: "NW" },
    ]);
    expect(items.map((i) => i.kind)).toEqual(["pillar", "unit"]);
    expect(compareDrawOrder(items[0]!, items[1]!)).toBeLessThan(0);
  });

  it("draws unit before pillar when foot_y < sort_y", () => {
    const items = sortDrawItems([
      { kind: "pillar" as const, footY: 128, id: "NW" },
      { kind: "unit" as const, footY: 127, id: "blue:mid" },
    ]);
    expect(items.map((i) => `${i.kind}:${i.id}`)).toEqual([
      "unit:blue:mid",
      "pillar:NW",
    ]);
  });

  it("draws pillar before unit when foot_y > sort_y (unit south of pillar)", () => {
    const items = sortDrawItems([
      { kind: "unit" as const, footY: 200, id: "blue:mid" },
      { kind: "pillar" as const, footY: 128, id: "NW" },
    ]);
    expect(items.map((i) => `${i.kind}:${i.id}`)).toEqual([
      "pillar:NW",
      "unit:blue:mid",
    ]);
  });
});
