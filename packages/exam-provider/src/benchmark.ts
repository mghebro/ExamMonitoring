import { performance } from "node:perf_hooks";
import { PollingBenchmarkRun, generateId, logger } from "@exam-monitor/shared";
import { ExamProvider, FetchAvailabilityResult } from "./provider.js";
import { MockSimulationConfig, MockSimulationProvider } from "./simulation.js";

export interface BenchmarkOptions {
  targetEndpoint: string;
  configuredIntervalSeconds: number;
  maxRequests: number;
  maxDurationSeconds: number;
  isSimulation?: boolean;
  simulationConfig?: MockSimulationConfig;
  allowedHosts?: string[];
  allowHttpForTesting?: boolean;
}

export class PollingBenchmarkRunner {
  private log = logger.child("BenchmarkRunner");

  async runBenchmark(options: BenchmarkOptions): Promise<PollingBenchmarkRun> {
    const {
      targetEndpoint,
      configuredIntervalSeconds,
      maxRequests,
      maxDurationSeconds,
      isSimulation = false,
      simulationConfig,
      allowedHosts,
      allowHttpForTesting = false,
    } = options;

    this.log.info("Starting polling benchmark...", {
      targetEndpoint,
      interval: configuredIntervalSeconds,
      maxRequests,
      isSimulation,
    });

    const provider: { fetchAvailability: (url: string) => Promise<FetchAvailabilityResult> } =
      isSimulation
        ? new MockSimulationProvider(simulationConfig)
        : new ExamProvider({ allowedHosts, allowHttpForTesting });

    const startTime = performance.now();
    const latencies: number[] = [];
    const httpStatusDistribution: Record<string, number> = {};
    let successfulRequests = 0;
    let failedRequests = 0;
    let rateLimitCount = 0;
    let totalRequests = 0;

    const intervalMs = Math.max(configuredIntervalSeconds, 1) * 1000;
    let actualIntervalSum = 0;
    let lastRequestEnd = startTime;

    while (totalRequests < maxRequests) {
      const elapsedSeconds = (performance.now() - startTime) / 1000;
      if (elapsedSeconds >= maxDurationSeconds) {
        this.log.info("Benchmark reached maximum duration budget. Stopping.");
        break;
      }

      const requestStart = performance.now();
      if (totalRequests > 0) {
        actualIntervalSum += (requestStart - lastRequestEnd);
      }

      totalRequests++;
      const result = await provider.fetchAvailability(targetEndpoint);
      lastRequestEnd = performance.now();

      latencies.push(result.latencyMs);

      const statusKey = String(result.httpStatus || 0);
      httpStatusDistribution[statusKey] = (httpStatusDistribution[statusKey] || 0) + 1;

      if (result.httpStatus === 429) {
        rateLimitCount++;
        failedRequests++;
        this.log.warn(`Rate limit encountered during benchmark on request #${totalRequests}`);

        // If rate limited, honor retry-after or pause before next request
        const waitSeconds = result.retryAfterSeconds ?? 10;
        const rateLimitSleepMs = isSimulation ? 10 : Math.min(waitSeconds * 1000, 5000);
        await new Promise((resolve) => setTimeout(resolve, rateLimitSleepMs));
      } else if (result.httpStatus >= 200 && result.httpStatus < 400) {
        successfulRequests++;
      } else {
        failedRequests++;
      }

      // Sequential delay between requests (scaled down in simulation if interval < 5s)
      if (totalRequests < maxRequests) {
        const sleepMs = isSimulation ? Math.min(intervalMs, 50) : intervalMs;
        await new Promise((resolve) => setTimeout(resolve, sleepMs));
      }
    }

    // Calculate Latency Metrics
    latencies.sort((a, b) => a - b);
    const medianLatencyMs =
      latencies.length > 0
        ? latencies[Math.floor(latencies.length / 2)]
        : 0;
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95LatencyMs = latencies.length > 0 ? latencies[p95Index] : 0;

    const avgActualIntervalMs =
      totalRequests > 1
        ? Math.round(actualIntervalSum / (totalRequests - 1))
        : intervalMs;

    // Safety policy calculation
    let recommendedIntervalSeconds = configuredIntervalSeconds;
    if (rateLimitCount > 0) {
      // If throttled, back off significantly
      recommendedIntervalSeconds = Math.max(configuredIntervalSeconds * 2, 120);
    } else if (failedRequests > totalRequests * 0.2) {
      // If high error rate, recommend conservative interval
      recommendedIntervalSeconds = Math.max(configuredIntervalSeconds, 60);
    } else {
      // Normal safe interval (minimum 30-60s)
      recommendedIntervalSeconds = Math.max(configuredIntervalSeconds, 60);
    }

    const estimatedHourlyRequests = Math.round(3600 / recommendedIntervalSeconds);
    const estimatedDailyRequests = Math.round(86400 / recommendedIntervalSeconds);

    const benchmarkResult: PollingBenchmarkRun = {
      id: generateId(),
      targetEndpoint,
      configuredIntervalSeconds,
      actualIntervalMs: avgActualIntervalMs,
      totalRequests,
      successfulRequests,
      failedRequests,
      rateLimitCount,
      medianLatencyMs,
      p95LatencyMs,
      httpStatusDistribution,
      estimatedHourlyRequests,
      estimatedDailyRequests,
      recommendedIntervalSeconds,
      isSimulation,
      executedAt: new Date().toISOString(),
    };

    this.log.info("Benchmark complete", {
      total: totalRequests,
      successful: successfulRequests,
      rateLimits: rateLimitCount,
      medianLatencyMs,
      recommendedIntervalSeconds,
    });

    return benchmarkResult;
  }
}
