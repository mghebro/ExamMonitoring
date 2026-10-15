import crypto from "node:crypto";

/**
 * Generate a cryptographically secure, URL-safe single-use linking token.
 * Default is 32 bytes of entropy encoded as hex/base64url.
 */
export function generateSecureLinkingToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Compute SHA-256 hash of a linking token for safe database persistence.
 * Prevents plaintext token leakage even if database logs or read replicas are inspected.
 */
export function hashLinkingToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a cryptographically secure random ID / UUID.
 */
export function generateId(): string {
  return crypto.randomUUID();
}
