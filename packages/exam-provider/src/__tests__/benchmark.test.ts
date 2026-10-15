import { describe, it, expect } from "vitest";
import { PollingBenchmarkRunner, MockSimulationProvider } from "../index.js";

describe("Simulation Provider & Benchmark Engine", () => {
  it("executes mock simulation correctly with custom scenarios", async () => {
    const mockProvider = new MockSimulationProvider({
      latencyMinMs: 10,
      latencyMaxMs: 20,
      slotsSequence: [
        [{ bookingDate: "14-11-2026", bookingDateStatus: 1 }],
        [],
      ],
    });

    const res1 = await mockProvider.fetchAvailability("https://example.com/api");
    expect(res1.status).toBe("AVAILABLE");
    expect(res1.slotCount).toBe(1);

    const res2 = await mockProvider.fetchAvailability("https://example.com/api");
    expect(res2.status).toBe("UNAVAILABLE");
    expect(res2.slotCount).toBe(0);
  });

  it("simulates rate limits and error responses", async () => {
    const mockProvider = new MockSimulationProvider({
      rateLimitRate: 1.0, // 100% rate limit
    });

    const res = await mockProvider.fetchAvailability("https://example.com/api");
    expect(res.httpStatus).toBe(429);
    expect(res.retryAfterSeconds).toBe(60);
  });

  it("runs a simulated sequential benchmark and computes metrics", async () => {
    const runner = new PollingBenchmarkRunner();

    const result = await runner.runBenchmark({
      targetEndpoint: "https://example.com/simulated",
      configuredIntervalSeconds: 60,
      maxRequests: 5,
      maxDurationSeconds: 10,
      isSimulation: true,
      simulationConfig: {
        latencyMinMs: 5,
        latencyMaxMs: 15,
      },
    });

    expect(result.totalRequests).toBe(5);
    expect(result.successfulRequests).toBe(5);
    expect(result.failedRequests).toBe(0);
    expect(result.rateLimitCount).toBe(0);
    expect(result.medianLatencyMs).toBeGreaterThan(0);
    expect(result.httpStatusDistribution["200"]).toBe(5);
    expect(result.estimatedHourlyRequests).toBe(60);
    expect(result.recommendedIntervalSeconds).toBeGreaterThanOrEqual(60);
  });

  it("recommends conservative backoff if rate limits are detected in benchmark", async () => {
    const runner = new PollingBenchmarkRunner();

    const result = await runner.runBenchmark({
      targetEndpoint: "https://example.com/simulated",
      configuredIntervalSeconds: 30,
      maxRequests: 3,
      maxDurationSeconds: 10,
      isSimulation: true,
      simulationConfig: {
        rateLimitRate: 1.0, // Throttled
      },
    });

    expect(result.rateLimitCount).toBeGreaterThan(0);
    expect(result.recommendedIntervalSeconds).toBeGreaterThanOrEqual(60);
  });
});
