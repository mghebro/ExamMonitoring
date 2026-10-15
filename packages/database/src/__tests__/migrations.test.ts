import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Database Migrations & Schema Validation", () => {
  const migrationsDir = path.resolve(__dirname, "../../../../supabase/migrations");

  it("has migration files present in supabase/migrations", () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it("contains all core tables in generated Drizzle migration", () => {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
    const ddlContent = fs.readFileSync(path.join(migrationsDir, files[0]), "utf-8");

    const requiredTables = [
      "profiles",
      "invitations",
      "exam_targets",
      "monitoring_state",
      "availability_snapshots",
      "available_slots",
      "monitoring_events",
      "telegram_links",
      "telegram_linking_tokens",
      "telegram_processed_updates",
      "notification_preferences",
      "notification_outbox",
      "polling_benchmarks",
      "worker_leases",
    ];

    for (const table of requiredTables) {
      expect(ddlContent).toContain(`CREATE TABLE "${table}"`);
    }
  });

  it("contains Row Level Security and security functions in RLS migration", () => {
    const rlsFile = path.join(migrationsDir, "0001_rls_and_security_policies.sql");
    expect(fs.existsSync(rlsFile)).toBe(true);
    const rlsContent = fs.readFileSync(rlsFile, "utf-8");

    expect(rlsContent).toContain("FUNCTION public.is_admin()");
    expect(rlsContent).toContain("FUNCTION public.handle_new_user()");
    expect(rlsContent).toContain("ENABLE ROW LEVEL SECURITY");
    expect(rlsContent).toContain("CREATE POLICY \"profiles_select_own_or_admin\"");
    expect(rlsContent).toContain("CREATE POLICY \"invitations_admin_only\"");
    expect(rlsContent).toContain("CREATE POLICY \"worker_leases_no_public\"");
    expect(rlsContent).toContain("SET search_path = public, auth, pg_temp");
  });
});
