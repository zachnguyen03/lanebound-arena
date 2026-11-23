#!/usr/bin/env node
/**
 * npm run purity — scan sim/ for banned APIs in non-comment code. Exit 1 on match.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { findBannedInSource } from "./purity-scan.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const simDir = path.join(root, "sim");

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listTsFiles(p));
    else if (name.endsWith(".ts")) out.push(p);
  }
  return out;
}

const files = listTsFiles(simDir);
const report: string[] = [];

for (const fp of files) {
  const src = readFileSync(fp, "utf8");
  for (const hit of findBannedInSource(src)) {
    report.push(`${fp}:${hit.line}: ${hit.text}`);
  }
}

if (report.length > 0) {
  console.error("PURITY FAIL — banned patterns in sim/:");
  console.error(report.join("\n"));
  process.exit(1);
}

console.log(
  "PURITY OK — no banned Math.random / Date / performance / sin|cos|tan|atan|atan2|exp|log|pow / Intl / setTimeout|setInterval in sim/ (comments ignored)",
);
process.exit(0);
