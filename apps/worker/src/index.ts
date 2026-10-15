import { validateConfig, WorkerConfigSchema } from "@exam-monitor/config";
import { closeDatabaseConnection } from "@exam-monitor/database";
import { logger } from "@exam-monitor/shared";
import { WorkerScheduler } from "./scheduler.js";

const log = logger.child("WorkerMain");

async function main() {
  log.info("Exam Monitor Worker initializing...");

  const config = validateConfig(WorkerConfigSchema, process.env);

  const scheduler = new WorkerScheduler({
    minPollIntervalSeconds: config.MIN_POLL_INTERVAL_SECONDS,
    maxBackoffSeconds: config.MAX_BACKOFF_SECONDS,
    leaseDurationSeconds: config.WORKER_LEASE_DURATION_SECONDS,
    allowedHosts: config.ALLOWED_EXAM_HOSTS,
    allowHttpForTesting: config.NODE_ENV === "test",
  });

  async function shutdown(signal: string) {
    log.info(`Received ${signal}. Shutting down worker gracefully...`);
    await scheduler.stop();
    await closeDatabaseConnection();
    log.info("Shutdown complete.");
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await scheduler.start();
  log.info("Exam Monitor Worker running.");
}

main().catch(async (err) => {
  log.error("Fatal worker startup error", { error: String(err) });
  await closeDatabaseConnection();
  process.exit(1);
});
