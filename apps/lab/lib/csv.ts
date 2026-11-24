/**
 * CSV export for BatchResult (per-match rows + dashboard summary).
 */
import type { BatchResult, DashboardRow, MatchSummary } from "./types.js";

function esc(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function row(cols: unknown[]): string {
  return cols.map(esc).join(",");
}

export function summariesToCsv(summaries: MatchSummary[]): string {
  const header = row([
    "seed",
    "digest",
    "winner",
    "reason",
    "duration_s",
    "score_blue",
    "score_red",
    "kills_blue",
    "ticks_blue",
    "claims_blue",
    "kills_red",
    "ticks_red",
    "claims_red",
    "arch_blue",
    "arch_red",
    "champ_ids",
    "peel_fired",
    "peel_eligible",
    "sanctuary_violations",
    "claim_opened",
    "claim_denied",
    "claim_paid",
    "t_first_R",
    "t_L7",
  ]);
  const lines = [header];
  for (const s of summaries) {
    lines.push(
      row([
        s.seed,
        s.digest,
        s.winner,
        s.reason,
        s.duration_s,
        s.score_blue,
        s.score_red,
        s.score_parts.blue.kills,
        s.score_parts.blue.ticks,
        s.score_parts.blue.claims,
        s.score_parts.red.kills,
        s.score_parts.red.ticks,
        s.score_parts.red.claims,
        s.archetypes.blue,
        s.archetypes.red,
        s.champ_ids.join("|"),
        s.peel_fired,
        s.peel_eligible,
        s.sanctuary_violations,
        s.claim_opened,
        s.claim_denied,
        s.claim_paid,
        s.t_first_R ?? "",
        s.t_L7 ?? "",
      ]),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function dashboardToCsv(rows: DashboardRow[]): string {
  const header = row([
    "id",
    "metric",
    "target",
    "value",
    "sample_size",
    "mark",
    "notes",
  ]);
  const lines = [header];
  for (const r of rows) {
    lines.push(
      row([r.id, r.metric, r.target, r.value, r.sample_size, r.mark, r.notes ?? ""]),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function batchResultToJson(result: BatchResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
