import Fastify, { FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import { AppError, logger } from "@exam-monitor/shared";
import { authPlugin } from "./plugins/auth.js";
import { swaggerPlugin } from "./plugins/swagger.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { telegramRoutes } from "./routes/telegram.js";
import { telegramWebhookRoutes } from "./routes/telegram-webhook.js";
import { notificationRoutes } from "./routes/notifications.js";
import { targetRoutes } from "./routes/targets.js";
import { benchmarkRoutes } from "./routes/benchmarks.js";

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
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "*"],
      },
    } : false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  // CORS configuration
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, server-to-server, mobile)
      if (!origin) return cb(null, true);

      // Match localhost, 127.0.0.1, LAN private IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x) on any port
      const isLocalOrLan =
        /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(
          origin
        );

      const isConfiguredOrigin =
        configuredAppUrl && origin.startsWith(configuredAppUrl);

      const isVercel = origin.endsWith(".vercel.app");

      if (isLocalOrLan || isConfiguredOrigin || isVercel) {
        return cb(null, true);
      }

      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
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

  // Telegram Linking Routes
  await app.register(telegramRoutes);

  // Telegram Webhook Receiver
  await app.register(telegramWebhookRoutes);

  // Notification History & Test Alert Routes
  await app.register(notificationRoutes);

  // Targets & Monitoring Configuration Routes
  await app.register(targetRoutes);

  // Benchmarking & Simulation Routes
  await app.register(benchmarkRoutes);

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
