export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, code = "INTERNAL_SERVER_ERROR", isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class ValidationError extends AppError {
  public readonly details?: unknown;

  constructor(message = "Validation failed", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR");
    this.details = details;
  }
}

export class ProviderError extends AppError {
  public readonly httpStatus?: number;

  constructor(message: string, httpStatus?: number) {
    super(message, 502, "PROVIDER_ERROR");
    this.httpStatus = httpStatus;
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfterSeconds?: number;

  constructor(message = "Too many requests", retryAfterSeconds?: number) {
    super(message, 429, "RATE_LIMITED");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
