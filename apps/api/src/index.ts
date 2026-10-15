import { validateConfig, ApiConfigSchema } from "@exam-monitor/config";
import { closeDatabaseConnection } from "@exam-monitor/database";
import {
  TelegramBotClient,
  TelegramLinkingService,
  TelegramCommandRouter,
  TelegramPollingReceiver,
} from "@exam-monitor/notifications";
import { logger } from "@exam-monitor/shared";
import { buildApp } from "./app.js";

const log = logger.child("ApiMain");

async function main() {
  log.info("Starting Exam Monitor API...");

  const config = validateConfig(ApiConfigSchema, process.env);
  const app = await buildApp();

  let pollingReceiver: TelegramPollingReceiver | null = null;
  if (config.TELEGRAM_MODE === "polling" && config.TELEGRAM_BOT_TOKEN) {
    const botClient = new TelegramBotClient(config.TELEGRAM_BOT_TOKEN);
    const linkingService = new TelegramLinkingService(
      config.TELEGRAM_BOT_USERNAME || "DrivingExamMonitor_bot"
    );
    const router = new TelegramCommandRouter(botClient, linkingService);
    pollingReceiver = new TelegramPollingReceiver(botClient, router);
    await pollingReceiver.start();
  }

  async function shutdown(signal: string) {
    log.info(`Received ${signal}. Shutting down API gracefully...`);
    if (pollingReceiver) {
      pollingReceiver.stop();
    }
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
