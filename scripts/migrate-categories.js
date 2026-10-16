import { getDb } from "../packages/database/dist/index.js";
import { sql } from "../packages/database/node_modules/drizzle-orm/index.js";

async function main() {
  const db = getDb();
  console.log("Applying database column additions...");
  await db.execute(sql`ALTER TABLE telegram_links ADD COLUMN IF NOT EXISTS subscribed_categories text;`);
  await db.execute(sql`ALTER TABLE telegram_linking_tokens ADD COLUMN IF NOT EXISTS subscribed_categories text;`);
  console.log("Columns added successfully!");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("Migration error:", e);
  process.exit(1);
});
