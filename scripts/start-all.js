#!/usr/bin/env node
/**
 * Single-service supervisor to run both Fastify API and the Background Worker
 * together in one process container. Ideal for free tiers (e.g. Koyeb Free Eco/Nano)
 * where only 1 free service instance is granted.
 */
import { spawn } from "node:child_process";
import process from "node:process";

console.log("[supervisor] Launching Exam Monitor unified backend (API + Worker)...");

// Forward PORT to apps/api
const env = { ...process.env };
if (!env.PORT && process.env.PORT) {
  env.PORT = process.env.PORT;
}

const api = spawn("node", ["apps/api/dist/index.js"], {
  stdio: "inherit",
  env,
});

const worker = spawn("node", ["apps/worker/dist/index.js"], {
  stdio: "inherit",
  env,
});

let isShuttingDown = false;
function forwardSignal(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[supervisor] Received ${signal}. Stopping API and Worker gracefully...`);
  api.kill(signal);
  worker.kill(signal);
}

process.on("SIGINT", () => forwardSignal("SIGINT"));
process.on("SIGTERM", () => forwardSignal("SIGTERM"));

api.on("exit", (code) => {
  if (!isShuttingDown) {
    console.error(`[supervisor] API process exited with code ${code}`);
    forwardSignal("SIGTERM");
    process.exit(code ?? 1);
  }
});

worker.on("exit", (code) => {
  if (!isShuttingDown) {
    console.error(`[supervisor] Worker process exited with code ${code}`);
    forwardSignal("SIGTERM");
    process.exit(code ?? 1);
  }
});
