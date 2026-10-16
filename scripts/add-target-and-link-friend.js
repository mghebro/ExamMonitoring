import { getDb, examTargets, profiles, telegramLinkingTokens, telegramLinks } from "../packages/database/dist/index.js";
import { TelegramLinkingService } from "../packages/notifications/dist/index.js";
import { generateId } from "../packages/shared/dist/index.js";
import { eq } from "../packages/database/node_modules/drizzle-orm/index.js";

async function main() {
  const db = getDb();

  // 1. Check or Add Category 3 Target
  console.log("Checking exam targets...");
  const existingTargets = await db.select().from(examTargets).where(eq(examTargets.categoryCode, "3"));
  let cat3Target;
  if (existingTargets.length > 0) {
    cat3Target = existingTargets[0];
    console.log("Category 3 target already exists:", cat3Target.id);
  } else {
    const [created] = await db
      .insert(examTargets)
      .values({
        id: generateId(),
        name: "Practical Exam - Category 3 (Rustavi)",
        endpointUrl: "https://exam-booking.sa.gov.ge/practical/dates?CategoryCode=3&CenterId=7&isFirstAttempt=0",
        categoryCode: "3",
        centerId: "7",
        isFirstAttempt: false,
        pollIntervalSeconds: 30,
        isActive: true,
      })
      .returning();
    cat3Target = created;
    console.log("Created Category 3 target:", cat3Target.id);
  }

  // 2. Set your existing Telegram account to Category 4 only
  console.log("Configuring your Telegram link for Category 4 only...");
  const adminEmail = "giorgimgebrishvili2008@gmail.com";
  const [adminProfile] = await db.select().from(profiles).where(eq(profiles.email, adminEmail));
  if (adminProfile) {
    await db
      .update(telegramLinks)
      .set({ subscribedCategories: "4" })
      .where(eq(telegramLinks.userId, adminProfile.id));
    console.log("Updated your account (Giorgi) -> Category 4 only.");
  }

  // 3. Check or Create Profile for Friend
  console.log("Checking friend profile...");
  const friendEmail = "friend@exam-monitor.local";
  const existingFriend = await db.select().from(profiles).where(eq(profiles.email, friendEmail));
  let friendProfile;
  if (existingFriend.length > 0) {
    friendProfile = existingFriend[0];
    console.log("Friend profile exists:", friendProfile.id);
  } else {
    const [createdProfile] = await db
      .insert(profiles)
      .values({
        id: generateId(),
        email: friendEmail,
        role: "user",
        fullName: "Friend",
      })
      .returning();
    friendProfile = createdProfile;
    console.log("Created friend profile:", friendProfile.id);
  }

  // 4. Generate Telegram Deep Link Token for Friend (Category 3 only, TTL: 24h)
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "DrivingExamMonitor_bot";
  const linkingService = new TelegramLinkingService(botUsername);
  const tokenResult = await linkingService.generateLinkingToken(friendProfile.id, 86400, "3");

  console.log("\n========================================================");
  console.log("✅ Target Created & Category Routing Configured!");
  console.log("========================================================");
  console.log("Giorgi (@mghebrito) -> Subscribed to Category 4 only");
  console.log("Friend              -> Subscribed to Category 3 only");
  console.log("\nSend this link to your friend on Telegram:");
  console.log(tokenResult.deepLink);
  console.log("Expires at:", tokenResult.expiresAt);
  console.log("========================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  });
