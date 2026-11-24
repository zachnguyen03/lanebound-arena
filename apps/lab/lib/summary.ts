/**
 * Build a MatchSummary from a SimulateResult (sandbox §8.2).
 */
import type { SimulateResult, SimEvent, UnitId } from "../../../sim/types.js";
import { tagArchetype } from "./archetypes.js";
import { computeFightQuality } from "./fight-quality.js";
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

  const fight_quality = computeFightQuality(result.events, {
    score_blue: result.state.score_blue,
    score_red: result.state.score_red,
    blue_picks: bluePicks,
    red_picks: redPicks,
    end_reason: result.state.end_reason,
    duration_s: result.state.t,
  });

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
    fight_quality,
  };
}

export function filterDigestEvents(events: SimEvent[]): SimEvent[] {
  return events.filter((e) => e.type !== "move" && e.type !== "pos");
}
