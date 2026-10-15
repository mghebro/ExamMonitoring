import { describe, it, expect } from "vitest";
import { validateConfig, ApiConfigSchema, WorkerConfigSchema, WebConfigSchema } from "../index.js";

describe("Config Validation", () => {
  const validBackendEnv = {
    NODE_ENV: "test",
    PORT: "3001",
    HOST: "0.0.0.0",
    API_BASE_URL: "http://localhost:3001",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    SUPABASE_URL: "https://test-project.supabase.co",
    SUPABASE_ANON_KEY: "test-anon-key-with-sufficient-length",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key-with-sufficient-length",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:54322/postgres",
    EXAM_API_ENDPOINT: "https://exam-booking.sa.gov.ge/practical/dates?CategoryCode=4&CenterId=7&isFirstAttempt=0",
    ALLOWED_EXAM_HOSTS: "exam-booking.sa.gov.ge,localhost",
    POLL_INTERVAL_SECONDS: "60",
    MIN_POLL_INTERVAL_SECONDS: "30",
    REQUEST_TIMEOUT_MS: "10000",
    MAX_BACKOFF_SECONDS: "300",
    WORKER_LEASE_DURATION_SECONDS: "30",
    TELEGRAM_BOT_TOKEN: "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ",
    TELEGRAM_MODE: "polling",
    TELEGRAM_LINKING_TOKEN_TTL_SECONDS: "600",
  };

  it("successfully parses valid API configuration", () => {
    const config = validateConfig(ApiConfigSchema, validBackendEnv);
    expect(config.PORT).toBe(3001);
    expect(config.POLL_INTERVAL_SECONDS).toBe(60);
    expect(config.ALLOWED_EXAM_HOSTS).toContain("exam-booking.sa.gov.ge");
    expect(config.TELEGRAM_MODE).toBe("polling");
  });

  it("successfully parses valid Worker configuration", () => {
    const config = validateConfig(WorkerConfigSchema, validBackendEnv);
    expect(config.WORKER_LEASE_DURATION_SECONDS).toBe(30);
  });

  it("enforces webhook url and secret when TELEGRAM_MODE is webhook", () => {
    const webhookEnv = {
      ...validBackendEnv,
      TELEGRAM_MODE: "webhook",
    };

    expect(() => validateConfig(ApiConfigSchema, webhookEnv)).toThrow(
      /TELEGRAM_WEBHOOK_URL and TELEGRAM_WEBHOOK_SECRET are required/
    );

    const validWebhookEnv = {
      ...webhookEnv,
      TELEGRAM_WEBHOOK_URL: "https://api.example.com/api/v1/telegram/webhook",
      TELEGRAM_WEBHOOK_SECRET: "cryptographically-secure-random-secret-key-32chars",
    };

    const config = validateConfig(ApiConfigSchema, validWebhookEnv);
    expect(config.TELEGRAM_MODE).toBe("webhook");
    expect(config.TELEGRAM_WEBHOOK_URL).toBe("https://api.example.com/api/v1/telegram/webhook");
  });

  it("validates web public configuration", () => {
    const webEnv = {
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://monitor.example.com",
      NEXT_PUBLIC_SUPABASE_URL: "https://test-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key-long-enough",
      API_BASE_URL: "https://api.example.com",
    };

    const config = validateConfig(WebConfigSchema, webEnv);
    expect(config.NEXT_PUBLIC_APP_URL).toBe("https://monitor.example.com");
  });

  it("throws clear errors on missing required keys", () => {
    expect(() => validateConfig(ApiConfigSchema, {})).toThrow(/Configuration validation failed/);
  });
});
