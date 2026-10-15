import { FastifyPluginAsync } from "fastify";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { getDb, pollingBenchmarks } from "@exam-monitor/database";
import { PollingBenchmarkRunner } from "@exam-monitor/exam-provider";
import { ValidationError } from "@exam-monitor/shared";

const RunBenchmarkSchema = z.object({
  targetEndpoint: z.string().url(),
  configuredIntervalSeconds: z.number().int().min(1).max(300).default(60),
  maxRequests: z.number().int().min(1).max(50).default(10),
  maxDurationSeconds: z.number().int().min(5).max(300).default(60),
  isSimulation: z.boolean().default(false),
});

export const benchmarkRoutes: FastifyPluginAsync = async (fastify) => {
  const runner = new PollingBenchmarkRunner();

  /**
   * GET /api/v1/benchmarks - Get recent benchmark history
   */
  fastify.get(
    "/api/v1/benchmarks",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const db = getDb();
      const list = await db
        .select()
        .from(pollingBenchmarks)
        .orderBy(desc(pollingBenchmarks.executedAt))
        .limit(20);

      return { benchmarks: list };
    }
  );

  /**
   * POST /api/v1/benchmarks/run - Run benchmark on demand (Admin only)
   */
  fastify.post(
    "/api/v1/benchmarks/run",
    {
      preHandler: [fastify.authenticate, fastify.requireAdmin],
    },
    async (request, reply) => {
      const parseResult = RunBenchmarkSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ValidationError("Invalid benchmark parameters", parseResult.error.format());
      }

      const params = parseResult.data;
      const benchmark = await runner.runBenchmark({
        ...params,
        allowedHosts: (process.env.ALLOWED_EXAM_HOSTS || "").split(","),
        allowHttpForTesting: process.env.NODE_ENV === "test",
      });

      // Persist result in Supabase
      const db = getDb();
      await db.insert(pollingBenchmarks).values({
        id: benchmark.id,
        targetEndpoint: benchmark.targetEndpoint,
        configuredIntervalSeconds: benchmark.configuredIntervalSeconds,
        actualIntervalMs: benchmark.actualIntervalMs,
        totalRequests: benchmark.totalRequests,
        successfulRequests: benchmark.successfulRequests,
        failedRequests: benchmark.failedRequests,
        rateLimitCount: benchmark.rateLimitCount,
        medianLatencyMs: benchmark.medianLatencyMs,
        p95LatencyMs: benchmark.p95LatencyMs,
        httpStatusDistribution: benchmark.httpStatusDistribution,
        estimatedHourlyRequests: benchmark.estimatedHourlyRequests,
        estimatedDailyRequests: benchmark.estimatedDailyRequests,
        recommendedIntervalSeconds: benchmark.recommendedIntervalSeconds,
        isSimulation: benchmark.isSimulation,
        executedAt: new Date(benchmark.executedAt),
      });

      return { benchmark };
    }
  );
};
