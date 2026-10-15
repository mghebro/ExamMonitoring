import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { eq } from "drizzle-orm";
import { getSupabaseClient, getDb, profiles } from "@exam-monitor/database";
import { UnauthorizedError, ForbiddenError, UserRole } from "@exam-monitor/shared";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      role: UserRole;
    };
  }
}

const authPluginAsync: FastifyPluginAsync = async (fastify) => {
  const supabase = getSupabaseClient();

  fastify.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new UnauthorizedError("Missing or invalid Bearer token");
      }

      const token = authHeader.substring(7).trim();

      try {
        // Verify session / JWT cryptographically with Supabase Auth
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
          throw new UnauthorizedError(error?.message || "Invalid or expired token");
        }

        // Fetch user profile from database to determine role
        const db = getDb();
        const [profile] = await db
          .select()
          .from(profiles)
          .where(eq(profiles.id, user.id))
          .limit(1);

        const role = (profile?.role as UserRole) || "user";

        request.user = {
          id: user.id,
          email: user.email || profile?.email || "",
          role,
        };
      } catch (err: unknown) {
        if (err instanceof UnauthorizedError) throw err;
        throw new UnauthorizedError("Authentication failed");
      }
    }
  );

  fastify.decorate(
    "requireAdmin",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user || request.user.role !== "admin") {
        throw new ForbiddenError("Administrator access required for this action");
      }
    }
  );
};

export const authPlugin = fp(authPluginAsync, { name: "authPlugin" });
