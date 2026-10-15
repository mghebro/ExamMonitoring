import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

describe("API Health & Authentication Security", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Provide test environment variables
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "test-anon-key-long-enough-for-validation";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key-long-enough";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres";

    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns 200 OK and uptime info", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
  });

  it("GET /api/v1/auth/me rejects requests without Bearer token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.payload);
    expect(body.code || body.error?.code).toBe("UNAUTHORIZED");
    expect(body.message || body.error?.message).toContain("Missing or invalid Bearer token");
  });

  it("POST /api/v1/invitations rejects unauthenticated requests", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/invitations",
      payload: {
        email: "friend@example.com",
        role: "user",
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.payload);
    expect(body.code || body.error?.code).toBe("UNAUTHORIZED");
  });
});
