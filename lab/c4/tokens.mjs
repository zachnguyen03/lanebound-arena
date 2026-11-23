import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../apps/career/src");
const skip = new Set(["vendor", "fonts-shell.css"]);
const bad = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (skip.has(name)) continue;
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) {
      walk(file);
      continue;
    }
    if (!/\.(css|tsx|ts)$/.test(name)) continue;
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      if (/#[0-9a-fA-F]{3,8}\b/.test(line) || /\brgba?\(/.test(line) || /\bhsl\(/.test(line)) {
        bad.push(`${file}:${index + 1}: colour literal`);
      }
      if (/font-family\s*:/.test(line) && !/font-family\s*:\s*var\(/.test(line)) {
        bad.push(`${file}:${index + 1}: font-family is not a token`);
      }
    });
  }
}

walk(root);
if (bad.length) {
  console.error(bad.join("\n"));
  process.exit(1);
}
console.log("token_check_pass=true");
