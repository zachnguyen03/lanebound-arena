/**
 * Build the Watch, then serve dist two ways:
 * Vite preview on 4173 (existing specs) and a no-fallback static server on 4175.
 */
import { spawn } from "node:child_process";
import { startStaticServer } from "./static-server.mjs";

const build = spawn("npx", ["vite", "build"], { stdio: "inherit" });

build.on("exit", (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const staticServer = startStaticServer(4175);
  const preview = spawn(
    "npx",
    ["vite", "preview", "--host", "127.0.0.1", "--port", "4173"],
    { stdio: "inherit" },
  );
  const stop = () => {
    staticServer.close();
    preview.kill("SIGTERM");
  };
  process.on("SIGTERM", () => {
    stop();
    process.exit(0);
  });
  process.on("SIGINT", () => {
    stop();
    process.exit(0);
  });
  preview.on("exit", (c) => {
    staticServer.close();
    process.exit(c ?? 0);
  });
});
