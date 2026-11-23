/**
 * Sim policy knobs that are not build-spec constants.
 * KILN_BREAK_READING — OQ-1: whose Break turns off Kiln-Cured (default: owner / Reading A).
 */
export type KilnBreakReading = "owner" | "victim" | "attacker";

export const KILN_BREAK_READING: KilnBreakReading = "owner";

/** Kerrig Q leash tether radius (tiles). */
export const LEASH_RADIUS = 3.5;
