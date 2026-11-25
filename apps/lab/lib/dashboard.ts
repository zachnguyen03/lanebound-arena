/**
 * §6.5 results dashboard rows from a finished batch.
 * Preview (N < 400) and champ N < 200 → under-powered; never hide sample size.
 */
import type {
  ArchetypeTag,
  BatchResult,
  DashboardMark,
  DashboardRow,
  MatchSummary,
} from "./types.js";

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

function median(sorted: number[]): number {
  return percentile(sorted, 0.5);
}

function fmtSec(s: number): string {
  if (!Number.isFinite(s)) return "—";
  const m = Math.floor(s / 60);
  const r = Math.round((s - m * 60) * 10) / 10;
  return `${m}:${r.toFixed(1).padStart(4, "0")}`;
}

function markSample(n: number, need: number, ok: boolean): DashboardMark {
  if (n < need) return "under-powered";
  return ok ? "pass" : "fail";
}

function endReasonShare(summaries: MatchSummary[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of summaries) {
    const r = s.reason ?? "none";
    counts[r] = (counts[r] ?? 0) + 1;
  }
  const n = summaries.length || 1;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) out[k] = v / n;
  return out;
}

export function buildDashboard(
  summaries: MatchSummary[],
  opts?: { isolation?: IsolationDashboardInput | null },
): { rows: DashboardRow[]; aggregates: Record<string, unknown> } {
  const n = summaries.length;
  const rows: DashboardRow[] = [];
  const durations = summaries.map((s) => s.duration_s).sort((a, b) => a - b);
  const med = median(durations);
  const p10 = percentile(durations, 0.1);
  const p90 = percentile(durations, 0.9);
  const lengthOk = med >= 210 && med <= 270;
  rows.push({
    id: "match_length",
    metric: "Match length (median / p10 / p90)",
    target: "Median 3:30–4:30 (210–270 s)",
    value: `median ${fmtSec(med)} (${med.toFixed(1)}s); p10 ${fmtSec(p10)}; p90 ${fmtSec(p90)}`,
    sample_size: n,
    mark: markSample(n, 100, lengthOk),
    notes: `Ends: ${JSON.stringify(endReasonShare(summaries))}`,
  });

  // Zone share of winner's score
  let zoneShareSum = 0;
  let zoneShareN = 0;
  for (const s of summaries) {
    if (s.winner !== "blue" && s.winner !== "red") continue;
    const parts = s.score_parts[s.winner];
    const total = parts.kills + parts.ticks + parts.claims;
    if (total <= 0) continue;
    zoneShareSum += (parts.ticks + parts.claims) / total;
    zoneShareN += 1;
  }
  const zoneShare = zoneShareN > 0 ? zoneShareSum / zoneShareN : NaN;
  const zoneOk = zoneShare >= 0.3 && zoneShare <= 0.4;
  rows.push({
    id: "zone_share",
    metric: "Zone share of winner's score",
    target: "30–40% (ticks+claims)",
    value: Number.isFinite(zoneShare)
      ? `${(zoneShare * 100).toFixed(1)}%`
      : "—",
    sample_size: zoneShareN,
    mark: markSample(zoneShareN, 100, zoneOk),
  });

  // Per-champion win / pick
  const champ: Record<
    string,
    { wins: number; picks: number; k: number; d: number; a: number; dmg: number }
  > = {};
  for (const s of summaries) {
    for (let i = 0; i < 10; i++) {
      const id = s.champ_ids[i];
      if (!id) continue;
      const row = (champ[id] ??= {
        wins: 0,
        picks: 0,
        k: 0,
        d: 0,
        a: 0,
        dmg: 0,
      });
      row.picks += 1;
      const side = i < 5 ? "blue" : "red";
      if (s.winner === side) row.wins += 1;
      const kda = s.kda[i];
      if (kda) {
        row.k += kda.k;
        row.d += kda.d;
        row.a += kda.a;
        row.dmg += kda.dmg;
      }
    }
  }
  const champEntries = Object.entries(champ).sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
  );
  const minPicks = champEntries.reduce(
    (m, [, v]) => Math.min(m, v.picks),
    Infinity,
  );
  const wrParts = champEntries.map(([id, v]) => {
    const wr = v.picks > 0 ? v.wins / v.picks : 0;
    return `${id}:${(wr * 100).toFixed(0)}%(n=${v.picks})`;
  });
  const allInBand = champEntries.every(([, v]) => {
    if (v.picks === 0) return true;
    const wr = v.wins / v.picks;
    return wr >= 0.45 && wr <= 0.55;
  });
  const champMark: DashboardMark =
    !Number.isFinite(minPicks) || minPicks < 200
      ? "under-powered"
      : allInBand
        ? "pass"
        : "fail";
  rows.push({
    id: "per_champion",
    metric: "Per-champion win / pick / KDA",
    target: "Win rate 45–55%, min 200 games / champ (random-draft even)",
    value: wrParts.slice(0, 8).join(", ") + (wrParts.length > 8 ? "…" : ""),
    sample_size: n,
    mark: champMark,
    notes: `min picks among champs=${Number.isFinite(minPicks) ? minPicks : 0}`,
  });

  // Archetype matrix — vs field and triangle edges
  const archTags: Exclude<ArchetypeTag, "Other">[] = [
    "Dive",
    "Peel",
    "Poke",
    "Balanced",
  ];
  const vsField: Record<string, { w: number; n: number }> = {};
  for (const t of archTags) vsField[t] = { w: 0, n: 0 };
  const edges: Record<string, { fav: string; w: number; n: number }> = {};
  const edgePairs: Array<[Exclude<ArchetypeTag, "Other">, Exclude<ArchetypeTag, "Other">]> = [
    ["Peel", "Dive"],
    ["Dive", "Poke"],
    ["Poke", "Peel"],
  ];
  for (const [a, b] of edgePairs) {
    edges[`${a}_vs_${b}`] = { fav: a, w: 0, n: 0 };
  }

  for (const s of summaries) {
    const b = s.archetypes.blue;
    const r = s.archetypes.red;
    if (b !== "Other" && s.winner === "blue") {
      vsField[b]!.w += 1;
      vsField[b]!.n += 1;
    } else if (b !== "Other") {
      vsField[b]!.n += 1;
    }
    if (r !== "Other" && s.winner === "red") {
      vsField[r]!.w += 1;
      vsField[r]!.n += 1;
    } else if (r !== "Other") {
      vsField[r]!.n += 1;
    }

    for (const [fav, dog] of edgePairs) {
      const key = `${fav}_vs_${dog}`;
      const e = edges[key]!;
      if (
        (b === fav && r === dog) ||
        (b === dog && r === fav)
      ) {
        e.n += 1;
        const favWon =
          (b === fav && s.winner === "blue") ||
          (r === fav && s.winner === "red");
        if (favWon) e.w += 1;
      }
    }
  }

  const fieldParts = archTags.map((t) => {
    const v = vsField[t]!;
    const wr = v.n > 0 ? v.w / v.n : 0;
    return `${t} ${(wr * 100).toFixed(0)}%(n=${v.n})`;
  });
  const maxField = Math.max(
    ...archTags.map((t) => {
      const v = vsField[t]!;
      return v.n > 0 ? v.w / v.n : 0;
    }),
  );
  const minFieldN = Math.min(...archTags.map((t) => vsField[t]!.n));
  const fieldOk = maxField <= 0.55;
  rows.push({
    id: "archetype_matrix",
    metric: "Comp archetype matrix",
    target: "No archetype >55% vs field; triangle edges 55–65% (min 80/200)",
    value: fieldParts.join("; "),
    sample_size: n,
    mark:
      minFieldN < 80
        ? "under-powered"
        : fieldOk
          ? "pass"
          : "fail",
    notes: Object.entries(edges)
      .map(([k, v]) => `${k}: ${v.n ? ((v.w / v.n) * 100).toFixed(0) : "—"}%(n=${v.n})`)
      .join("; "),
  });

  // Isolation
  if (opts?.isolation) {
    const iso = opts.isolation;
    const deltaParts = iso.deltas.map(
      (d) => `${d.attr} ${d.delta_pp >= 0 ? "+" : ""}${d.delta_pp.toFixed(1)}pp (n=${d.n})`,
    );
    const nArm = iso.deltas.reduce((m, d) => Math.min(m, d.n), Infinity);
    const inBand = iso.deltas.every((d) => d.delta_pp >= 3 && d.delta_pp <= 6);
    const maxD = Math.max(...iso.deltas.map((d) => Math.abs(d.delta_pp)), 0);
    const minD = Math.min(...iso.deltas.map((d) => Math.abs(d.delta_pp)), Infinity);
    const ratioOk = !Number.isFinite(minD) || minD === 0 || maxD <= 2 * minD;
    rows.push({
      id: "attribute_isolation",
      metric: "Attribute isolation (+30 one attr)",
      target: "+3 to +6 pp team win%, min 400/arm; no delta >2× another",
      value: deltaParts.join("; ") || "—",
      sample_size: Number.isFinite(nArm) ? nArm : 0,
      mark:
        !Number.isFinite(nArm) || nArm < 400
          ? "under-powered"
          : inBand && ratioOk
            ? "pass"
            : "fail",
      notes: iso.mastery_note,
    });
  } else {
    rows.push({
      id: "attribute_isolation",
      metric: "Attribute isolation (+30 one attr)",
      target: "+3 to +6 pp team win%, min 400/arm; no delta >2× another",
      value: "not run — use npm run isolation",
      sample_size: 0,
      mark: "under-powered",
      notes: "See apps/lab/isolation.ts",
    });
  }

  // Peel rate
  let peelFired = 0;
  let peelElig = 0;
  for (const s of summaries) {
    peelFired += s.peel_fired;
    peelElig += s.peel_eligible;
  }
  const peelRate = peelElig > 0 ? peelFired / peelElig : null;
  rows.push({
    id: "auto_peel",
    metric: "Auto-peel fire rate",
    target: "≥ 70% of geometrically reachable dives (dive_geom)",
    value:
      peelRate === null
        ? `n/a (eligible=${peelElig}, fired=${peelFired})`
        : `${(peelRate * 100).toFixed(1)}% (fired=${peelFired}, eligible=${peelElig})`,
    sample_size: peelElig,
    mark:
      peelElig === 0
        ? "under-powered"
        : peelRate !== null && peelRate >= 0.7
          ? "pass"
          : "fail",
    // Stricter than build-spec "perceived, reachable": peeler_perceived stays false
    // in the Hold lab (S2 deferred), so filtering on it yields 0/0. See lab/s5/REPORT.md.
    notes: "Denominator = dive_geom (all geometrically reachable dives; not filtered on peeler_perceived)",
  });

  // Sanctuary
  const sanc = summaries.reduce((a, s) => a + s.sanctuary_violations, 0);
  rows.push({
    id: "sanctuary",
    metric: "Spawn-pad entries (illegal enemy-sanctuary centres)",
    target: "0",
    value: String(sanc),
    sample_size: n,
    mark: n === 0 ? "under-powered" : sanc === 0 ? "pass" : "fail",
  });

  // Claim deny rate
  let opened = 0;
  let denied = 0;
  let paid = 0;
  for (const s of summaries) {
    opened += s.claim_opened;
    denied += s.claim_denied;
    paid += s.claim_paid;
  }
  const denyRate = opened > 0 ? denied / opened : null;
  const denyWarn =
    denyRate === null ? "no claims" : denyRate === 0 || denyRate === 1 ? "warn extremes" : "ok";
  rows.push({
    id: "claim_deny",
    metric: "Claim deny rate",
    target: "Reported (opened / denied / paid); warn if 0% or 100%",
    value: `opened=${opened}, denied=${denied}, paid=${paid}${denyRate !== null ? `, rate=${(denyRate * 100).toFixed(1)}%` : ""}`,
    sample_size: opened,
    mark: "report",
    notes: denyWarn,
  });

  // Level timings
  const rTimes = summaries
    .map((s) => s.t_first_R)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  const l7Times = summaries
    .map((s) => s.t_L7)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  const rMed = median(rTimes);
  const l7Med = median(l7Times);
  rows.push({
    id: "level_timings",
    metric: "Level timings (first R / L7)",
    target: "Flavour R ~1:20, L7 ~2:40 (report misses; XP table is P)",
    value: `R median ${fmtSec(rMed)} (n=${rTimes.length}); L7 median ${fmtSec(l7Med)} (n=${l7Times.length})`,
    sample_size: Math.min(rTimes.length, l7Times.length),
    mark: "report",
  });

  const aggregates: Record<string, unknown> = {
    n,
    length_median_s: med,
    length_p10_s: p10,
    length_p90_s: p90,
    zone_share_winner: zoneShare,
    peel_fired: peelFired,
    peel_eligible: peelElig,
    peel_rate: peelRate,
    sanctuary_violations: sanc,
    claim_opened: opened,
    claim_denied: denied,
    claim_paid: paid,
    t_first_R_median: rMed,
    t_L7_median: l7Med,
    end_reasons: endReasonShare(summaries),
    champions: Object.fromEntries(
      champEntries.map(([id, v]) => [
        id,
        {
          picks: v.picks,
          wins: v.wins,
          win_rate: v.picks > 0 ? v.wins / v.picks : null,
        },
      ]),
    ),
    archetypes_vs_field: vsField,
    archetype_edges: edges,
  };

  return { rows, aggregates };
}

export interface IsolationDelta {
  attr: string;
  control_win_pp: number;
  arm_win_pp: number;
  delta_pp: number;
  n: number;
}

export interface IsolationDashboardInput {
  deltas: IsolationDelta[];
  mastery_note?: string;
}

export function attachIsolationToBatch(
  result: BatchResult,
  isolation: IsolationDashboardInput,
): BatchResult {
  const rebuilt = buildDashboard(result.summaries, { isolation });
  return {
    ...result,
    dashboard: rebuilt,
  };
}
