import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildWatchSample } from "../apps/lab/gen-watch-sample.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sampleDir = path.join(root, "apps/watch/public/samples");

describe("bundled Watch sample", () => {
  it("matches a fresh generate from the current default config", () => {
    const built = buildWatchSample();
    const jsonl = fs.readFileSync(
      path.join(sampleDir, "seed-20261122.jsonl"),
      "utf8",
    );
    const meta = fs.readFileSync(
      path.join(sampleDir, "seed-20261122.meta.json"),
      "utf8",
    );
    expect(jsonl).toBe(built.jsonl);
    expect(meta).toBe(built.meta);
    expect(built.digest).toBe(
      "7e6516f4fad170ab9893de7d8a225271c42b19d837a5dfedefeda6bdd97aee1f",
    );
  });
});
