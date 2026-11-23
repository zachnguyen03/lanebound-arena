/**
 * AI-off regression: the S1 event subsequence of defaultEvenConfig stays
 * byte-identical to the official `2cdcf26` gold digests (§4.4 L196; S0
 * gold at tests/s0-gold-hash.test.ts).
 *
 * defaultEvenConfig keeps forced_clock_end: true (_contract.md), so the
 * default even match still ends at t=240.0 with reason clock. S3 will add
 * orb / buff / zone / claim / takedown_score events to the same run; those
 * types are stripped before hashing. If any remaining S1 event (match_start,
 * xp_gain, level_up, match_end, death, hit, …) changes, this test goes red.
 *
 * constants_hash is not pinned: adding a documented constants key such as
 * ORB_PADS is a reportable before→after, not a behaviour regression.
 */
import { describe, expect, it } from "vitest";
import {
  S1_GOLD,
  defaultEvenConfig,
  digestEvents,
  simulate,
  stripS3Events,
} from "./_harness.js";

describe("AI-off S1 digest regression (defaultEvenConfig, forced_clock_end true)", () => {
  it("seed 20261122: digest of events with S3 types stripped equals the official S1 gold", () => {
    const r = simulate(defaultEvenConfig(20261122));
    expect(r.events.some((e) => e.type === "match_end" && e.reason === "clock")).toBe(true);
    expect(r.state.t).toBe(240.0);
    expect(digestEvents(stripS3Events(r.events))).toBe(S1_GOLD.seed_20261122.digest);
  });

  it("seed 20261123: digest of events with S3 types stripped equals the official S1 gold", () => {
    const r = simulate(defaultEvenConfig(20261123));
    expect(r.events.some((e) => e.type === "match_end" && e.reason === "clock")).toBe(true);
    expect(digestEvents(stripS3Events(r.events))).toBe(S1_GOLD.seed_20261123.digest);
  });

  it("on the S1 tip (no S3 events) the unfiltered digest is already the gold — the strip is a no-op", () => {
    const r = simulate(defaultEvenConfig(20261122));
    const s3 = r.events.filter((e) =>
      [
        "orb_spawn",
        "orb_pickup",
        "buff_spawn",
        "buff_pickup",
        "zone_capture",
        "zone_tick",
        "claim_open",
        "claim_award",
        "claim_deny",
        "takedown_score",
      ].includes(e.type),
    );
    if (s3.length === 0) {
      expect(r.digest).toBe(S1_GOLD.seed_20261122.digest);
    }
    // Once S3 is live this branch simply records that new events exist; the
    // gold pin is the stripped digest above, not the full digest.
    expect(digestEvents(stripS3Events(r.events))).toBe(S1_GOLD.seed_20261122.digest);
  });
});
