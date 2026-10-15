export type LogLevel = "debug" | "info" | "warn" | "error";

const SENSITIVE_PATTERNS = [
  /\b\d{8,11}:[a-zA-Z0-9_-]{25,45}\b/gi, // Telegram bot tokens
  /(?:sbp_[a-zA-Z0-9_]{20,})/gi, // Supabase personal tokens
  /(?:eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,})/gi, // JWT
  /(?:token|secret|password|key|bearer|authorization)[=:\s]+["']?([a-zA-Z0-9_\-.:]{8,})["']?/gi,
];

export function sanitizeLogString(input: string): string {
  let sanitized = input;
  // Apply bot token pattern directly
  sanitized = sanitized.replace(/\b\d{8,11}:[a-zA-Z0-9_-]{25,45}\b/gi, "[REDACTED]");
  // Apply Supabase token
  sanitized = sanitized.replace(/(?:sbp_[a-zA-Z0-9_]{20,})/gi, "[REDACTED]");
  // Apply JWT pattern
  sanitized = sanitized.replace(/(?:eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,})/gi, "[REDACTED]");
  // Apply token/secret key/value
  sanitized = sanitized.replace(/(token|secret|password|key|bearer|authorization)([=:\s]+)(["']?)([a-zA-Z0-9_\-.:]{8,})\3/gi, "$1$2$3[REDACTED]$3");
  return sanitized;
}

export function sanitizeLogObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    return sanitizeLogString(obj) as unknown as T;
  }
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeLogObject(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("token") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("password") ||
      lowerKey.includes("key") ||
      lowerKey.includes("cookie") ||
      lowerKey.includes("authorization")
    ) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      result[key] = sanitizeLogObject(value);
    } else if (typeof value === "string") {
      result[key] = sanitizeLogString(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

export class Logger {
  constructor(private context: string = "App") {}

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const sanitizedMsg = sanitizeLogString(message);
    const sanitizedMeta = meta ? sanitizeLogObject(meta) : undefined;

    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message: sanitizedMsg,
      ...(sanitizedMeta ? { meta: sanitizedMeta } : {}),
    };

    if (level === "error") {
      console.error(JSON.stringify(logEntry));
    } else if (level === "warn") {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production") {
      this.log("debug", message, meta);
    }
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.log("error", message, meta);
  }

  child(subContext: string): Logger {
    return new Logger(`${this.context}:${subContext}`);
  }
}

export const logger = new Logger("ExamMonitor");
