/**
 * Canonical JSON: object keys sorted lexicographically, arrays keep order,
 * undefined dropped, -0 folded to 0. No whitespace. Finite numbers only.
 */

export function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("canonical JSON rejects non-finite numbers");
    }
    if (Object.is(value, -0)) return 0;
    return value;
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      const child = obj[key];
      if (child === undefined) continue;
      out[key] = canonicalize(child);
    }
    return out;
  }
  throw new Error(`canonical JSON rejects ${typeof value}`);
}

export function canonicalString(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
