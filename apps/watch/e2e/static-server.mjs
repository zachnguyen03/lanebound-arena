/**
 * Static file server for the Watch dist. Unknown paths are 404 text,
 * matching Cloudflare static assets (no SPA fallback).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".ico": "image/x-icon",
};

export function startStaticServer(port) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    let rel = decodeURIComponent(url.pathname);
    if (rel.includes("\0") || rel.split("/").includes("..")) {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      res.end("bad path");
      return;
    }
    let file = path.join(root, rel);
    const send = (target) => {
      fs.readFile(target, (err, buf) => {
        if (err) {
          res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          res.end("not found");
          return;
        }
        const ext = path.extname(target);
        res.writeHead(200, {
          "content-type": types[ext] ?? "application/octet-stream",
        });
        res.end(buf);
      });
    };
    fs.stat(file, (err, st) => {
      if (!err && st.isDirectory()) {
        send(path.join(file, "index.html"));
        return;
      }
      send(file);
    });
  });
  server.listen(port, "127.0.0.1");
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const port = Number(process.env.PORT ?? 4175);
  startStaticServer(port);
  console.log(`static 404 server http://127.0.0.1:${port}`);
}
