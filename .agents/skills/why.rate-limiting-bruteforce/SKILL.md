---
name: why.rate-limiting-bruteforce
description: Deep dive into the client-side memory-based rate limiter and the server-side progressive auth rate limiter. Explains user pattern learning, email verification overrides, and state persistence in Appwrite user preferences.
---

# Why: Multi-Layered Rate Limiting & Bruteforce Shields

Bruteforce attacks are a threat to any security system. While blocking attackers, we must also ensure we don't block legitimate users who make occasional password typos. We handle this balance using a multi-layered rate-limiting system across the client and server.

This logic is implemented in `lib/rate-limiter.ts` and `lib/auth-rate-limit.ts`.

## 1. Client-Side Sliding Window Rate Limiting

To prevent simple automated scripts from spamming local network inputs, the client uses a memory-based sliding window rate limiter (`lib/rate-limiter.ts`). It tracks action counts per key, automatically cleaning up expired records via an active browser interval loop:

```typescript
class RateLimiter {
  private attempts: Map<string, RateLimitEntry> = new Map();
  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.attempts.get(key);
    // Track, increment attempts, block if above threshold
  }
}
```

## 2. Server-Side Pattern-Learning Auth Limiter

At the API edge, simple IP-based rate limiting fails when dealing with distributed botnets. We employ an intelligent rate limiter in `lib/auth-rate-limit.ts` that learns user patterns over time:

- **Progressive Warnings**: The user transitions through security states (`normal` ➔ `warning` ➔ `caution` ➔ `limited`) instead of hitting an abrupt block.
- **Persistent User Prefs History**: We serialize auth attempt logs directly inside the user's secure metadata preference document (`auth_attempt` within Appwrite `prefs`):

```typescript
interface AuthAttemptData {
  attempts: AuthAttempt[];
  windowStart: number;
  violations: number;
  lastViolationTime: number | null;
  status: 'normal' | 'warning' | 'caution' | 'limited';
  emailVerified: boolean;
}
```

## 3. Targeted Unlock Triggers

Our system adapts based on the user's verification status:
- **Unverified Users**: When locked, they must complete an email verification check to reset their limits. This blocks automated bots trying to brute-force accounts.
- **Verified Users**: The system applies progressive delays (e.g. 2s ➔ 5s ➔ 30s) instead of hard blocks, giving legitimate users a chance to try again after a typo.
