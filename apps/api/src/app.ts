import Fastify, { FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import { AppError, logger } from "@exam-monitor/shared";
import { authPlugin } from "./plugins/auth.js";
import { swaggerPlugin } from "./plugins/swagger.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
    requireAdmin: (request: any, reply: any) => Promise<void>;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
  });

  // Security Headers
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: process.env.NODE_ENV === "production",
  });

  // CORS configuration
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  await app.register(fastifyCors, {
    origin: [allowedOrigin, "http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Rate Limiting (100 requests per minute per IP)
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  // OpenAPI Swagger Documentation
  await app.register(swaggerPlugin);

  // Authentication Plugin
  await app.register(authPlugin);

  // Health and Readiness Check Routes
  await app.register(healthRoutes);

  // Auth & Invitations Routes
  await app.register(authRoutes);

  // Global Error Handler
  app.setErrorHandler((error: any, request, reply) => {
    const statusCode = error.statusCode || (error instanceof AppError ? error.statusCode : 500);
    const code = error.code || (statusCode === 401 ? "UNAUTHORIZED" : statusCode === 403 ? "FORBIDDEN" : statusCode === 404 ? "NOT_FOUND" : "APP_ERROR");

    if (error instanceof AppError || error.isOperational || statusCode < 500) {
      reply.status(statusCode).send({
        error: {
          code,
          message: error.message || "An error occurred",
          ...(error.details ? { details: error.details } : {}),
        },
      });
      return;
    }

    logger.error("Unhandled API error", {
      url: request.url,
      method: request.method,
      error: error?.message || String(error),
    });

    reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected internal server error occurred.",
      },
    });
  });

  return app;
}
