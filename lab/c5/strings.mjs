import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../apps/career/src");
const banned = /\b(TODO|FIXME|placeholder|lorem|NONSHIPPABLE|standin-)\b/i;
const bad = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "vendor") continue;
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) {
      walk(file);
      continue;
    }
    if (!file.endsWith(".tsx") && !file.endsWith(".ts")) continue;
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (banned.test(line)) bad.push(`${file}:${index + 1}: ${line.trim()}`);
    });
  }
}

walk(root);
if (bad.length) {
  console.error(bad.join("\n"));
  process.exit(1);
}
console.log("string_check_pass=true");
