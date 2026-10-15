import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationOutboxDispatcher } from "../dispatcher.js";
import { TelegramBotClient } from "../bot-client.js";
import { RateLimitError, AppError } from "@exam-monitor/shared";

// Mock outbox items in database
const mockOutboxItems = [
  {
    id: "outbox-1",
    event_id: "event-1",
    user_id: "user-1",
    telegram_chat_id: 11111,
    message_text: "New slot alert!",
    retry_count: 0,
    max_retries: 5,
  },
];

let mockDbUpdateSet: any = null;
let mockLinksUpdateSet: any = null;

vi.mock("@exam-monitor/database", () => ({
  getDb: () => ({
    execute: () => Promise.resolve(mockOutboxItems),
    update: (table: any) => ({
      set: (val: any) => ({
        where: () => {
          if (val.status) mockDbUpdateSet = val;
          if (val.isSubscribed !== undefined) mockLinksUpdateSet = val;
          return Promise.resolve();
        },
      }),
    }),
  }),
  notificationOutbox: { id: "id" },
  telegramLinks: { userId: "user_id" },
}));

describe("Notification Outbox Dispatcher", () => {
  let botClientMock: any;

  beforeEach(() => {
    mockDbUpdateSet = null;
    mockLinksUpdateSet = null;

    botClientMock = {
      sendMessage: vi.fn().mockResolvedValue({ messageId: 999 }),
    };
  });

  it("delivers pending outbox messages and marks them DELIVERED", async () => {
    const dispatcher = new NotificationOutboxDispatcher(
      botClientMock as unknown as TelegramBotClient
    );

    const delivered = await dispatcher.dispatchPendingOutbox();
    expect(delivered).toBe(1);
    expect(botClientMock.sendMessage).toHaveBeenCalledWith(11111, "New slot alert!");
    expect(mockDbUpdateSet.status).toBe("DELIVERED");
  });

  it("deactivates user subscription when bot was blocked (HTTP 403)", async () => {
    botClientMock.sendMessage = vi.fn().mockRejectedValue(
      new AppError("Bot was blocked by the user", 403, "TELEGRAM_CHAT_DEACTIVATED")
    );

    const dispatcher = new NotificationOutboxDispatcher(
      botClientMock as unknown as TelegramBotClient
    );

    const delivered = await dispatcher.dispatchPendingOutbox();
    expect(delivered).toBe(0);
    expect(mockDbUpdateSet.status).toBe("FAILED");
    expect(mockLinksUpdateSet.isSubscribed).toBe(false);
  });

  it("reschedules delivery when rate limited (HTTP 429)", async () => {
    botClientMock.sendMessage = vi.fn().mockRejectedValue(
      new RateLimitError("Telegram rate limited", 45)
    );

    const dispatcher = new NotificationOutboxDispatcher(
      botClientMock as unknown as TelegramBotClient
    );

    const delivered = await dispatcher.dispatchPendingOutbox();
    expect(delivered).toBe(0);
    expect(mockDbUpdateSet.status).toBe("PENDING");
    expect(new Date(mockDbUpdateSet.nextAttemptAt).getTime()).toBeGreaterThan(Date.now());
  });
});
