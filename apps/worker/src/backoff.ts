/**
 * Compute the next delay in seconds using bounded exponential backoff with jitter,
 * honoring official Retry-After directives when present.
 */
export function computeBackoffDelay(options: {
  consecutiveFailures: number;
  baseIntervalSeconds: number;
  maxBackoffSeconds: number;
  retryAfterSeconds?: number;
  jitterMaxSeconds?: number;
}): number {
  const {
    consecutiveFailures,
    baseIntervalSeconds,
    maxBackoffSeconds,
    retryAfterSeconds,
    jitterMaxSeconds = 5,
  } = options;

  // 1. If upstream explicitly requested a retry window, honor it
  if (retryAfterSeconds !== undefined && retryAfterSeconds > 0) {
    return Math.max(retryAfterSeconds, baseIntervalSeconds);
  }

  // 2. If no failures, return the standard interval
  if (consecutiveFailures <= 0) {
    return baseIntervalSeconds;
  }

  // 3. Responsive backoff for exam monitoring: base * 1.25^(failures - 1)
  const multiplier = Math.pow(1.25, Math.min(consecutiveFailures, 6));
  const rawBackoff = baseIntervalSeconds * multiplier;

  // 4. Add small random jitter to avoid thundering herd across workers
  const jitter = Math.random() * jitterMaxSeconds;

  const totalDelay = Math.min(rawBackoff + jitter, maxBackoffSeconds);
  return Math.round(totalDelay);
}
