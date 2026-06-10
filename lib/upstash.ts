import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Centralized Upstash Redis client utilizing environment credentials
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// Centralized sliding window ratelimiter for Next.js Server Actions
// Limits requests to 60 per minute per identifier by default
export const serverActionLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1m"),
  analytics: true,
  prefix: "@kylrix/ratelimit",
});

/**
 * Server-side rate limiter helper for Server Actions
 * @param identifier Unique request key (e.g. actorId or client IP)
 * @returns Object indicating success or throttled state
 */
export async function limitServerAction(identifier: string) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    // Fail-safe if credentials are not configured in local environment yet
    return { success: true, remaining: 999, reset: 0 };
  }
  
  const { success, remaining, reset, pending } = await serverActionLimiter.limit(identifier);
  
  // Flush async analytics if running inside serverless edge contexts
  if (pending) {
    try {
      await pending;
    } catch (e) {
      console.error("Upstash analytics flush failed:", e);
    }
  }

  return { success, remaining, reset };
}
