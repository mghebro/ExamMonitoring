# Telegram Bot Setup & Secure Account Pairing

This guide details the complete process of creating, configuring, and pairing your Telegram bot with Exam Monitor.

---

## 1. Creating the Telegram Bot via @BotFather

Telegram requires bots to be created through the official `@BotFather` account.

1. Open Telegram on your phone or desktop and search for `@BotFather` (verified badge).
2. Tap **Start** or send `/start`.
3. Send the command:
   ```text
   /newbot
   ```
4. Choose a display name for your bot, such as:
   ```text
   Exam Availability Monitor
   ```
5. Choose a unique username ending in `bot`, for example:
   ```text
   MyPracticalExamMonitorBot
   ```
6. BotFather will output a confirmation message containing your secret HTTP API access token:
   ```text
   Use this token to access the HTTP API:
   123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_sample
   ```
7. Configure the bot description and command list via `/setcommands`:
   ```text
   status - Current monitoring and connection status
   subscribe - Enable notifications for this account
   unsubscribe - Temporarily pause notifications
   test - Send a test alert message
   settings - View notification preferences
   help - How to use this bot
   ```
8. **Security Note**: Store this token exclusively in backend server environment variables (`TELEGRAM_BOT_TOKEN`). Never commit it to GitHub, paste it into screenshots, or expose it in frontend client configuration.

---

## 2. Why Direct Messaging Requires User Initiation

In accordance with Telegram's anti-spam security architecture, **a bot cannot unilaterally initiate a conversation with an arbitrary user by phone number or username**.

Each user must initiate the first conversation with the bot by opening the chat and pressing **Start**.

Exam Monitor leverages this requirement to implement cryptographic deep-link account pairing.

---

## 3. Cryptographic Deep-Link Pairing Flow

Exam Monitor never asks users to locate, copy, and paste raw numeric Telegram IDs. Instead:

1. The authenticated user logs in to the dashboard and selects **"Connect Telegram"**.
2. The backend (`POST /api/v1/telegram/link-token`):
   - Generates a cryptographically random, 32-byte high-entropy token.
   - Calculates the SHA-256 hash of the token: `crypto.createHash("sha256").update(token).digest("hex")`.
   - Stores the hash in the `telegram_linking_tokens` database table with a 10-minute expiry (`expires_at = now() + interval '10 minutes'`).
   - Plaintext tokens are **never** stored in database tables or logs.
3. The dashboard renders a one-click deep link:
   ```text
   https://t.me/YourBotUsername?start=<RawLinkingToken>
   ```
4. When the user taps the button, Telegram opens the private chat and sends:
   ```text
   /start <RawLinkingToken>
   ```
5. The bot receives the command, hashes the token parameter, and queries `telegram_linking_tokens`:
   - Validates existence, expiry, and single-use status (`used_at IS NULL`).
   - Immediately records `used_at = now()`, preventing reuse.
   - Upserts the Telegram numeric User ID and Chat ID into `telegram_links` associated with the authenticated profile.
6. The bot sends a confirmation reply:
   ```text
   🎉 Welcome to Exam Monitor, Alex!
   ✅ Your Telegram account has been securely linked to your dashboard.
   🔔 Notifications are now ACTIVE.
   ```
7. The dashboard updates within seconds to reflect the **"Connected"** status.

---

## 4. Transport Modes: Webhook vs. Long Polling

Exam Monitor supports two transport architectures configured via `TELEGRAM_MODE`:

| Mode | Environment | Description |
|---|---|---|
| `webhook` | Production (Render/Railway/Vercel) | Telegram sends HTTPS POST requests directly to `/api/v1/telegram/webhook`. Headers are verified using `X-Telegram-Bot-Api-Secret-Token`. Highly efficient, zero polling overhead. |
| `polling` | Local Development | Dedicated background consumer runs `getUpdates` with long-polling timeouts. Convenient for developing on local machines without public HTTPS tunnels. |

### Registering the Production Webhook

To register the webhook with Telegram, send an HTTP request or use the API setup tool:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.your-domain.com/api/v1/telegram/webhook",
    "secret_token": "YOUR_CRYPTOGRAPHICALLY_RANDOM_WEBHOOK_SECRET",
    "allowed_updates": ["message"]
  }'
```

Telegram verifies that the endpoint responds with HTTP 200 within a few seconds.

---

## 5. Bot Token Rotation & Revocation

If your bot token is accidentally exposed:

1. Open Telegram and message `@BotFather`.
2. Send `/revoke` and select your bot.
3. BotFather immediately invalidates the old token and generates a new one.
4. Update the `TELEGRAM_BOT_TOKEN` environment variable in your hosting provider's secret dashboard.
5. Restart the API and Worker processes.
6. Existing user account links in `telegram_links` remain completely intact because they are mapped by stable numeric user IDs, not the bot token.
