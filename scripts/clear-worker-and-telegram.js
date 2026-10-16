import {
  getDb,
  workerLeases,
  notificationOutbox,
  telegramProcessedUpdates,
  monitoringState,
  telegramLinks,
} from "../packages/database/dist/index.js";
import process from "node:process";

async function main() {
  console.log("Connecting to database...");
  const db = getDb();

  // 1. Clear worker leases
  console.log("1. Clearing worker leases (releasing locks)...");
  await db.delete(workerLeases);
  console.log("   ✓ Worker leases cleared.");

  // 2. Clear notification outbox
  console.log("2. Clearing notification outbox...");
  await db.delete(notificationOutbox);
  console.log("   ✓ Notification outbox cleared.");

  // 3. Clear telegram processed updates
  console.log("3. Clearing Telegram processed updates cache...");
  await db.delete(telegramProcessedUpdates);
  console.log("   ✓ Telegram processed updates cache cleared.");

  // 4. Reset monitoring state to Running
  console.log("4. Resetting monitoring state to clean Running state...");
  await db
    .update(monitoringState)
    .set({
      state: "Running",
      consecutiveFailures: 0,
      lastError: null,
      updatedAt: new Date(),
    });
  console.log("   ✓ Monitoring state reset.");

  // 5. Display active Telegram links
  const links = await db.select().from(telegramLinks);
  console.log(`\nActive Telegram Links (${links.length}):`);
  for (const link of links) {
    console.log(
      `   - User ID: ${link.userId} | TG Chat: ${link.telegramChatId} | Subscribed Categories: ${link.subscribedCategories || "all"}`
    );
  }

  // 6. Reset Telegram Bot session (drop pending updates from Telegram servers)
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    console.log("\n5. Dropping pending updates on Telegram servers...");
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/deleteWebhook?drop_pending_updates=true`
      );
      const data = await res.json();
      console.log("   ✓ Telegram deleteWebhook & drop_pending_updates result:", data.description || data.ok);
    } catch (err) {
      console.warn("   ⚠️ Could not reach Telegram API:", err.message);
    }
  }

  console.log("\n✅ Database and Telegram state cleared successfully! Your worker can now run cleanly.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error clearing state:", err);
  process.exit(1);
});
