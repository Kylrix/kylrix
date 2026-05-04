// Simple in-memory rate limiter (per key) for PoC / small scale.
// For production horizontal scaling, move to Appwrite Functions KV or external cache.

interface Bucket { count: number; windowStart: number; }

const buckets = new Map<string, Bucket>();

function now() { return Date.now(); }

export function rateLimit(key: string, max: number, windowMs: number) {
  const t = now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { count: 0, windowStart: t };
    buckets.set(key, bucket);
  }
  if (t - bucket.windowStart >= windowMs) {
    bucket.count = 0;
    bucket.windowStart = t;
  }
  bucket.count += 1;
  const remaining = Math.max(0, max - bucket.count);
  const reset = bucket.windowStart + windowMs;
  return { allowed: bucket.count <= max, remaining, reset };
}

export function buildRateKey(parts: Array<string | undefined | null>) {
  return parts.filter(Boolean).join(":");
}
