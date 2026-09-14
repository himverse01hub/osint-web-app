/**
 * Minimal fixed-window rate limiter for serverless API routes.
 *
 * NOTE: buckets live in the function instance's memory. On serverless
 * platforms instances are recycled and traffic is spread across instances,
 * so this is a best-effort brake (raises the cost of brute force /
 * credential stuffing) rather than a global guarantee. A Redis-backed
 * limiter can replace this module without changing call sites.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const MAX_KEYS = 10_000; // memory guard against key-flooding

export type RateLimitOptions = { limit: number; windowMs: number };

export type RateLimitResult = {
  allowed: boolean;
  /** Seconds until the caller may retry (0 when allowed). */
  retryAfterSec: number;
  remaining: number;
};

export const rateLimit = (key: string, { limit, windowMs }: RateLimitOptions): RateLimitResult => {
  const now = Date.now();
  if (buckets.size > MAX_KEYS) {
    for (const [existingKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(existingKey);
    }
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0, remaining: limit - 1 };
  }

  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return {
    allowed,
    retryAfterSec: allowed ? 0 : Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    remaining: Math.max(0, limit - bucket.count),
  };
};

/** Test helper: clear all buckets. */
export const resetRateLimits = (): void => {
  buckets.clear();
};
