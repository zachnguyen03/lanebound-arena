/**
 * Build a MatchSummary from a SimulateResult (sandbox §8.2).
 */
import type { SimulateResult, SimEvent, UnitId } from "../../../sim/types.js";
import { tagArchetype } from "./archetypes.js";
import type { KdaRow, MatchSummary, ScoreParts } from "./types.js";

function emptyParts(): ScoreParts {
  return { kills: 0, ticks: 0, claims: 0 };
}

function unitIndex(id: string): number {
  const [team, slot] = id.split(":") as [string, string];
  const slots = ["top", "jungle", "mid", "adc", "support"];
  const si = slots.indexOf(slot);
  return (team === "red" ? 5 : 0) + (si >= 0 ? si : 0);
}

function bump(
  kda: KdaRow[],
  id: string | undefined,
  field: keyof KdaRow,
  n: number,
): void {
  if (!id || typeof id !== "string") return;
  const row = kda[unitIndex(id)];
  if (!row) return;
  row[field] += n;
}

export function summarizeMatch(
  seed: number,
  result: SimulateResult,
): MatchSummary {
  const parts = { blue: emptyParts(), red: emptyParts() };
  const kda: KdaRow[] = Array.from({ length: 10 }, () => ({
    k: 0,
    d: 0,
    a: 0,
    dmg: 0,
  }));

  let claim_opened = 0;
  let claim_denied = 0;
  let claim_paid = 0;
  let sanctuary_violations = 0;
  let t_first_R: number | null = null;
  let t_L7: number | null = null;
  let casts = 0;
  let interrupts = 0;
  const interrupts_by_reflexes = { low: 0, mid: 0, high: 0 };

  // Reflexes band of interrupter at cast time (attrs are match-static in even OVR).
  const reflexesOf = (unitId: string | undefined): number => {
    if (!unitId) return 70;
    const u = result.state.units.find((x) => x.id === unitId);
    return u?.attrs.reflexes ?? 70;
  };
  const bandOf = (r: number): "low" | "mid" | "high" =>
    r < 60 ? "low" : r < 80 ? "mid" : "high";

  for (const ev of result.events) {
    switch (ev.type) {
      case "takedown_score": {
        const team = ev.team === "red" ? "red" : "blue";
        parts[team].kills += 1;
        break;
      }
      case "death": {
        bump(kda, ev.unit_id as string, "d", 1);
        if (ev.killer_id) bump(kda, ev.killer_id as string, "k", 1);
        for (const a of (ev.assists as string[] | undefined) ?? []) {
          bump(kda, a, "a", 1);
        }
        break;
      }
      case "zone_tick": {
        const team = ev.team === "red" ? "red" : "blue";
        parts[team].ticks += 1;
        break;
      }
      case "claim_award": {
        const team = ev.team === "red" ? "red" : "blue";
        parts[team].claims += 1;
        claim_paid += 1;
        break;
      }
      case "claim_open":
        claim_opened += 1;
        break;
      case "claim_deny":
        claim_denied += 1;
        break;
      case "sanctuary_violation":
        sanctuary_violations += 1;
        break;
      case "cast_start":
        casts += 1;
        break;
      case "cast_cancel": {
        // M2-33 / R7-6b: interrupt = cancel reason lock|silence after a P1a cast.
        const reason = String(ev.reason ?? "");
        if (reason !== "lock" && reason !== "silence") break;
        const t = Number(ev.t);
        const prior = result.events.filter(
          (e) =>
            e.type === "cast_start" &&
            e.tier === "P1a" &&
            Number(e.t) <= t + 1e-9 &&
            t - Number(e.t) <= 1.5,
        );
        const p1a = prior[prior.length - 1];
        if (!p1a) break;
        interrupts += 1;
        interrupts_by_reflexes[bandOf(reflexesOf(String(p1a.unit_id)))] += 1;
        break;
      }
      case "hit": {
        const dmg = Number(ev.mitigated ?? 0);
        if (Number.isFinite(dmg) && dmg > 0) {
          bump(kda, ev.source_id as string, "dmg", Math.round(dmg * 100) / 100);
        }
        break;
      }
      case "level_up": {
        // Sim emits `new_level` (not `level`) on level_up.
        const level = Number(ev.new_level ?? ev.level);
        const t = Number(ev.t);
        if (level === 5 && t_first_R === null) t_first_R = t;
        if (level === 7 && t_L7 === null) t_L7 = t;
        break;
      }
      default:
        break;
    }
  }

  // Fallback score-part kills when takedown_score was not emitted (forced clock).
  if (parts.blue.kills + parts.red.kills === 0) {
    for (const ev of result.events) {
      if (ev.type !== "death" || !ev.killer_id) continue;
      const kid = ev.killer_id as UnitId;
      const team = kid.startsWith("red:") ? "red" : "blue";
      parts[team].kills += 1;
    }
  }

  const bluePicks = result.state.config.blue.picks;
  const redPicks = result.state.config.red.picks;

  return {
    seed,
    digest: result.digest,
    winner: result.state.winner,
    reason: result.state.end_reason,
    duration_s: result.state.t,
    score_blue: result.state.score_blue,
    score_red: result.state.score_red,
    score_parts: parts,
    archetypes: {
      blue: tagArchetype(bluePicks),
      red: tagArchetype(redPicks),
    },
    champ_ids: [...bluePicks, ...redPicks],
    peel_fired: result.ai_stats?.peel_fired ?? 0,
    // peel_eligible = dive_geom (geometrically reachable dives). Not "perceived"
    // dives: peeler_perceived stays false in the Hold lab (S2 deferred); filtering
    // on it would give 0/0. Deviation from build-spec L1162 flagged in lab/s5/REPORT.md.
    peel_eligible: result.ai_stats?.dive_geom ?? 0,
    sanctuary_violations,
    claim_opened,
    claim_denied,
    claim_paid,
    t_first_R,
    t_L7,
    kda,
    casts,
    interrupts,
    interrupts_by_reflexes,
  };
}

export function filterDigestEvents(events: SimEvent[]): SimEvent[] {
  return events.filter((e) => e.type !== "move" && e.type !== "pos");
}
