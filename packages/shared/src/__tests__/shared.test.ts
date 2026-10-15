import { describe, it, expect } from "vitest";
import {
  generateSecureLinkingToken,
  hashLinkingToken,
  generateId,
  sanitizeLogString,
  sanitizeLogObject,
  AppError,
  NotFoundError,
  RateLimitError,
} from "../index.js";

describe("Shared Crypto & Helpers", () => {
  it("generates cryptographically secure, high-entropy tokens", () => {
    const token1 = generateSecureLinkingToken(32);
    const token2 = generateSecureLinkingToken(32);
    expect(token1).toHaveLength(64); // 32 bytes hex = 64 hex chars
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });

  it("produces deterministic SHA-256 token hashes", () => {
    const token = "secure-random-linking-token-12345";
    const hash1 = hashLinkingToken(token);
    const hash2 = hashLinkingToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("generates valid UUIDs", () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

describe("Shared Error Classes", () => {
  it("creates structured operational errors", () => {
    const notFound = new NotFoundError("Target not found");
    expect(notFound.statusCode).toBe(404);
    expect(notFound.code).toBe("NOT_FOUND");
    expect(notFound.isOperational).toBe(true);

    const rateLimited = new RateLimitError("Calm down", 60);
    expect(rateLimited.statusCode).toBe(429);
    expect(rateLimited.retryAfterSeconds).toBe(60);
  });
});

describe("Shared Logger Sanitization", () => {
  it("redacts bot tokens and secrets from strings", () => {
    const inputWithBotToken = "Telegram error for bot 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_12345: failed";
    const sanitized = sanitizeLogString(inputWithBotToken);
    expect(sanitized).not.toContain("123456789:ABCdefGHIjklMNOpqrSTUvwxYZ");
    expect(sanitized).toContain("[REDACTED]");
  });

  it("redacts sensitive fields in nested objects", () => {
    const sensitiveObj = {
      user: "user1",
      token: "secret-token-xyz",
      nested: {
        apiKey: "sbp_secretkey12345678901234567890",
        safeProperty: 42,
      },
    };

    const sanitized = sanitizeLogObject(sensitiveObj);
    expect(sanitized.token).toBe("[REDACTED]");
    expect(sanitized.nested.apiKey).toBe("[REDACTED]");
    expect(sanitized.nested.safeProperty).toBe(42);
  });
});
