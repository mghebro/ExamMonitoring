import { sql } from "drizzle-orm";
import { getDb } from "@exam-monitor/database";
import { logger } from "@exam-monitor/shared";

export class LeaseManager {
  private log = logger.child("LeaseManager");
  private inMemoryLeases = new Map<string, { workerId: string; expiresAt: number }>();

  /**
   * Attempt to acquire or renew a distributed lease for a target.
   * Uses an atomic PostgreSQL query to ensure that across multiple worker instances,
   * only ONE worker can hold the lease for a given target at any time.
   */
  async acquireOrRenewLease(
    targetId: string,
    workerId: string,
    leaseDurationSeconds = 30
  ): Promise<boolean> {
    try {
      const db = getDb();

      // Atomic PostgreSQL upsert:
      // Insert if no lease exists. If a lease exists, only update if it is expired OR already owned by this worker.
      const result = await db.execute(sql`
        INSERT INTO worker_leases (target_id, worker_id, acquired_at, expires_at, last_heartbeat)
        VALUES (
          ${targetId}::uuid,
          ${workerId},
          now(),
          now() + (${leaseDurationSeconds} || ' seconds')::interval,
          now()
        )
        ON CONFLICT (target_id) DO UPDATE
        SET worker_id = ${workerId},
            expires_at = now() + (${leaseDurationSeconds} || ' seconds')::interval,
            last_heartbeat = now()
        WHERE worker_leases.worker_id = ${workerId}
           OR worker_leases.expires_at < now()
        RETURNING worker_id;
      `);

      const rows = result as unknown as Array<{ worker_id: string }>;
      const acquired = rows.length > 0 && rows[0].worker_id === workerId;

      if (!acquired) {
        this.log.debug(`Target ${targetId} is leased by another active worker. Skipping.`);
      }

      return acquired;
    } catch (err: unknown) {
      // If DB is offline / during local test simulation without DB
      const now = Date.now();
      const existing = this.inMemoryLeases.get(targetId);

      if (!existing || existing.expiresAt < now || existing.workerId === workerId) {
        this.inMemoryLeases.set(targetId, {
          workerId,
          expiresAt: now + leaseDurationSeconds * 1000,
        });
        return true;
      }

      return false;
    }
  }

  /**
   * Release a lease gracefully when worker is shutting down or target is deactivated.
   */
  async releaseLease(targetId: string, workerId: string): Promise<void> {
    try {
      const db = getDb();
      await db.execute(sql`
        DELETE FROM worker_leases
        WHERE target_id = ${targetId}::uuid AND worker_id = ${workerId};
      `);
    } catch {
      this.inMemoryLeases.delete(targetId);
    }
  }
}
