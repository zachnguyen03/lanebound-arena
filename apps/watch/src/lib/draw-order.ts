/**
 * Pillar / unit y-sort.
 * Draw a pillar after every unit whose foot_y_px < sort_y_px, and before
 * units at or beyond it. Tie (footY === sort_y_px): pillar first → unit in front.
 */

export type SortKind = "unit" | "pillar";

export interface Sortable {
  kind: SortKind;
  footY: number;
  id: string;
}

export function compareDrawOrder(a: Sortable, b: Sortable): number {
  if (a.footY !== b.footY) return a.footY - b.footY;
  // Tie: pillar before unit so the unit paints on top.
  if (a.kind !== b.kind) return a.kind === "pillar" ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortDrawItems<T extends Sortable>(items: T[]): T[] {
  return items.slice().sort(compareDrawOrder);
}
