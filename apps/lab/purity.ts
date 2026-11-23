#!/usr/bin/env node
/**
 * npm run purity — scan sim/ and the career packages for banned APIs in
 * non-comment code. Exit 1 on a match that is not on the career allow-list.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { findBannedInSource, stripComments, type PurityHit } from "./purity-scan.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const simDir = path.join(root, "sim");
const careerDirs = [path.join(root, "packages/career"), path.join(root, "packages/match-contract")];

/**
 * Documented IEEE Math in the career engine. sim/ has no allow-list.
 * Math.sqrt and Math.PI are scanned only under packages/ (sim/ does not ban them).
 */
const CAREER_MATH_ALLOW: ReadonlyArray<{ file: string; apis: readonly string[] }> = [
  { file: "packages/career/src/strength.ts", apis: ["Math.exp"] },
  { file: "packages/career/src/glicko.ts", apis: ["Math.exp", "Math.log", "Math.sqrt", "Math.PI"] },
  { file: "packages/career/src/fake.ts", apis: ["Math.log", "Math.cos", "Math.sqrt", "Math.PI"] },
  { file: "packages/career/src/c0.test.ts", apis: ["Math.exp"] },
];

const CAREER_EXTRA_RE = /Math\.sqrt|Math\.PI/g;

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

function rel(fp: string): string {
  return path.relative(root, fp).split(path.sep).join("/");
}

function extraMathHits(source: string): PurityHit[] {
  const stripped = stripComments(source);
  const lines = stripped.split("\n");
  const orig = source.split("\n");
  const hits: PurityHit[] = [];
  for (let li = 0; li < lines.length; li++) {
    CAREER_EXTRA_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = CAREER_EXTRA_RE.exec(lines[li]!)) !== null) {
      hits.push({
        line: li + 1,
        text: (orig[li] ?? "").trimEnd(),
        match: match[0]!,
      });
    }
  }
  return hits;
}

const report: string[] = [];

for (const fp of listTsFiles(simDir)) {
  const src = readFileSync(fp, "utf8");
  for (const hit of findBannedInSource(src)) {
    report.push(`${fp}:${hit.line}: ${hit.text}`);
  }
}

for (const dir of careerDirs) {
  for (const fp of listTsFiles(dir)) {
    const src = readFileSync(fp, "utf8");
    const file = rel(fp);
    const allow = CAREER_MATH_ALLOW.find((row) => row.file === file)?.apis ?? [];
    const hits = [...findBannedInSource(src), ...extraMathHits(src)];
    for (const hit of hits) {
      if (allow.includes(hit.match)) continue;
      report.push(`${file}:${hit.line}: ${hit.match} ${hit.text}`);
    }
    const used = new Set(hits.map((hit) => hit.match));
    for (const api of allow) {
      if (!used.has(api)) report.push(`${file}: allow-list ${api} has no use`);
    }
  }
}

if (report.length > 0) {
  console.error("PURITY FAIL — banned patterns in sim/ or career packages:");
  console.error(report.join("\n"));
  process.exit(1);
}

console.log(
  "PURITY OK — sim/ has no banned Math/Date/Intl/timer use; career packages only use the allow-listed Math.exp/log/cos/sqrt/PI (comments ignored)",
);
process.exit(0);
