/**
 * Purity scanner: comments mentioning banned APIs must pass;
 * the same call in live code must fail.
 */
import { describe, expect, it } from "vitest";
import { findBannedInSource, stripComments } from "../apps/lab/purity-scan.js";

describe("purity-scan comment stripping", () => {
  it("allows Math.cos / Math.sin text inside line and block comments", () => {
    const src = `
/**
 * Cone half-angle cosines are hardcoded IEEE literals (not Math.cos).
 */
export const COS = 0.866; // cos(30°) — not Math.cos
/** sin(halfAngle) — hardcoded IEEE literals (no Math.sin). */
export const SIN = 0.5;
`;
    expect(findBannedInSource(src)).toEqual([]);
    // Stripped form must not still contain the identifiers as callable code tokens on their own lines
    const stripped = stripComments(src);
    expect(stripped).not.toMatch(/Math\.cos\s*\(/);
    expect(stripped).not.toMatch(/Math\.sin\s*\(/);
  });

  it("fails when a real banned call appears in code", () => {
    const src = `
export function bad(x: number): number {
  return Math.cos(x) + Math.sin(x);
}
`;
    const hits = findBannedInSource(src);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.some((h) => h.match === "Math.cos")).toBe(true);
    expect(hits.some((h) => h.match === "Math.sin")).toBe(true);
  });

  it("does not treat Math.cos inside a string as a comment, but still flags code calls", () => {
    const src = `
const note = "uses Math.cos in docs only";
const y = Math.cos(0);
`;
    // String text is not stripped as a comment; our scanner still matches identifiers in strings.
    // Spec for purity: banned *calls* in executable code. Document: string mentions are also flagged
    // unless inside comments — keep that strict for purity OK on sim/.
    const hits = findBannedInSource(src);
    expect(hits.some((h) => h.match === "Math.cos")).toBe(true);
  });

  it("same banned text in a comment passes while an adjacent real call fails", () => {
    const src = `
// Allowed documentation: Math.random is banned in sim/
export function roll(): number {
  return Math.random();
}
`;
    const hits = findBannedInSource(src);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.match).toBe("Math.random");
    expect(hits[0]!.line).toBe(4);
  });
});
