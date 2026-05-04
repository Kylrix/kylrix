/**
 * Client-side rate limiting utility
 * Prevents brute force attacks and abuse
 * Note: This is client-side only. Server-side rate limiting should also be implemented.
 */

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  blockedUntil?: number;
}

class RateLimiter {
  private attempts: Map<string, RateLimitEntry> = new Map();
  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly BLOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

  /**
   * Check if an action is rate limited
   * @param key Unique identifier for the action (e.g., 'login:email@example.com')
   * @returns true if allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.attempts.get(key);

    // If no entry, allow and create new entry
    if (!entry) {
      this.attempts.set(key, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return true;
    }

    // Check if currently blocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return false;
    }

    // Check if window has expired
    if (now - entry.firstAttempt > this.WINDOW_MS) {
      // Reset window
      this.attempts.set(key, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return true;
    }

    // Increment attempt count
    entry.count++;
    entry.lastAttempt = now;

    // Check if exceeded max attempts
    if (entry.count > this.MAX_ATTEMPTS) {
      entry.blockedUntil = now + this.BLOCK_DURATION_MS;
      this.attempts.set(key, entry);
      return false;
    }

    this.attempts.set(key, entry);
    return true;
  }

  /**
   * Get remaining attempts before rate limit
   */
  getRemainingAttempts(key: string): number {
    const entry = this.attempts.get(key);
    if (!entry) return this.MAX_ATTEMPTS;

    const now = Date.now();
    
    // Check if window has expired
    if (now - entry.firstAttempt > this.WINDOW_MS) {
      return this.MAX_ATTEMPTS;
    }

    return Math.max(0, this.MAX_ATTEMPTS - entry.count);
  }

  /**
   * Get time until unblocked (in seconds)
   */
  getBlockedDuration(key: string): number {
    const entry = this.attempts.get(key);
    if (!entry || !entry.blockedUntil) return 0;

    const now = Date.now();
    const remaining = entry.blockedUntil - now;
    
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  /**
   * Reset rate limit for a key (e.g., after successful action)
   */
  reset(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Clear all rate limit entries (e.g., on logout)
   */
  clearAll(): void {
    this.attempts.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.attempts.entries()) {
      // Remove entries older than window + block duration
      if (now - entry.lastAttempt > this.WINDOW_MS + this.BLOCK_DURATION_MS) {
        this.attempts.delete(key);
      }
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

// Export utility functions
export const checkRateLimit = (key: string): boolean => rateLimiter.isAllowed(key);
export const getRemainingAttempts = (key: string): number => rateLimiter.getRemainingAttempts(key);
export const getBlockedDuration = (key: string): number => rateLimiter.getBlockedDuration(key);
export const resetRateLimit = (key: string): void => rateLimiter.reset(key);
export const clearAllRateLimits = (): void => rateLimiter.clearAll();

// Run cleanup periodically (every 5 minutes)
if (typeof window !== 'undefined') {
  setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);
}
