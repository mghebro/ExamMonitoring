import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelegramCommandRouter } from "../router.js";
import { TelegramBotClient } from "../bot-client.js";
import { TelegramLinkingService } from "../linking.js";

vi.mock("@exam-monitor/database", () => ({
  getDb: () => ({
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: () => Promise.resolve([{ updateId: 1 }]),
        }),
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }),
  }),
  telegramProcessedUpdates: { updateId: "update_id" },
  telegramLinks: { telegramUserId: "telegram_user_id" },
  examTargets: { isActive: "is_active" },
  monitoringState: { targetId: "target_id" },
}));

describe("Telegram Command Router", () => {
  let sentMessages: Array<{ chatId: number; text: string }> = [];
  let botClientMock: any;
  let linkingServiceMock: any;
  let router: TelegramCommandRouter;

  beforeEach(() => {
    sentMessages = [];

    botClientMock = {
      sendMessage: vi.fn().mockImplementation((chatId: number, text: string) => {
        sentMessages.push({ chatId, text });
        return Promise.resolve({ messageId: 100 + sentMessages.length });
      }),
    };

    linkingServiceMock = {
      verifyAndConsumeToken: vi.fn().mockResolvedValue({
        success: true,
        userId: "user-test-1",
      }),
    };

    router = new TelegramCommandRouter(
      botClientMock as unknown as TelegramBotClient,
      linkingServiceMock as unknown as TelegramLinkingService
    );
  });

  it("handles /help command by returning usage instructions", async () => {
    await router.handleUpdate({
      update_id: 1,
      message: {
        message_id: 10,
        from: { id: 12345, is_bot: false, first_name: "Alice" },
        chat: { id: 12345, type: "private" },
        date: Date.now(),
        text: "/help",
      },
    });

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].text).toContain("Exam Monitor Bot Commands");
    expect(sentMessages[0].text).toContain("/status");
  });

  it("handles /start with a valid token and completes linking", async () => {
    await router.handleUpdate({
      update_id: 2,
      message: {
        message_id: 11,
        from: { id: 12345, is_bot: false, first_name: "Bob", username: "bob_tg" },
        chat: { id: 12345, type: "private" },
        date: Date.now(),
        text: "/start valid-secure-token-123",
      },
    });

    expect(linkingServiceMock.verifyAndConsumeToken).toHaveBeenCalledWith(
      "valid-secure-token-123",
      expect.objectContaining({ id: 12345, chatId: 12345 })
    );

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].text).toContain("Welcome to Exam Monitor, Bob!");
    expect(sentMessages[0].text).toContain("securely linked");
  });

  it("handles unknown commands gracefully", async () => {
    await router.handleUpdate({
      update_id: 3,
      message: {
        message_id: 12,
        from: { id: 12345, is_bot: false, first_name: "Charlie" },
        chat: { id: 12345, type: "private" },
        date: Date.now(),
        text: "/unknowncommand",
      },
    });

    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].text).toContain("Unknown command. Type /help");
  });
});
