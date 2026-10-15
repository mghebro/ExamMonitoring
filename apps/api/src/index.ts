import { validateConfig, ApiConfigSchema } from "@exam-monitor/config";
import { closeDatabaseConnection } from "@exam-monitor/database";
import { logger } from "@exam-monitor/shared";
import { buildApp } from "./app.js";

const log = logger.child("ApiMain");

async function main() {
  log.info("Starting Exam Monitor API...");

  const config = validateConfig(ApiConfigSchema, process.env);
  const app = await buildApp();

  async function shutdown(signal: string) {
    log.info(`Received ${signal}. Shutting down API gracefully...`);
    await app.close();
    await closeDatabaseConnection();
    log.info("API server stopped.");
    process.exit(0);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await app.listen({ port: config.PORT, host: config.HOST });
  log.info(`API server running at http://${config.HOST}:${config.PORT}`);
  log.info(`Swagger API documentation available at http://${config.HOST}:${config.PORT}/docs`);
}

main().catch(async (err) => {
  log.error("Fatal API startup error", { error: String(err) });
  await closeDatabaseConnection();
  process.exit(1);
});
