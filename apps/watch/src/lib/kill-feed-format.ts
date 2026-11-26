import type { SimEvent } from "./types";

/** "blue:adc" → "B ADC" */
export function shortUnitId(id: unknown): string {
  if (typeof id !== "string" || id.length === 0) return "?";
  const [team, slot] = id.split(":");
  const t = team === "blue" ? "B" : team === "red" ? "R" : "?";
  const s = (slot ?? "?").toUpperCase();
  return `${t} ${s}`;
}

/** Death row: killer → victim (+ assists). */
export function formatDeathRow(e: SimEvent): string {
  const victim = shortUnitId(e.unit_id);
  const killer =
    e.killer_id == null || e.killer_id === ""
      ? "—"
      : shortUnitId(e.killer_id);
  const assists = Array.isArray(e.assists)
    ? (e.assists as unknown[]).map(shortUnitId).filter(Boolean)
    : [];
  const assistPart =
    assists.length > 0 ? ` (+${assists.join(", ")})` : "";
  return `${killer} → ${victim}${assistPart}`;
}

/**
 * Takedown score row: team name + new scoreline.
 * e.g. "BLUE scores · 1–0"
 */
export type Scoreline = { blue: number; red: number };

/** Scoreline after every scoring event (seq → both scores), so log rows never show "?". */
export function scorelines(events: readonly SimEvent[]): Map<number, Scoreline> {
  const out = new Map<number, Scoreline>();
  const cur = { blue: 0, red: 0 };
  for (const e of events) {
    if (
      (e.type === "takedown_score" || e.type === "zone_tick" || e.type === "claim_award" || e.type === "shutdown" || e.type === "sweep") &&
      (e.team === "blue" || e.team === "red") &&
      typeof e.score_after === "number"
    ) {
      cur[e.team] = e.score_after;
      out.set(e.seq, { ...cur });
    }
  }
  return out;
}

export function formatTakedownScoreRow(e: SimEvent, line?: Scoreline): string {
  const team =
    e.team === "blue" ? "BLUE" : e.team === "red" ? "RED" : "?";
  let blue: number | null =
    typeof e.score_blue === "number" ? e.score_blue : null;
  let red: number | null =
    typeof e.score_red === "number" ? e.score_red : null;
  if (typeof e.score_after === "number") {
    if (e.team === "blue") blue = e.score_after;
    else if (e.team === "red") red = e.score_after;
  }
  if (line) {
    blue = line.blue;
    red = line.red;
  }
  const what =
    e.type === "zone_tick" && e.point === "majority" ? "majority +1"
    : e.type === "shutdown" ? `SHUTDOWN ${shortUnitId(e.killer_id)} ends ${shortUnitId(e.victim_id)}'s ${e.streak} streak +1`
    : e.type === "sweep" ? "SWEEP all 3 points +1"
    : "scores";
  return `${team} ${what} · ${blue ?? "?"}–${red ?? "?"}`;
}

/** exp cadence: seq of deaths whose victim held a flank buff at death. */
export function buffedDeathSeqs(events: readonly SimEvent[]): Set<number> {
  const until: Record<string, number> = {};
  const out = new Set<number>();
  for (const e of events) {
    if (e.type === "buff_pickup" && typeof e.unit_id === "string" && typeof e.expires_at === "number") {
      until[e.unit_id] = e.expires_at;
    } else if (e.type === "buff_share" && Array.isArray(e.unit_ids) && typeof e.expires_at === "number") {
      for (const id of e.unit_ids) if (typeof id === "string") until[id] = e.expires_at;
    } else if (e.type === "death" && typeof e.unit_id === "string") {
      if ((until[e.unit_id] ?? 0) > e.t) out.add(e.seq);
      delete until[e.unit_id];
    }
  }
  return out;
}

export function formatKillFeedRow(e: SimEvent, buffed = false, line?: Scoreline): string {
  if (e.type === "death") return formatDeathRow(e) + (buffed ? " · BUFF DOWN" : "");
  if (e.type === "takedown_score" || e.type === "zone_tick" || e.type === "shutdown" || e.type === "sweep") return formatTakedownScoreRow(e, line);
  return e.type;
}
