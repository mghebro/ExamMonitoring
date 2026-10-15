import { FastifyPluginAsync } from "fastify";
import {
  TelegramBotClient,
  TelegramCommandRouter,
  TelegramLinkingService,
  TelegramUpdate,
} from "@exam-monitor/notifications";
import { logger, UnauthorizedError } from "@exam-monitor/shared";

export const telegramWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "ExamMonitorBot";
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!botToken) {
    logger.warn("TELEGRAM_BOT_TOKEN not configured. Webhook handler will return 503.");
    return;
  }

  const botClient = new TelegramBotClient(botToken);
  const linkingService = new TelegramLinkingService(botUsername);
  const router = new TelegramCommandRouter(botClient, linkingService);

  /**
   * POST /api/v1/telegram/webhook - Official Telegram Bot API Webhook Receiver
   */
  fastify.post("/api/v1/telegram/webhook", async (request, reply) => {
    // 1. Validate Secret Token Header (if configured)
    if (webhookSecret) {
      const incomingSecret = request.headers["x-telegram-bot-api-secret-token"];
      if (incomingSecret !== webhookSecret) {
        logger.warn("Unauthorized Telegram webhook request: secret token mismatch");
        throw new UnauthorizedError("Invalid Telegram webhook secret token");
      }
    }

    const update = request.body as TelegramUpdate;

    // 2. Process update asynchronously to return 200 immediately
    setImmediate(async () => {
      try {
        await router.handleUpdate(update);
      } catch (err: unknown) {
        logger.error("Error processing background webhook update", {
          updateId: update?.update_id,
          error: String(err),
        });
      }
    });

    // 3. Immediately acknowledge Telegram
    return { ok: true };
  });
};
