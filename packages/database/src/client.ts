import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as schema from "./schema.js";

let client: postgres.Sql | null = null;
let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

/**
 * Get or initialize the Drizzle ORM database client.
 * Connects via Supabase connection pooler or direct connection.
 */
export function getDb(connectionString?: string): PostgresJsDatabase<typeof schema> {
  if (dbInstance) {
    return dbInstance;
  }

  const connStr =
    connectionString ||
    process.env.DATABASE_URL ||
    process.env.DATABASE_DIRECT_URL;

  if (!connStr) {
    throw new Error("DATABASE_URL or connection string must be defined to initialize database client");
  }

  // Use max 10 connections for backend API/worker, disable prepare for pgbouncer transaction mode compatibility
  client = postgres(connStr, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // Required for Supabase PgBouncer transaction mode
  });

  dbInstance = drizzle(client, { schema });
  return dbInstance;
}

/**
 * Close database connection pool gracefully during shutdown.
 */
export async function closeDatabaseConnection(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
    client = null;
    dbInstance = null;
  }
}

/**
 * Create a Supabase JavaScript client for Auth or standard operations.
 */
export function getSupabaseClient(
  url?: string,
  key?: string
): SupabaseClient {
  const supabaseUrl = url || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    key ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase URL and API Key must be defined to create Supabase client");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
