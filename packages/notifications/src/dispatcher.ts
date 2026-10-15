import { sql, eq, and, lte, inArray } from "drizzle-orm";
import {
  getDb,
  notificationOutbox,
  telegramLinks,
} from "@exam-monitor/database";
import { AppError, RateLimitError, logger } from "@exam-monitor/shared";
import { TelegramBotClient } from "./bot-client.js";

export interface DispatcherOptions {
  batchSize?: number;
  maxRetries?: number;
}

export class NotificationOutboxDispatcher {
  private log = logger.child("OutboxDispatcher");

  constructor(
    private botClient: TelegramBotClient,
    private options: DispatcherOptions = {}
  ) {}

  /**
   * Process a batch of pending notifications from the transactional outbox.
   * Uses atomic database selection with concurrency protection to prevent duplicate sends across workers.
   */
  async dispatchPendingOutbox(): Promise<number> {
    const batchSize = this.options.batchSize ?? 10;
    const db = getDb();
    let deliveredCount = 0;

    try {
      // 1. Atomically claim pending outbox items ready for delivery
      const pendingItems = await db.execute(sql`
        UPDATE notification_outbox
        SET status = 'PROCESSING'
        WHERE id IN (
          SELECT id
          FROM notification_outbox
          WHERE status = 'PENDING'
            AND next_attempt_at <= now()
          ORDER BY created_at ASC
          LIMIT ${batchSize}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, event_id, user_id, telegram_chat_id, message_text, retry_count, max_retries;
      `);

      const items = pendingItems as unknown as Array<{
        id: string;
        event_id: string;
        user_id: string;
        telegram_chat_id: number;
        message_text: string;
        retry_count: number;
        max_retries: number;
      }>;

      if (!items || items.length === 0) {
        return 0;
      }

      this.log.info(`Processing ${items.length} pending notification deliveries...`);

      for (const item of items) {
        try {
          await this.botClient.sendMessage(item.telegram_chat_id, item.message_text);

          // Mark delivered
          await db
            .update(notificationOutbox)
            .set({
              status: "DELIVERED",
              deliveredAt: new Date(),
              lastError: null,
            })
            .where(eq(notificationOutbox.id, item.id));

          deliveredCount++;
        } catch (err: unknown) {
          const isRateLimit = err instanceof RateLimitError;
          const isDeactivated =
            err instanceof AppError &&
            (err.code === "TELEGRAM_CHAT_DEACTIVATED" || err.statusCode === 403);

          if (isDeactivated) {
            this.log.warn(`Telegram recipient ${item.telegram_chat_id} deactivated or blocked bot. Disabling alerts.`);

            // Mark outbox item failed
            await db
              .update(notificationOutbox)
              .set({
                status: "FAILED",
                lastError: "Bot was blocked by the user or chat was deactivated",
              })
              .where(eq(notificationOutbox.id, item.id));

            // Automatically mute user subscription to prevent wasted retry attempts
            await db
              .update(telegramLinks)
              .set({ isSubscribed: false, updatedAt: new Date() })
              .where(eq(telegramLinks.userId, item.user_id));
          } else if (isRateLimit) {
            const retryAfter = (err as RateLimitError).retryAfterSeconds ?? 30;
            this.log.warn(`Telegram rate limit. Pausing outbox delivery for ${retryAfter}s.`);

            await db
              .update(notificationOutbox)
              .set({
                status: "PENDING",
                nextAttemptAt: new Date(Date.now() + retryAfter * 1000),
                lastError: (err as Error).message,
              })
              .where(eq(notificationOutbox.id, item.id));

            break; // Stop processing batch when rate-limited
          } else {
            const nextRetry = item.retry_count + 1;
            const isExhausted = nextRetry >= item.max_retries;

            // Bounded exponential retry delay: 10s * 2^(retry)
            const delaySeconds = Math.min(10 * Math.pow(2, nextRetry), 3600);
            const nextAttempt = new Date(Date.now() + delaySeconds * 1000);

            this.log.error(`Notification delivery failed for item ${item.id}`, {
              retryCount: nextRetry,
              isExhausted,
              error: (err as Error).message,
            });

            await db
              .update(notificationOutbox)
              .set({
                status: isExhausted ? "EXHAUSTED" : "PENDING",
                retryCount: nextRetry,
                nextAttemptAt: nextAttempt,
                lastError: (err as Error).message || "Unknown error",
              })
              .where(eq(notificationOutbox.id, item.id));
          }
        }
      }
    } catch (err: unknown) {
      this.log.error("Outbox dispatch loop encountered an error", { error: String(err) });
    }

    return deliveredCount;
  }
}
