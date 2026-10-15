# Polling Benchmark & Simulation Guide — Exam Monitor

Choosing an appropriate polling interval requires balancing alert speed with official service rate limits and network etiquette. This guide explains how to use the built-in benchmark runner.

---

## 1. Safety Principles of Live Benchmarking

When testing against live government servers:
- **Never Generate Concurrent Load**: All benchmark requests are strictly sequential (one in-flight request at a time).
- **Conservative Baseline**: Benchmarking defaults to starting at 60 seconds. Shorter intervals (e.g. 30 seconds) should only be evaluated when permitted by service policy.
- **Budget Limits**: Strict maximum request counts (default: 10-30 requests) and duration limits prevent accidental server flooding.
- **Respect Rate-Limit Responses**: If an HTTP 429 is encountered, the benchmark immediately halts or backs off, extracting and respecting the `Retry-After` header.

---

## 2. Local Simulation Benchmark

To test scheduler resilience, state transitions, and notification dispatching without contacting external infrastructure, Exam Monitor provides a mock simulation engine:

```typescript
import { PollingBenchmarkRunner } from "@exam-monitor/exam-provider";

const runner = new PollingBenchmarkRunner();

const report = await runner.runBenchmark({
  targetEndpoint: "https://example.com/simulated",
  configuredIntervalSeconds: 60,
  maxRequests: 20,
  maxDurationSeconds: 120,
  isSimulation: true,
  simulationConfig: {
    latencyMinMs: 40,
    latencyMaxMs: 180,
    failureRate: 0.05,       // 5% simulated 503 errors
    rateLimitRate: 0.05,     // 5% simulated 429 rate-limits
  },
});

console.log(report);
```

---

## 3. Interpreting Benchmark Metrics

The benchmark produces a comprehensive diagnostic report:

- **Configured Interval**: The user-selected target interval (e.g. 60s).
- **Actual Interval**: The real elapsed time measured between sequential requests, accounting for network latency and event loop scheduling.
- **Total Requests**: Number of sequential probes executed.
- **Success vs. Failure Rate**: Percentage of HTTP 200 responses vs 4xx/5xx errors.
- **HTTP Status Distribution**: JSON breakdown of response codes (e.g. `{"200": 28, "429": 2}`).
- **Median & P95 Latency**: 50th and 95th percentile round-trip response times in milliseconds.
- **Estimated Request Volume**:
  - Hourly estimate: `Math.round(3600 / interval)`
  - Daily estimate: `Math.round(86400 / interval)`
- **Recommended Safe Interval**: Calculated recommendation taking into account throttles, latency spikes, and server stability.

---

## 4. Recommended Production Interval

Based on production observations of the official exam booking endpoint:
- **Default Recommended Interval**: **60 seconds** (~60 requests/hour, ~1,440 requests/day).
- **Minimum Permitted Interval**: **30 seconds** (enforced by `MIN_POLL_INTERVAL_SECONDS`).
- Under no circumstances should intervals shorter than 30 seconds be used, as official firewalls will ban offending IP addresses.
