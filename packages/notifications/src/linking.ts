import { eq, and, gt, isNull } from "drizzle-orm";
import {
  getDb,
  telegramLinkingTokens,
  telegramLinks,
} from "@exam-monitor/database";
import {
  generateSecureLinkingToken,
  hashLinkingToken,
  generateId,
  ValidationError,
  AppError,
  logger,
} from "@exam-monitor/shared";

export interface CreateLinkingTokenResult {
  rawToken: string;
  expiresAt: string;
  deepLink: string;
}

export interface TelegramUserData {
  id: number;
  chatId: number;
  username?: string | null;
  firstName?: string | null;
}

export class TelegramLinkingService {
  private log = logger.child("TelegramLinking");

  constructor(private botUsername: string = "ExamMonitorBot") {}

  /**
   * Step 1: Authenticated user requests a single-use secure linking token.
   * Generates a 32-byte cryptographic token, persists its SHA-256 hash, and constructs the Telegram deep link.
   */
  async generateLinkingToken(
    userId: string,
    ttlSeconds = 600,
    subscribedCategories?: string
  ): Promise<CreateLinkingTokenResult> {
    const rawToken = generateSecureLinkingToken(32);
    const tokenHash = hashLinkingToken(rawToken);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const db = getDb();

    // Invalidate any existing unused tokens for this user
    await db
      .update(telegramLinkingTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(telegramLinkingTokens.userId, userId),
          isNull(telegramLinkingTokens.usedAt)
        )
      );

    // Save hashed token
    await db.insert(telegramLinkingTokens).values({
      id: generateId(),
      userId,
      tokenHash,
      subscribedCategories: subscribedCategories ?? null,
      expiresAt,
    });

    const deepLink = `https://t.me/${this.botUsername}?start=${rawToken}`;

    return {
      rawToken,
      expiresAt: expiresAt.toISOString(),
      deepLink,
    };
  }

  /**
   * Step 2: The bot receives `/start <token>`.
   * Validates single-use token, expiry, links the Telegram user ID to the App user ID,
   * and immediately invalidates the token.
   */
  async verifyAndConsumeToken(
    rawToken: string,
    telegramUser: TelegramUserData
  ): Promise<{ success: boolean; userId?: string; error?: string }> {
    if (!rawToken || rawToken.trim().length === 0) {
      return { success: false, error: "Missing linking token." };
    }

    const tokenHash = hashLinkingToken(rawToken.trim());
    const db = getDb();

    // Look up token by hash
    const [tokenRecord] = await db
      .select()
      .from(telegramLinkingTokens)
      .where(eq(telegramLinkingTokens.tokenHash, tokenHash))
      .limit(1);

    if (!tokenRecord) {
      this.log.warn("Invalid linking token attempted.");
      return {
        success: false,
        error: "This linking token is invalid or does not exist. Please generate a new link in your dashboard.",
      };
    }

    if (tokenRecord.usedAt !== null) {
      this.log.warn("Reused linking token attempted.", { tokenId: tokenRecord.id });
      return {
        success: false,
        error: "This linking token has already been used. Please generate a new connection link in your dashboard.",
      };
    }

    if (tokenRecord.expiresAt < new Date()) {
      this.log.warn("Expired linking token attempted.", { tokenId: tokenRecord.id });
      return {
        success: false,
        error: "This linking token has expired (valid for 10 minutes). Please generate a new connection link in your dashboard.",
      };
    }

    // Atomically link user and mark token used
    await db.transaction(async (tx) => {
      // 1. Mark token used
      await tx
        .update(telegramLinkingTokens)
        .set({ usedAt: new Date() })
        .where(eq(telegramLinkingTokens.id, tokenRecord.id));

      // 2. Upsert telegram_links
      await tx
        .insert(telegramLinks)
        .values({
          id: generateId(),
          userId: tokenRecord.userId,
          telegramUserId: telegramUser.id,
          telegramChatId: telegramUser.chatId,
          telegramUsername: telegramUser.username ?? null,
          subscribedCategories: tokenRecord.subscribedCategories ?? null,
          isSubscribed: true,
          linkedAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [telegramLinks.userId],
          set: {
            telegramUserId: telegramUser.id,
            telegramChatId: telegramUser.chatId,
            telegramUsername: telegramUser.username ?? null,
            subscribedCategories: tokenRecord.subscribedCategories ?? null,
            isSubscribed: true,
            updatedAt: new Date(),
          },
        });
    });

    this.log.info("Telegram account successfully linked", {
      userId: tokenRecord.userId,
      telegramUserId: telegramUser.id,
    });

    return { success: true, userId: tokenRecord.userId };
  }

  /**
   * Disconnect Telegram account
   */
  async unlinkAccount(userId: string): Promise<boolean> {
    const db = getDb();
    const result = await db
      .delete(telegramLinks)
      .where(eq(telegramLinks.userId, userId))
      .returning();

    return result.length > 0;
  }
}
