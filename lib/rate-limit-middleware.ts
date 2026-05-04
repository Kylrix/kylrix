import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  max: number;
  windowMs: number;
}

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const store: RateLimitStore = {};

export function createRateLimiter(config: RateLimitConfig) {
  return (req: NextRequest): { allowed: boolean; remaining: number; retryAfter?: number } => {
    const ip = getClientIp(req);
    const now = Date.now();
    const key = ip;

    if (!store[key]) {
      store[key] = { count: 1, resetTime: now + config.windowMs };
      return { allowed: true, remaining: config.max - 1 };
    }

    const bucket = store[key];
    
    if (now > bucket.resetTime) {
      bucket.count = 1;
      bucket.resetTime = now + config.windowMs;
      return { allowed: true, remaining: config.max - 1 };
    }

    bucket.count++;
    const remaining = Math.max(0, config.max - bucket.count);
    const allowed = bucket.count <= config.max;
    const retryAfter = allowed ? undefined : Math.ceil((bucket.resetTime - now) / 1000);

    return { allowed, remaining, retryAfter };
  };
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'unknown';
  return ip;
}

export function rateLimitResponse(retryAfter?: number) {
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    {
      status: 429,
      headers: retryAfter ? { 'Retry-After': retryAfter.toString() } : {},
    }
  );
}

// Cleanup old entries periodically (run every hour)
if (typeof window === 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const key in store) {
      if (now > store[key].resetTime + 3600000) {
        delete store[key];
      }
    }
  }, 3600000);
}
