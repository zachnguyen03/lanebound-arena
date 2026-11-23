import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";

/**
 * Allowed `placeholder` spellings in dist:
 * - `::placeholder` CSS selectors
 * - `placeholder=` input attributes
 * - Tailwind's own utility tokens (`placeholder-color`, `{placeholder:`, `"placeholder"`)
 * Anything else is user-facing copy and should be rewritten in source.
 */
function placeholderAllowed(text: string, i: number): boolean {
  if (text.slice(i - 2, i) === "::") return true;
  const before = text[i - 1];
  const after = text[i + "placeholder".length];
  if (after === "=" || after === "-" || after === ":") return true;
  if ((before === '"' || before === "'") && (after === '"' || after === "'")) {
    return true;
  }
  return false;
}

function placeholderOffenders(root: string): string[] {
  const hits: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(p);
        continue;
      }
      if (!p.endsWith(".js") && !p.endsWith(".css") && !p.endsWith(".html")) continue;
      const text = fs.readFileSync(p, "utf8");
      const re = /placeholder/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        if (placeholderAllowed(text, m.index)) continue;
        const line = text.slice(0, m.index).split("\n").length;
        hits.push(`${path.relative(root, p)}:${line}`);
      }
    }
  };
  walk(root);
  return hits;
}

/**
 * Check the shipped bundle. This plugin does not rewrite chunk text.
 * Design markdown is not part of the app, so those files are removed.
 */
function distHygiene(): Plugin {
  return {
    name: "watch-dist-hygiene",
    closeBundle() {
      const root = path.resolve(__dirname, "dist");
      const walk = (dir: string) => {
        if (!fs.existsSync(dir)) return;
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, ent.name);
          if (ent.isDirectory()) walk(p);
          else if (ent.name.endsWith(".md")) fs.unlinkSync(p);
        }
      };
      walk(root);
      const offenders = placeholderOffenders(root);
      if (offenders.length > 0) {
        throw new Error(
          "dist still contains placeholder outside ::placeholder and placeholder= attributes:\n" +
            offenders.join("\n"),
        );
      }
    },
  };
}

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react(), tailwindcss(), distHygiene()],
  resolve: {
    alias: {
      "@sim": path.resolve(__dirname, "../../sim"),
      "@watch": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
  },
  preview: {
    port: 4173,
    host: "127.0.0.1",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
