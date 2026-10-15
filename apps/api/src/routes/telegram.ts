import { FastifyPluginAsync } from "fastify";
import { TelegramLinkingService } from "@exam-monitor/notifications";

export const telegramRoutes: FastifyPluginAsync = async (fastify) => {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "ExamMonitorBot";
  const ttlSeconds = parseInt(process.env.TELEGRAM_LINKING_TOKEN_TTL_SECONDS || "600", 10);
  const linkingService = new TelegramLinkingService(botUsername);

  /**
   * POST /api/v1/telegram/link-token - Generate a single-use deep link to connect Telegram
   */
  fastify.post(
    "/api/v1/telegram/link-token",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const result = await linkingService.generateLinkingToken(userId, ttlSeconds);
      return result;
    }
  );

  /**
   * POST /api/v1/telegram/unlink - Disconnect linked Telegram account
   */
  fastify.post(
    "/api/v1/telegram/unlink",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const unlinked = await linkingService.unlinkAccount(userId);
      return { success: unlinked };
    }
  );
};
