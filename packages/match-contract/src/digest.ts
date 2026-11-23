import { canonicalString } from "./canonical.js";
import { sha256Hex } from "./sha256.js";
import { CAREER_MATCH_VERSION, type MatchResult } from "./types.js";

/** SHA-256 of canonical {"contract_version","source"} for a fake result. */
export function fakeConstantsHash(): string {
  return sha256Hex(
    canonicalString({
      contract_version: CAREER_MATCH_VERSION,
      source: "fake",
    }),
  );
}

export const FAKE_CONSTANTS_HASH = fakeConstantsHash();

export function isFakeDigest(digest: string): boolean {
  return digest.startsWith("fake:");
}

/** A digest that starts with `fake:` is not a sim replay. */
export function assertAcceptableSimReplay(digest: string): void {
  if (isFakeDigest(digest)) {
    throw new Error("rejected fake digest as sim replay");
  }
}

export function fakeDigest(result: MatchResult): string {
  const copy = canonicalizeResultWithoutDigest(result);
  return "fake:" + sha256Hex(canonicalString(copy));
}

function canonicalizeResultWithoutDigest(result: MatchResult): unknown {
  const { digest: _digest, ...rest } = result;
  return rest;
}
