import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { logger } from "@exam-monitor/shared";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(customConnectionString?: string): Promise<void> {
  const connectionString =
    customConnectionString ||
    process.env.DATABASE_DIRECT_URL ||
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Cannot run migrations: DATABASE_URL is not set.");
  }

  const sql = postgres(connectionString, { max: 1 });

  try {
    logger.info("Starting database migration runner...");

    // Create migration tracking table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS public._migrations_history (
        id serial PRIMARY KEY,
        name text NOT NULL UNIQUE,
        applied_at timestamp with time zone DEFAULT now() NOT NULL
      );
    `;

    const migrationsDir = path.resolve(__dirname, "../../../supabase/migrations");
    if (!fs.existsSync(migrationsDir)) {
      throw new Error(`Migrations directory not found at: ${migrationsDir}`);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const alreadyApplied = await sql`
        SELECT 1 FROM public._migrations_history WHERE name = ${file} LIMIT 1;
      `;

      if (alreadyApplied.length > 0) {
        logger.info(`Migration ${file} already applied, skipping.`);
        continue;
      }

      logger.info(`Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, "utf-8");

      // Split statements on Drizzle statement-breakpoint if present, or run full content
      const statements = sqlContent.split("--> statement-breakpoint");
      await sql.begin(async (tx) => {
        for (const statement of statements) {
          const trimmed = statement.trim();
          if (trimmed.length > 0) {
            await tx.unsafe(trimmed);
          }
        }
        await tx`
          INSERT INTO public._migrations_history (name) VALUES (${file});
        `;
      });

      logger.info(`Successfully applied migration: ${file}`);
    }

    logger.info("All database migrations completed successfully.");
  } catch (error) {
    logger.error("Migration failed:", { error: String(error) });
    throw error;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith("migrate.ts")) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
