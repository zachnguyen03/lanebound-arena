import type { SimEvent } from "@watch/lib/types";

const DECISION_TYPES = new Set([
  "intent",
  "fight_call",
  "peel_start",
  "plan",
]);

export interface DeathStrip {
  tick: number;
  t: number;
  killerId: string | null;
  victimId: string | null;
  killer: SimEvent[];
  victim: SimEvent[];
}

/** Last 5.0 s of killer and victim decision events, ending at the death. */
export function deathDecisionStrip(
  events: readonly SimEvent[],
  death: SimEvent,
): DeathStrip {
  const t = typeof death.t === "number" ? death.t : death.tick / 10;
  const killerId = typeof death.killer_id === "string" ? death.killer_id : null;
  const victimId = typeof death.unit_id === "string" ? death.unit_id : null;
  const lo = t - 5;
  const killer: SimEvent[] = [];
  const victim: SimEvent[] = [];
  for (const e of events) {
    if (!DECISION_TYPES.has(e.type)) continue;
    if (e.t < lo || e.t > t + 1e-9) continue;
    const uid = typeof e.unit_id === "string" ? e.unit_id : null;
    const team = typeof e.team === "string" ? e.team : null;
    if (killerId && (uid === killerId || (e.type === "fight_call" && team && killerId.startsWith(team)))) {
      killer.push(e);
    }
    if (victimId && (uid === victimId || (e.type === "fight_call" && team && victimId.startsWith(team)))) {
      victim.push(e);
    }
  }
  return { tick: death.tick, t, killerId, victimId, killer, victim };
}

/** Readable row for the death strip. Not the raw event type. */
export function formatDecision(e: SimEvent): string {
  const t = typeof e.t === "number" ? e.t : e.tick / 10;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const clock = `${m}:${s.toString().padStart(2, "0")}`;
  const who =
    typeof e.unit_id === "string"
      ? e.unit_id.replace(":", " ")
      : typeof e.team === "string"
        ? `${e.team} side`
        : "A unit";
  if (e.type === "intent") {
    const intent = typeof e.intent === "string" ? e.intent : "an action";
    const target =
      typeof e.target_id === "string"
        ? ` toward ${e.target_id.replace(":", " ")}`
        : "";
    return `${clock} ${who} chooses ${intent}${target}`;
  }
  if (e.type === "fight_call") {
    const commit = typeof e.commit === "string" ? e.commit : "hold";
    const focus =
      typeof e.focus_id === "string"
        ? `, focus ${e.focus_id.replace(":", " ")}`
        : "";
    return `${clock} ${who} calls ${commit}${focus}`;
  }
  if (e.type === "peel_start") {
    const target =
      typeof e.target_id === "string"
        ? e.target_id.replace(":", " ")
        : "a teammate";
    return `${clock} ${who} peels for ${target}`;
  }
  const label = e.type.replaceAll("_", " ");
  return `${clock} ${who} ${label}`;
}

export function filterDecisions(
  rows: readonly SimEvent[],
  unitQuery: string,
): SimEvent[] {
  const q = unitQuery.trim().toLowerCase();
  if (!q) return rows.slice();
  return rows.filter((e) => {
    const uid = String(e.unit_id ?? "");
    const team = String(e.team ?? "");
    return uid.toLowerCase().includes(q) || team.toLowerCase().includes(q);
  });
}
