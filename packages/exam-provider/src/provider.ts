import { performance } from "node:perf_hooks";
import { AvailabilityStatus, ExamSlot, logger } from "@exam-monitor/shared";
import { validateEndpointUrl, EndpointValidationOptions } from "./ssrf.js";
import { parseAvailabilityResponse } from "./schema.js";

export interface FetchOptions extends EndpointValidationOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export interface FetchAvailabilityResult {
  status: AvailabilityStatus;
  slots: ExamSlot[];
  slotCount: number;
  httpStatus: number;
  latencyMs: number;
  checkedAt: string;
  retryAfterSeconds?: number;
  rawSnippet?: string;
  errorMessage?: string;
  isVerifiedFormat: boolean;
}

export class ExamProvider {
  private log = logger.child("ExamProvider");

  constructor(private defaultOptions: FetchOptions = {}) {}

  /**
   * Fetch and evaluate driving exam availability from an endpoint.
   */
  async fetchAvailability(
    endpointUrl: string,
    options: FetchOptions = {}
  ): Promise<FetchAvailabilityResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const timeoutMs = mergedOptions.timeoutMs ?? 25000;
    const checkedAt = new Date().toISOString();

    // 1. SSRF and Domain Validation
    let validatedUrl: URL;
    try {
      validatedUrl = validateEndpointUrl(endpointUrl, {
        allowedHosts: mergedOptions.allowedHosts,
        allowHttpForTesting: mergedOptions.allowHttpForTesting,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "SSRF validation failed";
      this.log.error("Endpoint validation rejected URL", { endpointUrl, error: msg });
      return {
        status: "UNKNOWN",
        slots: [],
        slotCount: 0,
        httpStatus: 400,
        latencyMs: 0,
        checkedAt,
        errorMessage: msg,
        isVerifiedFormat: false,
      };
    }

    const startTime = performance.now();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      // Perform outbound HTTP request with redirect protection
      const response = await fetch(validatedUrl.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9,ka;q=0.8",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          ...mergedOptions.headers,
        },
        signal: controller.signal,
        redirect: "manual", // Prevent SSRF via redirection to private network
      });

      clearTimeout(timer);
      const latencyMs = Math.round(performance.now() - startTime);

      // Handle HTTP redirects (301, 302, 307, 308) - reject automatic following for security
      if (response.status >= 300 && response.status < 400) {
        return {
          status: "UNKNOWN",
          slots: [],
          slotCount: 0,
          httpStatus: response.status,
          latencyMs,
          checkedAt,
          errorMessage: `Redirect (HTTP ${response.status}) received. Outbound redirects to unverified targets are disabled for SSRF protection.`,
          isVerifiedFormat: false,
        };
      }

      // Handle Rate Limiting (HTTP 429)
      if (response.status === 429) {
        let retryAfterSeconds: number | undefined;
        const retryAfterHeader = response.headers.get("retry-after");
        if (retryAfterHeader) {
          const parsedSeconds = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
            retryAfterSeconds = parsedSeconds;
          }
        }

        return {
          status: "UNKNOWN",
          slots: [],
          slotCount: 0,
          httpStatus: 429,
          latencyMs,
          checkedAt,
          retryAfterSeconds,
          errorMessage: `Target endpoint reported rate limiting (HTTP 429). Retry after: ${retryAfterSeconds ?? "unknown"}s`,
          isVerifiedFormat: false,
        };
      }

      // Handle Server Errors (5xx)
      if (response.status >= 500) {
        return {
          status: "UNKNOWN",
          slots: [],
          slotCount: 0,
          httpStatus: response.status,
          latencyMs,
          checkedAt,
          errorMessage: `Target server error: HTTP ${response.status}`,
          isVerifiedFormat: false,
        };
      }

      // Handle Client Errors (4xx)
      if (response.status >= 400) {
        return {
          status: "UNKNOWN",
          slots: [],
          slotCount: 0,
          httpStatus: response.status,
          latencyMs,
          checkedAt,
          errorMessage: `Target client error: HTTP ${response.status}`,
          isVerifiedFormat: false,
        };
      }

      // Read response body as text
      const rawText = await response.text();
      const parseResult = parseAvailabilityResponse(rawText);

      return {
        status: parseResult.status,
        slots: parseResult.slots,
        slotCount: parseResult.slots.length,
        httpStatus: response.status,
        latencyMs,
        checkedAt,
        rawSnippet: parseResult.rawSnippet,
        isVerifiedFormat: parseResult.isVerifiedFormat,
      };
    } catch (err: unknown) {
      const latencyMs = Math.round(performance.now() - startTime);
      const isAbort = (err as Error)?.name === "AbortError";
      const errorMsg = isAbort
        ? `Request timed out after ${timeoutMs}ms`
        : (err as Error)?.message || "Network transport failure";

      return {
        status: "UNKNOWN",
        slots: [],
        slotCount: 0,
        httpStatus: isAbort ? 408 : 0,
        latencyMs,
        checkedAt,
        errorMessage: errorMsg,
        isVerifiedFormat: false,
      };
    }
  }
}
