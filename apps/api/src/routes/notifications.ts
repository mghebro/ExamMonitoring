import { FastifyPluginAsync } from "fastify";
import { eq, desc } from "drizzle-orm";
import {
  getDb,
  notificationOutbox,
  telegramLinks,
  monitoringEvents,
} from "@exam-monitor/database";
import { TelegramBotClient } from "@exam-monitor/notifications";
import { generateId, ValidationError, NotFoundError } from "@exam-monitor/shared";

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  /**
   * GET /api/v1/notifications/history - User's private notification history
   */
  fastify.get(
    "/api/v1/notifications/history",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const db = getDb();

      const history = await db
        .select({
          id: notificationOutbox.id,
          eventId: notificationOutbox.eventId,
          messageText: notificationOutbox.messageText,
          status: notificationOutbox.status,
          retryCount: notificationOutbox.retryCount,
          lastError: notificationOutbox.lastError,
          deliveredAt: notificationOutbox.deliveredAt,
          createdAt: notificationOutbox.createdAt,
        })
        .from(notificationOutbox)
        .where(eq(notificationOutbox.userId, userId))
        .orderBy(desc(notificationOutbox.createdAt))
        .limit(50);

      return { notifications: history };
    }
  );

  /**
   * POST /api/v1/notifications/test - Trigger manual test notification to user's Telegram
   */
  fastify.post(
    "/api/v1/notifications/test",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const userId = request.user!.id;
      const db = getDb();

      const [link] = await db
        .select()
        .from(telegramLinks)
        .where(eq(telegramLinks.userId, userId))
        .limit(1);

      if (!link) {
        throw new ValidationError(
          "Your Telegram account is not yet connected. Please click 'Connect Telegram' first."
        );
      }

      if (!botToken) {
        throw new ValidationError("TELEGRAM_BOT_TOKEN is not configured on the server.");
      }

      const botClient = new TelegramBotClient(botToken);
      const testMsg = [
        `🧪 *Manual Test Notification*`,
        ``,
        `Your Telegram channel is functioning perfectly!`,
        `Alerts for new driving exam dates will be delivered here instantly.`,
        ``,
        `Sent at: ${new Date().toISOString()}`,
      ].join("\n");

      const { messageId } = await botClient.sendMessage(link.telegramChatId, testMsg);

      return {
        success: true,
        telegramChatId: link.telegramChatId,
        messageId,
      };
    }
  );
};
