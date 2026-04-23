type Bucket = {
  count: number;
  resetAt: number;
};

declare global {
  var __auraRateLimitBuckets: Map<string, Bucket> | undefined;
}

const buckets = globalThis.__auraRateLimitBuckets ?? new Map<string, Bucket>();

if (!globalThis.__auraRateLimitBuckets) {
  globalThis.__auraRateLimitBuckets = buckets;
}

export function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt: now + windowMs,
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  buckets.set(key, current);

  return {
    allowed: true,
    remaining: Math.max(limit - current.count, 0),
    resetAt: current.resetAt,
  };
}
