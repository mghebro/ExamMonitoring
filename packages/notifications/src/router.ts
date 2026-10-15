import { eq } from "drizzle-orm";
import {
  getDb,
  telegramLinks,
  telegramProcessedUpdates,
  monitoringState,
  examTargets,
} from "@exam-monitor/database";
import { logger } from "@exam-monitor/shared";
import { TelegramBotClient, TelegramUpdate } from "./bot-client.js";
import { TelegramLinkingService } from "./linking.js";

export class TelegramCommandRouter {
  private log = logger.child("TelegramRouter");

  constructor(
    private botClient: TelegramBotClient,
    private linkingService: TelegramLinkingService
  ) {}

  /**
   * Process incoming update with deduplication and RBAC validation.
   */
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const updateId = update.update_id;
    const db = getDb();

    // 1. Deduplication check: ignore if already processed
    try {
      const db = getDb();
      const inserted = await db
        .insert(telegramProcessedUpdates)
        .values({ updateId })
        .onConflictDoNothing()
        .returning();

      if (inserted.length === 0) {
        this.log.debug(`Update #${updateId} already processed, skipping.`);
        return;
      }
    } catch {
      // If DB is offline / test mock, proceed safely
    }

    const message = update.message;
    if (!message || !message.text || !message.from) {
      return;
    }

    const chatId = message.chat.id;
    const sender = message.from;
    const text = message.text.trim();

    this.log.info("Received Telegram message", {
      chatId,
      senderId: sender.id,
      textLength: text.length,
    });

