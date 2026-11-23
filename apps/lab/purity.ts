#!/usr/bin/env node
/**
 * npm run purity — grep sim/ for banned APIs. Exit 1 on match.
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const simDir = path.join(root, "sim");

// Banned in sim/: nondeterminism, wall-clock, and non-IEEE-exact Math / locale / timers.
const pattern = [
  "Math\\.random",
  "Date\\.now",
  "performance\\.now",
  "new Date",
  "Math\\.sin",
  "Math\\.cos",
  "Math\\.tan\\b",
  "Math\\.atan\\b",
  "Math\\.atan2",
  "Math\\.exp",
  "Math\\.log",
  "Math\\.pow\\b",
  "\\bIntl\\b",
  "setTimeout",
  "setInterval",
].join("|");

let out = "";
let found = false;
try {
  out = execSync(`rg -n "${pattern}" "${simDir}"`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  found = out.trim().length > 0;
} catch (e: unknown) {
  const err = e as { status?: number; stdout?: string };
  if (err.status === 1) {
    found = false;
    out = "";
  } else {
    try {
      out = execSync(`grep -RInE "${pattern}" "${simDir}" || true`, {
        encoding: "utf8",
      });
      found = out.trim().length > 0;
    } catch {
      console.error("purity: neither rg nor grep available");
      process.exit(2);
    }
  }
}

if (found) {
  console.error("PURITY FAIL — banned patterns in sim/:");
  console.error(out.trim());
  process.exit(1);
}

console.log(
  "PURITY OK — no banned Math.random / Date / performance / sin|cos|tan|atan|atan2|exp|log|pow / Intl / setTimeout|setInterval in sim/",
);
process.exit(0);
