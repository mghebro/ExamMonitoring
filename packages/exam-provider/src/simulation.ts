import { ExamSlot } from "@exam-monitor/shared";
import { FetchAvailabilityResult } from "./provider.js";

export interface MockSimulationConfig {
  latencyMinMs?: number;
  latencyMaxMs?: number;
  failureRate?: number; // 0.0 - 1.0
  rateLimitRate?: number; // 0.0 - 1.0
  malformedRate?: number; // 0.0 - 1.0
  slotsSequence?: ExamSlot[][];
}

export class MockSimulationProvider {
  private callCount = 0;

  constructor(private config: MockSimulationConfig = {}) {}

  async fetchAvailability(endpointUrl: string): Promise<FetchAvailabilityResult> {
    this.callCount++;
    const checkedAt = new Date().toISOString();

    // 1. Simulate Latency
    const minLatency = this.config.latencyMinMs ?? 50;
    const maxLatency = this.config.latencyMaxMs ?? 250;
    const latencyMs = Math.floor(minLatency + Math.random() * (maxLatency - minLatency));
    await new Promise((resolve) => setTimeout(resolve, Math.min(latencyMs, 100))); // Cap wait in tests

    // 2. Simulate Rate Limit
    if (this.config.rateLimitRate && Math.random() < this.config.rateLimitRate) {
      return {
        status: "UNKNOWN",
        slots: [],
        slotCount: 0,
        httpStatus: 429,
        latencyMs,
        checkedAt,
        retryAfterSeconds: 60,
        errorMessage: "Simulated Rate Limit (HTTP 429)",
        isVerifiedFormat: false,
      };
    }

    // 3. Simulate Server Failure
    if (this.config.failureRate && Math.random() < this.config.failureRate) {
      return {
        status: "UNKNOWN",
        slots: [],
        slotCount: 0,
        httpStatus: 503,
        latencyMs,
        checkedAt,
        errorMessage: "Simulated 503 Service Unavailable",
        isVerifiedFormat: false,
      };
    }

    // 4. Simulate Malformed Response
    if (this.config.malformedRate && Math.random() < this.config.malformedRate) {
      return {
        status: "UNKNOWN",
        slots: [],
        slotCount: 0,
        httpStatus: 200,
        latencyMs,
        checkedAt,
        rawSnippet: "<html><body>Unexpected HTML Gateway</body></html>",
        errorMessage: "Malformed or unrecognized response format",
        isVerifiedFormat: false,
      };
    }

    // 5. Normal Simulated Availability Sequence
    let slots: ExamSlot[] = [];
    if (this.config.slotsSequence && this.config.slotsSequence.length > 0) {
      const index = (this.callCount - 1) % this.config.slotsSequence.length;
      slots = this.config.slotsSequence[index];
    } else {
      // Default: alternating between 1 slot and empty
      if (this.callCount % 2 === 1) {
        slots = [{ bookingDate: "14-11-2026", bookingDateStatus: 1 }];
      } else {
        slots = [];
      }
    }

    return {
      status: slots.length > 0 ? "AVAILABLE" : "UNAVAILABLE",
      slots,
      slotCount: slots.length,
      httpStatus: 200,
      latencyMs,
      checkedAt,
      rawSnippet: JSON.stringify(slots),
      isVerifiedFormat: true,
    };
  }
}
