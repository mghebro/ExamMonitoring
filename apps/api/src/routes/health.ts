import { FastifyPluginAsync } from "fastify";
import { sql } from "drizzle-orm";
import { getDb } from "@exam-monitor/database";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async (request, reply) => {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get("/ready", async (request, reply) => {
    try {
      const db = getDb();
      await db.execute(sql`SELECT 1;`);
      return {
        status: "ready",
        database: "connected",
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      reply.status(503);
      return {
        status: "unavailable",
        database: "disconnected",
        error: (err as Error)?.message || "Database check failed",
      };
    }
  });
};
