import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isPrivateOrReservedIp,
  validateEndpointUrl,
  parseAvailabilityResponse,
  ExamProvider,
} from "../index.js";

describe("SSRF Protection & URL Validation", () => {
  it("identifies private and reserved IPv4 and IPv6 addresses", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.0.1.50")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.5.4")).toBe(true);
    expect(isPrivateOrReservedIp("172.31.255.255")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true); // Cloud metadata
    expect(isPrivateOrReservedIp("0.0.0.0")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);

    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
  });

  it("blocks insecure HTTP protocol in production mode", () => {
    expect(() =>
      validateEndpointUrl("http://example.com/api", { allowHttpForTesting: false })
    ).toThrow(/Insecure endpoint protocol/);
  });

  it("blocks SSRF targets in private IP address ranges", () => {
    expect(() =>
      validateEndpointUrl("https://169.254.169.254/latest/meta-data/", {
        allowHttpForTesting: false,
      })
    ).toThrow(/Access to private, loopback, or metadata/);

    expect(() =>
      validateEndpointUrl("https://10.0.0.5/api/dates", {
        allowHttpForTesting: false,
      })
    ).toThrow(/Access to private, loopback, or metadata/);
  });

  it("enforces allowed hosts allowlist", () => {
    const allowedHosts = ["exam-booking.sa.gov.ge"];

    expect(() =>
      validateEndpointUrl("https://malicious-site.com/api", {
        allowedHosts,
      })
    ).toThrow(/is not in the configured list of allowed monitoring domains/);

    const validUrl = validateEndpointUrl(
      "https://exam-booking.sa.gov.ge/practical/dates?CategoryCode=4&CenterId=7&isFirstAttempt=0",
      { allowedHosts }
    );
    expect(validUrl.hostname).toBe("exam-booking.sa.gov.ge");
  });
});

describe("Availability Response Parser", () => {
  it("parses verified available slots array fixture", () => {
    const fixture = JSON.stringify([
      { bookingDate: "14-11-2026", bookingDateStatus: 1 },
      { bookingDate: "21-11-2026", bookingDateStatus: 1 },
      { bookingDate: "28-11-2026", bookingDateStatus: 1 },
    ]);

    const result = parseAvailabilityResponse(fixture);
    expect(result.status).toBe("AVAILABLE");
    expect(result.slots).toHaveLength(3);
    expect(result.slots[0].bookingDate).toBe("14-11-2026");
    expect(result.isVerifiedFormat).toBe(true);
  });

  it("parses empty array as verified UNAVAILABLE", () => {
    const result = parseAvailabilityResponse("[]");
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.slots).toHaveLength(0);
    expect(result.isVerifiedFormat).toBe(true);
  });

  it("parses Georgian no-spots string response as UNAVAILABLE", () => {
    const fixture = '"არჩეულ სერვის ცენტრში არ არის ადგილი"';
    const result = parseAvailabilityResponse(fixture);
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.slots).toHaveLength(0);
    expect(result.isVerifiedFormat).toBe(true);
  });

  it("reports UNKNOWN when endpoint returns unexpected schema", () => {
    const unknownPayload = JSON.stringify({ error: "Invalid parameters", code: 99 });
    const result = parseAvailabilityResponse(unknownPayload);
    expect(result.status).toBe("UNKNOWN");
    expect(result.slots).toHaveLength(0);
    expect(result.isVerifiedFormat).toBe(false);
  });

  it("reports UNKNOWN when endpoint returns HTML error page", () => {
    const htmlResponse = "<html><head><title>502 Bad Gateway</title></head><body>Bad Gateway</body></html>";
    const result = parseAvailabilityResponse(htmlResponse);
    expect(result.status).toBe("UNKNOWN");
    expect(result.slots).toHaveLength(0);
  });
});

describe("ExamProvider HTTP Client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetches and returns available slots successfully", async () => {
    const mockDates = [
      { bookingDate: "14-11-2026", bookingDateStatus: 1 },
      { bookingDate: "21-11-2026", bookingDateStatus: 1 },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(mockDates)),
    } as unknown as Response);

    const provider = new ExamProvider({
      allowedHosts: ["example.com"],
      allowHttpForTesting: true,
    });

    const result = await provider.fetchAvailability("https://example.com/practical/dates");
    expect(result.status).toBe("AVAILABLE");
    expect(result.slotCount).toBe(2);
    expect(result.httpStatus).toBe(200);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("handles HTTP 429 rate limit with Retry-After header", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 429,
      headers: new Headers({
        "retry-after": "45",
      }),
      text: () => Promise.resolve("Too Many Requests"),
    } as unknown as Response);

    const provider = new ExamProvider({
      allowedHosts: ["example.com"],
      allowHttpForTesting: true,
    });

    const result = await provider.fetchAvailability("https://example.com/practical/dates");
    expect(result.status).toBe("UNKNOWN");
    expect(result.httpStatus).toBe(429);
    expect(result.retryAfterSeconds).toBe(45);
    expect(result.errorMessage).toContain("rate limiting");
  });

  it("rejects HTTP redirects to protect against SSRF bounce attacks", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      status: 302,
      headers: new Headers({ location: "http://169.254.169.254" }),
      text: () => Promise.resolve(""),
    } as unknown as Response);

    const provider = new ExamProvider({
      allowedHosts: ["example.com"],
      allowHttpForTesting: true,
    });

    const result = await provider.fetchAvailability("https://example.com/practical/dates");
    expect(result.status).toBe("UNKNOWN");
    expect(result.httpStatus).toBe(302);
    expect(result.errorMessage).toContain("Redirect (HTTP 302) received");
  });
});