    try {
      // Command routing
      if (text.startsWith("/start")) {
        await this.handleStartCommand(text, chatId, sender);
      } else if (text === "/help") {
        await this.handleHelpCommand(chatId);
      } else if (text === "/status") {
        await this.handleStatusCommand(chatId, sender.id);
      } else if (text === "/subscribe") {
        await this.handleSubscribeCommand(chatId, sender.id);
      } else if (text === "/unsubscribe") {
        await this.handleUnsubscribeCommand(chatId, sender.id);
      } else if (text === "/test") {
        await this.handleTestCommand(chatId, sender.id);
      } else if (text === "/settings") {
        await this.handleSettingsCommand(chatId, sender.id);
      } else if (text.startsWith("/")) {
        await this.botClient.sendMessage(
          chatId,
          "❓ Unknown command. Type /help to see all available commands."
        );
      }
    } catch (err: unknown) {
      this.log.error("Error executing Telegram command", { error: String(err) });
      await this.botClient.sendMessage(
        chatId,
        "⚠️ An error occurred while processing your request. Please try again later."
      );
    }
  }

  private async handleStartCommand(
    text: string,
    chatId: number,
    sender: { id: number; username?: string; first_name: string }
  ): Promise<void> {
    const parts = text.split(" ");
    const token = parts.length > 1 ? parts[1].trim() : "";

    if (token) {
      // Attempt secure account linking
      const linkResult = await this.linkingService.verifyAndConsumeToken(token, {
        id: sender.id,
        chatId,
        username: sender.username,
        firstName: sender.first_name,
      });

      if (linkResult.success) {
        const welcomeMessage = [
          `🎉 *Welcome to Exam Monitor, ${sender.first_name}!*`,
          ``,
          `✅ Your Telegram account has been securely linked to your dashboard.`,
          `🔔 Notifications are now *ACTIVE*. You will receive immediate alerts whenever new driving exam dates or slots appear.`,
          ``,
          `Available commands:`,
          `• /status — View current monitoring and connection status`,
          `• /test — Receive a test notification`,
          `• /unsubscribe — Temporarily pause notifications`,
          `• /help — Full command guide`,
        ].join("\n");

        await this.botClient.sendMessage(chatId, welcomeMessage);
      } else {
        await this.botClient.sendMessage(
          chatId,
          `❌ *Linking Failed:*\n${linkResult.error || "Unable to link account."}`
        );
      }
    } else {
      // Received /start with no token
      const guideMessage = [
        `👋 *Hello, ${sender.first_name}!*`,
        ``,
        `Exam Monitor notifies authorized users the instant driving exam slots become available.`,
        ``,
        `To link this chat to your account:`,
        `1. Open the Exam Monitor dashboard on your computer or phone.`,
        `2. Log in and click *"Connect Telegram"*.`,
        `3. Tap the generated link, which will bring you back here with your secure single-use linking token.`,
        ``,
        `Type /help for more information.`,
      ].join("\n");

      await this.botClient.sendMessage(chatId, guideMessage);
    }
  }

  private async handleHelpCommand(chatId: number): Promise<void> {
    const helpMessage = [
      `📖 *Exam Monitor Bot Commands*`,
      ``,
      `• /status — Check current monitoring health and your alert subscription.`,
      `• /subscribe — Enable notifications for newly available exam dates.`,
      `• /unsubscribe — Temporarily mute exam notifications.`,
      `• /test — Send a test alert to verify delivery.`,
      `• /settings — View your notification preferences.`,
      `• /help — Show this instructions manual.`,
      ``,
      `_Note: When a date appears, slots are claimed rapidly on the official portal. Be ready to book as soon as you receive an alert!_`,
    ].join("\n");

    await this.botClient.sendMessage(chatId, helpMessage);
  }

  private async handleStatusCommand(chatId: number, senderId: number): Promise<void> {
    const db = getDb();
    const [link] = await db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.telegramUserId, senderId))
      .limit(1);

    if (!link) {
      await this.botClient.sendMessage(
        chatId,
        "🔒 *Account Not Linked*\nPlease connect your Telegram account from the Exam Monitor dashboard to view monitoring status."
      );
      return;
    }

    const [target] = await db.select().from(examTargets).where(eq(examTargets.isActive, true)).limit(1);
    const [state] = target
      ? await db.select().from(monitoringState).where(eq(monitoringState.targetId, target.id)).limit(1)
      : [null];

    const statusMessage = [
      `📊 *Exam Monitor Status*`,
      ``,
      `• Telegram Account: *Linked* (@${link.telegramUsername || senderId})`,
      `• Notification Status: *${link.isSubscribed ? "Subscribed 🔔" : "Muted 🔕"}*`,
      `• Worker State: *${state?.state || "Unknown"}*`,
      `• Last Slot Status: *${state?.lastStatus || "UNKNOWN"}*`,
      `• Last Checked: *${state?.lastCheckedAt ? new Date(state.lastCheckedAt).toLocaleTimeString() : "Never"}*`,
      `• Polling Latency: *${state?.lastLatencyMs ?? "--"} ms*`,
    ].join("\n");

    await this.botClient.sendMessage(chatId, statusMessage);
  }

  private async handleSubscribeCommand(chatId: number, senderId: number): Promise<void> {
    const db = getDb();
    const [link] = await db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.telegramUserId, senderId))
      .limit(1);

    if (!link) {
      await this.botClient.sendMessage(
        chatId,
        "🔒 Please connect your Telegram account from the Exam Monitor dashboard first."
      );
      return;
    }

    await db
      .update(telegramLinks)
      .set({ isSubscribed: true, updatedAt: new Date() })
      .where(eq(telegramLinks.telegramUserId, senderId));

    await this.botClient.sendMessage(
      chatId,
      "🔔 *Subscribed!* You will now receive instant alerts whenever new exam slots are detected."
    );
  }

  private async handleUnsubscribeCommand(chatId: number, senderId: number): Promise<void> {
    const db = getDb();
    const [link] = await db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.telegramUserId, senderId))
      .limit(1);

    if (!link) {
      await this.botClient.sendMessage(
        chatId,
        "🔒 Please connect your Telegram account from the Exam Monitor dashboard first."
      );
      return;
    }

    await db
      .update(telegramLinks)
      .set({ isSubscribed: false, updatedAt: new Date() })
      .where(eq(telegramLinks.telegramUserId, senderId));

    await this.botClient.sendMessage(
      chatId,
      "🔕 *Unsubscribed.* Notifications are paused. Send /subscribe at any time to resume."
    );
  }

  private async handleTestCommand(chatId: number, senderId: number): Promise<void> {
    const db = getDb();
    const [link] = await db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.telegramUserId, senderId))
      .limit(1);

    if (!link) {
      await this.botClient.sendMessage(
        chatId,
        "🔒 Please connect your Telegram account from the Exam Monitor dashboard first."
      );
      return;
    }

    const testMessage = [
      `🧪 *Test Notification*`,
      ``,
      `Delivery channel verified successfully! When newly available exam slots are detected, alerts will appear like this.`,
      ``,
      `Detection time: ${new Date().toISOString()}`,
      `Account: @${link.telegramUsername || senderId}`,
    ].join("\n");

    await this.botClient.sendMessage(chatId, testMessage);
  }

  private async handleSettingsCommand(chatId: number, senderId: number): Promise<void> {
    const db = getDb();
    const [link] = await db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.telegramUserId, senderId))
      .limit(1);

    if (!link) {
      await this.botClient.sendMessage(
        chatId,
        "🔒 Please connect your Telegram account from the Exam Monitor dashboard first."
      );
      return;
    }

    const settingsMessage = [
      `⚙️ *Notification Preferences*`,
      ``,
      `• Alerts Enabled: *${link.isSubscribed ? "Yes" : "No"}*`,
      `• Channel: *Telegram Direct Chat*`,
      `• Chat ID: *${chatId}*`,
      ``,
      `Use /subscribe or /unsubscribe to toggle alerts, or visit the web dashboard for advanced settings.`,
    ].join("\n");

    await this.botClient.sendMessage(chatId, settingsMessage);
  }
}
