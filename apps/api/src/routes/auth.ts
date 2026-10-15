import { FastifyPluginAsync } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  getDb,
  profiles,
  telegramLinks,
  notificationPreferences,
  invitations,
} from "@exam-monitor/database";
import {
  generateSecureLinkingToken,
  hashLinkingToken,
  generateId,
  ValidationError,
  NotFoundError,
  UserRole,
} from "@exam-monitor/shared";

const CreateInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "user"]).default("user"),
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/v1/auth/me - Current user profile and connection status
   */
  fastify.get(
    "/api/v1/auth/me",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const user = request.user!;
      const db = getDb();

      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, user.id))
        .limit(1);

      const [telegramLink] = await db
        .select()
        .from(telegramLinks)
        .where(eq(telegramLinks.userId, user.id))
        .limit(1);

      const [pref] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, user.id))
        .limit(1);

      return {
        user: {
          id: user.id,
          email: user.email,
          role: profile?.role || user.role,
          fullName: profile?.fullName ?? null,
          createdAt: profile?.createdAt ?? null,
        },
        telegram: {
          isLinked: !!telegramLink,
          telegramUserId: telegramLink?.telegramUserId ?? null,
          telegramUsername: telegramLink?.telegramUsername ?? null,
          isSubscribed: telegramLink?.isSubscribed ?? false,
          linkedAt: telegramLink?.linkedAt ?? null,
        },
        preferences: {
          notifyOnAvailable: pref?.notifyOnAvailable ?? true,
          quietHoursStart: pref?.quietHoursStart ?? null,
          quietHoursEnd: pref?.quietHoursEnd ?? null,
        },
      };
    }
  );

  /**
   * POST /api/v1/invitations - Create invitation for new user (Admin only)
   */
  fastify.post(
    "/api/v1/invitations",
    {
      preHandler: [fastify.authenticate, fastify.requireAdmin],
    },
    async (request, reply) => {
      const parseResult = CreateInvitationSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ValidationError("Invalid invitation payload", parseResult.error.format());
      }

      const { email, role } = parseResult.data;
      const db = getDb();

      // Check if user already exists
      const [existingUser] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.email, email))
        .limit(1);

      if (existingUser) {
        throw new ValidationError(`A user with email '${email}' already exists.`);
      }

      // Generate cryptographically secure invite token (48h expiry)
      const rawInviteToken = generateSecureLinkingToken(24);
      const tokenHash = hashLinkingToken(rawInviteToken);
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

      const [created] = await db
        .insert(invitations)
        .values({
          id: generateId(),
          email,
          role: role as UserRole,
          invitedBy: request.user!.id,
          tokenHash,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [invitations.email],
          set: {
            role: role as UserRole,
            tokenHash,
            expiresAt,
            acceptedAt: null,
          },
        })
        .returning();

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const inviteUrl = `${appUrl}/register?token=${rawInviteToken}&email=${encodeURIComponent(email)}`;

      reply.status(201);
      return {
        id: created.id,
        email: created.email,
        role: created.role,
        expiresAt: created.expiresAt,
        inviteUrl,
      };
    }
  );

  /**
   * GET /api/v1/invitations - List all pending invitations (Admin only)
   */
  fastify.get(
    "/api/v1/invitations",
    {
      preHandler: [fastify.authenticate, fastify.requireAdmin],
    },
    async (request, reply) => {
      const db = getDb();
      const list = await db
        .select({
          id: invitations.id,
          email: invitations.email,
          role: invitations.role,
          expiresAt: invitations.expiresAt,
          acceptedAt: invitations.acceptedAt,
          createdAt: invitations.createdAt,
        })
        .from(invitations)
        .orderBy(invitations.createdAt);

      return { invitations: list };
    }
  );
};
