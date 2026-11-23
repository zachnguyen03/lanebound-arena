/**
 * data_hash — SHA-256 of canonical kit + L1/growth/snapshot tables.
 * Engineering addition (INV-DATA-HASH); reported next to constants_hash.
 */
import { canonicalJSON } from "./canonical.js";
import { sha256Hex } from "./sha256.js";
import { CHAMPIONS, CLASS_GROWTH, SNAPSHOT_TABLE } from "../data/champions/defs.js";
import { KITS } from "../data/champions/kits.js";

export function dataTable(): Record<string, unknown> {
  return {
    champions: CHAMPIONS,
    class_growth: CLASS_GROWTH,
    kits: KITS,
    snapshot_table: SNAPSHOT_TABLE,
  };
}

export function dataHash(): string {
  return sha256Hex(canonicalJSON(dataTable()));
}
