/**
 * S5 B1–B3: batch progress/cancel/digest replay; no renderer import.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  defaultEvenBatchConfig,
  runBatch,
} from "../apps/lab/lib/batch-runner.js";
import { summariesToCsv } from "../apps/lab/lib/csv.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("S5 batch B1–B3", () => {
  it("B1: cancel at ~20 keeps partial; full 100 digests are stable on rerun", () => {
    const batch = defaultEvenBatchConfig(100, 20261122);
    let completed = 0;
    const partial = runBatch(batch, {
      shouldCancel: () => completed >= 20,
      onProgress: (p) => {
        completed = p.completed;
      },
    });
    expect(partial.cancelled).toBe(true);
    expect(partial.n_finished).toBe(20);
    expect(partial.summaries).toHaveLength(20);
    // Partial export shape
    const csv = summariesToCsv(partial.summaries);
    expect(csv.split("\n").length).toBeGreaterThan(20);

    const fullA = runBatch(batch);
    expect(fullA.cancelled).toBe(false);
    expect(fullA.n_finished).toBe(100);
    expect(fullA.summaries).toHaveLength(100);

    const fullB = runBatch(batch);
    expect(fullB.summaries.map((s) => s.digest)).toEqual(
      fullA.summaries.map((s) => s.digest),
    );
    // First seed matches even-OVR Hold gold
    expect(fullA.summaries[0]!.digest).toBe(
      "1664977f37e03fec75e5aafc5987103cb02c883b29194d5428d2ec980ab77bef",
    );
    expect(fullA.summaries[0]!.seed).toBe(20261122);
  }, 600_000);

  it("B2: n=1000 is accepted by the batch config gate", () => {
    const batch = defaultEvenBatchConfig(1000, 20261122);
    expect(batch.n).toBe(1000);
  });

  it("B3: batch path source does not import watch/renderer/canvas", () => {
    const labDir = path.join(root, "apps/lab");
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx|js|mjs)$/.test(ent.name)) continue;
        const text = fs.readFileSync(p, "utf8");
        if (
          /from\s+["'].*apps\/watch/.test(text) ||
          /from\s+["']@watch/.test(text) ||
          /canvas|CanvasRenderingContext|HTMLCanvasElement/.test(text)
        ) {
          // Allow comments mentioning canvas in B3 docs.
          const code = text
            .split("\n")
            .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
            .join("\n");
          if (
            /from\s+["'].*apps\/watch/.test(code) ||
            /from\s+["']@watch/.test(code) ||
            /HTMLCanvasElement|CanvasRenderingContext2D/.test(code)
          ) {
            offenders.push(path.relative(root, p));
          }
        }
      }
    };
    walk(labDir);
    expect(offenders).toEqual([]);
  });
});
