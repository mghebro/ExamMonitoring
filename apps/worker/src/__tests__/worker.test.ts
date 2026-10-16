import { describe, it, expect } from "vitest";
import { computeBackoffDelay } from "../backoff.js";
import { LeaseManager } from "../lease.js";

describe("Worker Backoff & Jitter", () => {
  it("returns base interval when consecutive failures is 0", () => {
    const delay = computeBackoffDelay({
      consecutiveFailures: 0,
      baseIntervalSeconds: 60,
      maxBackoffSeconds: 300,
    });
    expect(delay).toBe(60);
  });

  it("increases delay exponentially on consecutive failures up to max", () => {
    const delay1 = computeBackoffDelay({
      consecutiveFailures: 1,
      baseIntervalSeconds: 30,
      maxBackoffSeconds: 300,
      jitterMaxSeconds: 0,
    });
    const delay3 = computeBackoffDelay({
      consecutiveFailures: 3,
      baseIntervalSeconds: 30,
      maxBackoffSeconds: 300,
      jitterMaxSeconds: 0,
    });
    const delay10 = computeBackoffDelay({
      consecutiveFailures: 10,
      baseIntervalSeconds: 30,
      maxBackoffSeconds: 300,
      jitterMaxSeconds: 0,
    });

    expect(delay1).toBe(38); // 30 * 1.25
    expect(delay3).toBeGreaterThan(delay1);
    expect(delay10).toBe(114); // 30 * 1.25^6 = 114.4 -> 114, bounded by maxBackoffSeconds
  });

  it("honors Retry-After header if returned by upstream server", () => {
    const delay = computeBackoffDelay({
      consecutiveFailures: 5,
      baseIntervalSeconds: 30,
      maxBackoffSeconds: 300,
      retryAfterSeconds: 120,
    });
    expect(delay).toBe(120);
  });
});

describe("Worker Lease Coordination", () => {
  it("allows single worker to acquire lease and rejects competing worker", async () => {
    const manager = new LeaseManager();
    const targetId = "target-uuid-1234";

    const acquiredByWorker1 = await manager.acquireOrRenewLease(targetId, "worker-1", 60);
    expect(acquiredByWorker1).toBe(true);

    const acquiredByWorker2 = await manager.acquireOrRenewLease(targetId, "worker-2", 60);
    expect(acquiredByWorker2).toBe(false);

    // Worker 1 can renew its own lease
    const renewedByWorker1 = await manager.acquireOrRenewLease(targetId, "worker-1", 60);
    expect(renewedByWorker1).toBe(true);

    // After release, Worker 2 can acquire
    await manager.releaseLease(targetId, "worker-1");
    const acquiredAfterRelease = await manager.acquireOrRenewLease(targetId, "worker-2", 60);
    expect(acquiredAfterRelease).toBe(true);
  });
});
