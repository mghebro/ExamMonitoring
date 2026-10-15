import { FastifyPluginAsync } from "fastify";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import {
  getDb,
  examTargets,
  monitoringState,
  availableSlots,
  availabilitySnapshots,
} from "@exam-monitor/database";
import { generateId, ValidationError, NotFoundError } from "@exam-monitor/shared";

const CreateTargetSchema = z.object({
  name: z.string().min(1),
  endpointUrl: z.string().url(),
  categoryCode: z.string().default("4"),
  centerId: z.string().default("7"),
  isFirstAttempt: z.boolean().default(false),
  pollIntervalSeconds: z.number().int().min(5).default(60),
  isActive: z.boolean().default(true),
});

export const targetRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/targets - List all targets with their current state & detected slots
   */
  fastify.get(
    "/api/v1/targets",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const db = getDb();
      const targets = await db.select().from(examTargets).orderBy(desc(examTargets.createdAt));

      const targetsWithState = await Promise.all(
        targets.map(async (target) => {
          const [state] = await db
            .select()
            .from(monitoringState)
            .where(eq(monitoringState.targetId, target.id))
            .limit(1);

          const slots = await db
            .select()
            .from(availableSlots)
            .where(eq(availableSlots.targetId, target.id));

          const recentSnapshots = await db
            .select()
            .from(availabilitySnapshots)
            .where(eq(availabilitySnapshots.targetId, target.id))
            .orderBy(desc(availabilitySnapshots.checkedAt))
            .limit(10);

          return {
            ...target,
            state: state ?? null,
            slots,
            recentSnapshots,
          };
        })
      );

      return { targets: targetsWithState };
    }
  );

  /**
   * POST /api/v1/targets - Create monitoring target (Admin only)
   */
  fastify.post(
    "/api/v1/targets",
    {
      preHandler: [fastify.authenticate, fastify.requireAdmin],
    },
    async (request, reply) => {
      const parseResult = CreateTargetSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ValidationError("Invalid target configuration", parseResult.error.format());
      }

      const db = getDb();
      const targetId = generateId();

      const [target] = await db
        .insert(examTargets)
        .values({
          id: targetId,
          ...parseResult.data,
          createdBy: request.user!.id,
        })
        .returning();

      // Initialize initial monitoring state
      await db.insert(monitoringState).values({
        targetId,
        state: "Unknown",
        lastStatus: "UNKNOWN",
      });

      reply.status(201);
      return { target };
    }
  );

  /**
   * PATCH /api/v1/targets/:id - Update target (Admin only)
   */
  fastify.patch(
    "/api/v1/targets/:id",
    {
      preHandler: [fastify.authenticate, fastify.requireAdmin],
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const db = getDb();

      const [existing] = await db.select().from(examTargets).where(eq(examTargets.id, id)).limit(1);
      if (!existing) {
        throw new NotFoundError("Target not found");
      }

      const body = request.body as Partial<typeof examTargets.$inferInsert>;
      const [updated] = await db
        .update(examTargets)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(examTargets.id, id))
        .returning();

      return { target: updated };
    }
  );
};
