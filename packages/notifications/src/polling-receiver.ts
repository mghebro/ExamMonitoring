import { logger } from "@exam-monitor/shared";
import { TelegramBotClient, TelegramUpdate } from "./bot-client.js";
import { TelegramCommandRouter } from "./router.js";

/**
 * Long-polling receiver for Telegram Bot API.
 * Continuously fetches updates via getUpdates when TELEGRAM_MODE is "polling".
 */
export class TelegramPollingReceiver {
  private log = logger.child("TelegramPollingReceiver");
  private isRunning = false;
  private offset: number | undefined;

  constructor(
    private botClient: TelegramBotClient,
    private router: TelegramCommandRouter
  ) {}

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.log.info("Starting Telegram long-polling receiver...");

    // Remove any leftover webhook so Telegram allows getUpdates
    try {
      await this.botClient.deleteWebhook();
      this.log.info("Cleared existing Telegram webhook for polling mode.");
    } catch (err: unknown) {
      this.log.warn("Failed to delete webhook before starting polling", { error: String(err) });
    }

    // Start background loop
    this.pollLoop().catch((err: unknown) => {
      this.log.error("Fatal error in Telegram polling receiver loop", { error: String(err) });
    });
  }

  stop(): void {
    this.isRunning = false;
    this.log.info("Telegram polling receiver stopped.");
  }

  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const updates = await this.botClient.getUpdates(this.offset, 100, 10);
        for (const update of updates) {
          if (!this.isRunning) break;
          this.offset = update.update_id + 1;
          try {
            await this.router.handleUpdate(update);
          } catch (routerErr: unknown) {
            this.log.error("Error routing Telegram update", {
              updateId: update.update_id,
              error: String(routerErr),
            });
          }
        }
      } catch (err: unknown) {
        if (!this.isRunning) break;
        this.log.warn("Error in Telegram getUpdates polling", { error: String(err) });
        // Backoff slightly on network error
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }
}
