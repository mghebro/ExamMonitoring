import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelegramLinkingService } from "../linking.js";

// Mock database
const mockTokens = new Map<string, any>();
const mockLinks = new Map<string, any>();

vi.mock("@exam-monitor/database", () => ({
  getDb: () => ({
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
    insert: (table: any) => ({
      values: (val: any) => {
        if (val.tokenHash) {
          mockTokens.set(val.tokenHash, { ...val, usedAt: null });
        }
        return Promise.resolve();
      },
    }),
    select: () => ({
      from: () => ({
        where: (condition: any) => ({
          limit: () => {
            // Return from mockTokens
            const values = Array.from(mockTokens.values());
            return Promise.resolve(values.slice(0, 1));
          },
        }),
      }),
    }),
    delete: () => ({
      where: () => ({
        returning: () => Promise.resolve([{ id: "deleted-link" }]),
      }),
    }),
    transaction: async (cb: any) => {
      const tx = {
        update: () => ({
          set: (updateVal: any) => ({
            where: () => {
              for (const [k, v] of mockTokens.entries()) {
                mockTokens.set(k, { ...v, ...updateVal });
              }
              return Promise.resolve();
            },
          }),
        }),
        insert: () => ({
          values: (linkVal: any) => ({
            onConflictDoUpdate: () => {
              mockLinks.set(linkVal.userId, linkVal);
              return Promise.resolve();
            },
          }),
        }),
      };
      return cb(tx);
    },
  }),
  telegramLinkingTokens: { tokenHash: "token_hash", id: "id", userId: "user_id", usedAt: "used_at" },
  telegramLinks: { userId: "user_id" },
  profiles: { id: "id", preferredCategory: "preferred_category" },
}));

describe("Telegram Linking Service", () => {
  beforeEach(() => {
    mockTokens.clear();
    mockLinks.clear();
  });

  it("generates a high-entropy linking token and correct deep link", async () => {
    const service = new TelegramLinkingService("ExamMonitorBot");
    const result = await service.generateLinkingToken("user-123", 600);

    expect(result.rawToken).toHaveLength(64);
    expect(result.deepLink).toBe(`https://t.me/ExamMonitorBot?start=${result.rawToken}`);
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("verifies and consumes a valid token", async () => {
    const service = new TelegramLinkingService("ExamMonitorBot");
    const { rawToken } = await service.generateLinkingToken("user-123", 600);

    const result = await service.verifyAndConsumeToken(rawToken, {
      id: 987654321,
      chatId: 987654321,
      username: "testdriver",
    });

    expect(result.success).toBe(true);
    expect(result.userId).toBe("user-123");
  });

  it("rejects missing or empty linking tokens", async () => {
    const service = new TelegramLinkingService("ExamMonitorBot");
    const result = await service.verifyAndConsumeToken("", {
      id: 987654321,
      chatId: 987654321,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Missing linking token");
  });

  it("rejects token reuse after it has already been consumed", async () => {
    const service = new TelegramLinkingService("ExamMonitorBot");
    const { rawToken } = await service.generateLinkingToken("user-123", 600);

    // First consumption succeeds
    const firstResult = await service.verifyAndConsumeToken(rawToken, {
      id: 987654321,
      chatId: 987654321,
    });
    expect(firstResult.success).toBe(true);

    // Second consumption fails with reuse error
    const secondResult = await service.verifyAndConsumeToken(rawToken, {
      id: 987654321,
      chatId: 987654321,
    });
    expect(secondResult.success).toBe(false);
    expect(secondResult.error).toContain("already been used");
  });

  it("successfully unlinks account", async () => {
    const service = new TelegramLinkingService("ExamMonitorBot");
    const unlinked = await service.unlinkAccount("user-123");
    expect(unlinked).toBe(true);
  });
});
