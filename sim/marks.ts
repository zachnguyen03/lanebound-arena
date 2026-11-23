import type { UnitId } from "./types.js";

export interface MarkInstance {
  kind: "huntress" | "kerrig";
  source_id: UnitId;
  expires_t: number;
}

export function hasMark(marks: MarkInstance[], kind: MarkInstance["kind"], now: number): boolean {
  return marks.some((m) => m.kind === kind && m.expires_t > now);
}

export function applyMark(
  marks: MarkInstance[],
  kind: MarkInstance["kind"],
  source_id: UnitId,
  now: number,
  duration: number,
): void {
  // Refresh same kind from same source
  const existing = marks.find((m) => m.kind === kind && m.source_id === source_id);
  if (existing) {
    existing.expires_t = Math.max(existing.expires_t, now + duration);
    return;
  }
  marks.push({ kind, source_id, expires_t: now + duration });
}

export function consumeMark(marks: MarkInstance[], kind: MarkInstance["kind"], now: number): boolean {
  const i = marks.findIndex((m) => m.kind === kind && m.expires_t > now);
  if (i < 0) return false;
  marks.splice(i, 1);
  return true;
}

export function pruneMarks(marks: MarkInstance[], now: number): void {
  for (let i = marks.length - 1; i >= 0; i--) {
    if (marks[i]!.expires_t <= now) marks.splice(i, 1);
  }
}
