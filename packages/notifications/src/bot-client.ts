import { logger, RateLimitError, AppError } from "@exam-monitor/shared";

export interface SendMessageOptions {
  parseMode?: "Markdown" | "HTML" | "MarkdownV2";
  disableWebPagePreview?: boolean;
}

export interface TelegramBotUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
      first_name?: string;
    };
    date: number;
    text?: string;
  };
}

export class TelegramBotClient {
  private log = logger.child("TelegramBotClient");
  private baseUrl: string;

  constructor(private botToken: string) {
    if (!botToken || botToken.trim().length === 0) {
      throw new Error("TelegramBotClient requires a valid bot token");
    }
    this.baseUrl = `https://api.telegram.org/bot${botToken.trim()}`;
  }

  /**
   * Send text message to a Telegram chat.
   */
  async sendMessage(
    chatId: number,
    text: string,
    options: SendMessageOptions = {}
  ): Promise<{ messageId: number }> {
    const payload = {
      chat_id: chatId,
      text,
      parse_mode: options.parseMode || "Markdown",
      disable_web_page_preview: options.disableWebPagePreview ?? false,
    };

    const response = await fetch(`${this.baseUrl}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as any;

    if (!response.ok || !body.ok) {
      if (response.status === 429) {
        const retryAfter = body.parameters?.retry_after ?? 30;
        throw new RateLimitError(
          `Telegram rate limit hit. Retry after ${retryAfter}s`,
          retryAfter
        );
      }

      // Check if bot was blocked by user or chat was deactivated
      if (response.status === 403) {
        throw new AppError(
          body.description || "Bot was blocked by the user or chat deactivated",
          403,
          "TELEGRAM_CHAT_DEACTIVATED"
        );
      }

      throw new AppError(
        `Telegram API error: ${body.description || response.statusText}`,
        response.status || 502,
        "TELEGRAM_API_ERROR"
      );
    }

    return { messageId: body.result.message_id };
  }

  /**
   * Configure Telegram Webhook endpoint with secret token
   */
  async setWebhook(url: string, secretToken: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        secret_token: secretToken,
        allowed_updates: ["message"],
      }),
    });

    const body = (await response.json()) as any;
    return !!body.ok;
  }

  /**
   * Fetch updates using Long Polling (for local development or polling worker mode)
   */
  async getUpdates(offset?: number, limit = 100, timeout = 10): Promise<TelegramUpdate[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      timeout: String(timeout),
    });
    if (offset !== undefined) {
      params.set("offset", String(offset));
    }

    const response = await fetch(`${this.baseUrl}/getUpdates?${params.toString()}`);
    const body = (await response.json()) as any;

    if (!response.ok || !body.ok) {
      throw new AppError(
        `Telegram getUpdates failed: ${body.description || response.statusText}`,
        response.status || 502
      );
    }

    return body.result as TelegramUpdate[];
  }

  /**
   * Test token and get bot identity
   */
  async getMe(): Promise<TelegramBotUser> {
    const response = await fetch(`${this.baseUrl}/getMe`);
    const body = (await response.json()) as any;

    if (!response.ok || !body.ok) {
      throw new AppError(
        `Telegram getMe failed: ${body.description || response.statusText}`,
        response.status || 502
      );
    }

    return body.result as TelegramBotUser;
  }
}
