import { AppError } from "@exam-monitor/shared";

/**
 * Check if an IP address string is a private, loopback, or cloud metadata address.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  // IPv4 checks
  const ipv4Parts = ip.split(".").map(Number);
  if (ipv4Parts.length === 4 && ipv4Parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    const [b0, b1] = ipv4Parts;

    // 0.0.0.0/8 (Current network)
    if (b0 === 0) return true;
    // 10.0.0.0/8 (Private)
    if (b0 === 10) return true;
    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) return true;
    // 169.254.0.0/16 (Link-local / AWS & GCP Instance Metadata 169.254.169.254)
    if (b0 === 169 && b1 === 254) return true;
    // 172.16.0.0/12 (Private)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (b0 === 192 && b1 === 168) return true;
    // 100.64.0.0/10 (Carrier-grade NAT)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

    return false;
  }

  // IPv6 checks
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80")) {
    return true;
  }

  return false;
}

export interface EndpointValidationOptions {
  allowedHosts?: string[];
  allowHttpForTesting?: boolean;
}

/**
 * Validate a user-configured endpoint URL to prevent SSRF and protocol tampering.
 */
export function validateEndpointUrl(
  endpointUrl: string,
  options: EndpointValidationOptions = {}
): URL {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(endpointUrl);
  } catch {
    throw new AppError("Invalid endpoint URL format", 400, "INVALID_URL");
  }

  const { allowedHosts = [], allowHttpForTesting = false } = options;

  // Protocol validation: HTTPS required in production
  if (parsedUrl.protocol !== "https:") {
    if (!(allowHttpForTesting && parsedUrl.protocol === "http:")) {
      throw new AppError(
        `Insecure endpoint protocol: '${parsedUrl.protocol}'. Only HTTPS is permitted in production.`,
        400,
        "INSECURE_PROTOCOL"
      );
    }
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // SSRF check for private/reserved IPs
  if (isPrivateOrReservedIp(hostname)) {
    if (!allowHttpForTesting) {
      throw new AppError(
        `Access to private, loopback, or metadata network addresses is prohibited: ${hostname}`,
        403,
        "SSRF_PREVENTED"
      );
    }
  }

  // Host allowlist check (if allowlist is provided and non-empty)
  if (allowedHosts.length > 0) {
    const isAllowed = allowedHosts.some((allowed) => {
      const lowerAllowed = allowed.toLowerCase().trim();
      return hostname === lowerAllowed || hostname.endsWith(`.${lowerAllowed}`);
    });

    if (!isAllowed) {
      throw new AppError(
        `Hostname '${hostname}' is not in the configured list of allowed monitoring domains: [${allowedHosts.join(", ")}]`,
        403,
        "FORBIDDEN_HOST"
      );
    }
  }

  return parsedUrl;
}
