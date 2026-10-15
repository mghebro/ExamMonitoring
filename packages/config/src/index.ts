import { z } from "zod";

/**
 * Common application environment schema
 */
export const CommonEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default("0.0.0.0"),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  API_BASE_URL: z.string().url().default("http://localhost:3001"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

/**
 * Supabase configuration schema
 */
export const SupabaseEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  DATABASE_URL: z.string().min(10),
  DATABASE_DIRECT_URL: z.string().min(10).optional(),
});

/**
 * Monitoring and Provider configuration schema
 */
export const MonitorEnvSchema = z.object({
  EXAM_API_ENDPOINT: z.string().url().refine(
    (url) => url.startsWith("https://") || process.env.NODE_ENV === "test",
    { message: "EXAM_API_ENDPOINT must be an HTTPS URL in production" }
  ),
  ALLOWED_EXAM_HOSTS: z
    .string()
    .default("exam-booking.sa.gov.ge,localhost,127.0.0.1")
    .transform((val) => val.split(",").map((s) => s.trim().toLowerCase())),
  POLL_INTERVAL_SECONDS: z.coerce.number().int().min(5).default(60),
  MIN_POLL_INTERVAL_SECONDS: z.coerce.number().int().min(5).default(30),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  MAX_BACKOFF_SECONDS: z.coerce.number().int().min(10).max(3600).default(300),
  WORKER_LEASE_DURATION_SECONDS: z.coerce.number().int().min(10).max(300).default(30),
});

/**
 * Base Telegram configuration schema (before refinement)
 */
export const TelegramBaseSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(10),
  TELEGRAM_BOT_USERNAME: z.string().min(3).optional(),
  TELEGRAM_MODE: z.enum(["webhook", "polling"]).default("polling"),
  TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
  TELEGRAM_LINKING_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(600),
});

export const TelegramEnvSchema = TelegramBaseSchema.refine(
  (data) => {
    if (data.TELEGRAM_MODE === "webhook") {
      return !!data.TELEGRAM_WEBHOOK_URL && !!data.TELEGRAM_WEBHOOK_SECRET;
    }
    return true;
  },
  {
    message: "TELEGRAM_WEBHOOK_URL and TELEGRAM_WEBHOOK_SECRET are required when TELEGRAM_MODE is 'webhook'",
    path: ["TELEGRAM_WEBHOOK_URL"],
  }
);

/**
 * Benchmark configuration schema
 */
export const BenchmarkEnvSchema = z.object({
  BENCHMARK_MAX_DURATION_SECONDS: z.coerce.number().int().min(10).max(600).default(180),
  BENCHMARK_MAX_REQUESTS: z.coerce.number().int().min(1).max(200).default(30),
});

/**
 * Combined API environment schema
 */
const CombinedBackendBase = CommonEnvSchema
  .merge(SupabaseEnvSchema)
  .merge(MonitorEnvSchema)
  .merge(TelegramBaseSchema)
  .merge(BenchmarkEnvSchema);

export const ApiConfigSchema = CombinedBackendBase.refine(
  (data) => {
    if (data.TELEGRAM_MODE === "webhook") {
      return !!data.TELEGRAM_WEBHOOK_URL && !!data.TELEGRAM_WEBHOOK_SECRET;
    }
    return true;
  },
  {
    message: "TELEGRAM_WEBHOOK_URL and TELEGRAM_WEBHOOK_SECRET are required when TELEGRAM_MODE is 'webhook'",
    path: ["TELEGRAM_WEBHOOK_URL"],
  }
);

export type ApiConfig = z.infer<typeof ApiConfigSchema>;

export const WorkerConfigSchema = CombinedBackendBase;
export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;

/**
 * Public Web frontend environment schema
 */
export const WebConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  API_BASE_URL: z.string().url().default("http://localhost:3001"),
});

export type WebConfig = z.infer<typeof WebConfigSchema>;

/**
 * Parse and validate configuration with detailed error formatting
 */
export function validateConfig<T extends z.ZodTypeAny>(schema: T, env: Record<string, unknown> = process.env): z.infer<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map((err) => `  - ${err.path.join(".")}: ${err.message}`)
      .join("\n");
    throw new Error(`Configuration validation failed:\n${errorDetails}`);
  }
  return result.data;
}
