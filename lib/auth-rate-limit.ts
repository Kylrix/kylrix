/**
 * Intelligent Per-User Rate Limiting System
 * 
 * Strategy:
 * - Tracks auth attempts per user in Appwrite prefs
 * - Learns user patterns (tired users vs attackers)
 * - Progressive warnings before any restrictions
 * - For unverified users: requires email verification to unlock
 * - For verified users: progressive delays
 * - Always aims to be invisible to legitimate users
 */

import { Users } from 'node-appwrite';

interface AuthAttempt {
  timestamp: number;
  method: string;
  success: boolean;
}

interface AuthAttemptData {
  attempts: AuthAttempt[];
  windowStart: number;
  violations: number;
  lastViolationTime: number | null;
  status: 'normal' | 'warning' | 'caution' | 'limited'; // Progressive states
  emailVerified: boolean;
}

interface RateLimitCheckResult {
  allowed: boolean;
  status: 'normal' | 'warning' | 'caution' | 'limited';
  attemptsRemaining: number;
  attemptsTotal: number;
  message: string | null;
  nextWindowSeconds: number;
}

const DEFAULTS = {
  WINDOW_MS: 60 * 1000, // 60 seconds
  MAX_ATTEMPTS: 10,
  WARNING_THRESHOLD: 0.7, // 70% of max (7 attempts) = warning
  CAUTION_THRESHOLD: 0.9, // 90% of max (9 attempts) = caution
  VIOLATION_ESCALATION_MS: 5 * 60 * 1000, // 5 minutes between violations before escalating
  HISTORY_KEEP: 100, // Keep last 100 attempts
};

export class AuthRateLimit {
  private users: Users;

  constructor(usersApi: Users) {
    this.users = usersApi;
  }

  /**
   * Get rate limit configuration from env or defaults
   */
  private getConfig() {
    return {
      windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || String(DEFAULTS.WINDOW_MS), 10),
      maxAttempts: parseInt(process.env.AUTH_RATE_LIMIT_MAX || String(DEFAULTS.MAX_ATTEMPTS), 10),
      warningThreshold: parseFloat(process.env.AUTH_RATE_LIMIT_WARNING_THRESHOLD || String(DEFAULTS.WARNING_THRESHOLD)),
      cautionThreshold: parseFloat(process.env.AUTH_RATE_LIMIT_CAUTION_THRESHOLD || String(DEFAULTS.CAUTION_THRESHOLD)),
      violationEscalationMs: parseInt(process.env.AUTH_RATE_LIMIT_VIOLATION_ESCALATION_MS || String(DEFAULTS.VIOLATION_ESCALATION_MS), 10),
      historyKeep: parseInt(process.env.AUTH_RATE_LIMIT_HISTORY_KEEP || String(DEFAULTS.HISTORY_KEEP), 10),
    };
  }

  /**
   * Parse existing auth attempt data from prefs
   */
  private parseAuthData(prefs: any): AuthAttemptData {
    try {
      const authDataStr = prefs?.auth_attempt as string | undefined;
      if (!authDataStr) {
        return {
          attempts: [],
          windowStart: Date.now(),
          violations: 0,
          lastViolationTime: null,
          status: 'normal',
          emailVerified: !!prefs?.emailVerification,
        };
      }
      return JSON.parse(authDataStr);
    } catch {
      return {
        attempts: [],
        windowStart: Date.now(),
        violations: 0,
        lastViolationTime: null,
        status: 'normal',
        emailVerified: !!prefs?.emailVerification,
      };
    }
  }

  /**
   * Serialize auth data back to prefs
   */
  private serializeAuthData(data: AuthAttemptData): string {
    return JSON.stringify(data);
  }

  /**
   * Determine the state based on attempts and violations
   */
  private determineStatus(
    config: ReturnType<typeof this.getConfig>,
    attemptCount: number,
    violations: number,
    lastViolationTime: number | null,
    _emailVerified: boolean
  ): AuthAttemptData['status'] {
    const now = Date.now();
    
    // If violations are stale (> 5 min old), consider it normal
    if (lastViolationTime && now - lastViolationTime > config.violationEscalationMs) {
      return 'normal';
    }

    // Progressive escalation based on violations
    if (violations >= 3) {
      return 'limited';
    }
    if (violations >= 2) {
      return 'caution';
    }
    if (violations >= 1) {
      return 'warning';
    }

    // Also consider attempt count in current window
    const cautionThreshold = Math.floor(config.maxAttempts * config.cautionThreshold);
    const warningThreshold = Math.floor(config.maxAttempts * config.warningThreshold);

    if (attemptCount >= cautionThreshold) {
      return 'caution';
    }
    if (attemptCount >= warningThreshold) {
      return 'warning';
    }

    return 'normal';
  }

  /**
   * Check if auth is allowed and return detailed status
   */
  async checkRateLimit(user: any, _method: string = 'passkey'): Promise<RateLimitCheckResult> {
    const config = this.getConfig();
    const now = Date.now();

    const authData = this.parseAuthData(user.prefs);
    const { attempts, windowStart, violations, lastViolationTime, emailVerified } = authData;

    // Reset window if expired
    let windowAttempts = attempts;
    let currentWindowStart = windowStart;

    if (now - windowStart > config.windowMs) {
      windowAttempts = [];
      currentWindowStart = now;
    }

    const attemptsInWindow = windowAttempts.length;
    const attemptsRemaining = Math.max(0, config.maxAttempts - attemptsInWindow);
    const nextWindowSeconds = Math.ceil((currentWindowStart + config.windowMs - now) / 1000);

    // Determine current status
    const status = this.determineStatus(config, attemptsInWindow, violations, lastViolationTime, emailVerified);

    // Check if limited (violations >= 3 and recent)
    if (status === 'limited') {
      return {
        allowed: false,
        status: 'limited',
        attemptsRemaining: 0,
        attemptsTotal: config.maxAttempts,
        message: emailVerified
          ? `Too many failed attempts. Please wait ${nextWindowSeconds}s before trying again.`
          : `Too many failed attempts. Please verify your email to unlock access.`,
        nextWindowSeconds,
      };
    }

    // Check if at limit
    if (attemptsInWindow >= config.maxAttempts) {
      return {
        allowed: false,
        status: 'caution',
        attemptsRemaining: 0,
        attemptsTotal: config.maxAttempts,
        message: emailVerified
          ? `Rate limit reached. You have ${nextWindowSeconds}s to wait before your next attempt.`
          : `Rate limit reached. Please verify your email to unlock.`,
        nextWindowSeconds,
      };
    }

    // Allowed, but may have warnings
    let message: string | null = null;

    if (status === 'caution' && attemptsRemaining > 0) {
      message = `⚠️ Warning: ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining before temporary lockout.`;
    } else if (status === 'warning' && attemptsRemaining <= 2) {
      message = `Helpful reminder: You have ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} left in the next ${Math.ceil(config.windowMs / 1000)} seconds.`;
    }

    return {
      allowed: true,
      status,
      attemptsRemaining,
      attemptsTotal: config.maxAttempts,
      message,
      nextWindowSeconds,
    };
  }

  /**
   * Record an auth attempt (call this after auth attempt, regardless of success)
   */
  async recordAuthAttempt(user: any, method: string = 'passkey', success: boolean = false): Promise<void> {
    const config = this.getConfig();
    const now = Date.now();

    const authData = this.parseAuthData(user.prefs);
    let { attempts, windowStart, violations, lastViolationTime } = authData;

    // Reset window if expired
    if (now - windowStart > config.windowMs) {
      attempts = [];
      windowStart = now;
      violations = 0;
    }

    // Add new attempt
    const newAttempt: AuthAttempt = {
      timestamp: now,
      method,
      success,
    };

    attempts.push(newAttempt);

    // Keep only recent history
    if (attempts.length > config.historyKeep) {
      attempts = attempts.slice(-config.historyKeep);
    }

    // Track violations (only on failed attempts)
    if (!success) {
      // Check if this is a new violation cluster
      if (lastViolationTime && now - lastViolationTime > config.violationEscalationMs) {
        // Cluster expired, reset violations
        violations = 1;
      } else {
        violations += 1;
      }
      lastViolationTime = now;
    } else {
      // Successful auth resets violations
      violations = 0;
      lastViolationTime = null;
    }

    // Determine new status
    const status = this.determineStatus(config, attempts.length, violations, lastViolationTime, !!user.prefs?.emailVerification);

    // Build updated auth data
    const updatedAuthData: AuthAttemptData = {
      attempts,
      windowStart,
      violations,
      lastViolationTime,
      status,
      emailVerified: !!user.prefs?.emailVerification,
    };

    // Update user prefs
    const mergedPrefs = { ...(user.prefs || {}) } as Record<string, unknown>;
    mergedPrefs.auth_attempt = this.serializeAuthData(updatedAuthData);

    await this.users.updatePrefs(user.$id, mergedPrefs);
  }

  /**
   * Get detailed auth attempt history for a user (for debugging/admin)
   */
  async getAuthHistory(user: any, limit: number = 20): Promise<AuthAttempt[]> {
    const authData = this.parseAuthData(user.prefs);
    return authData.attempts.slice(-limit);
  }

  /**
   * Reset rate limit for a user (admin action, e.g., after email verification)
   */
  async resetRateLimit(user: any): Promise<void> {
    const mergedPrefs = { ...(user.prefs || {}) } as Record<string, unknown>;

    const cleanAuthData: AuthAttemptData = {
      attempts: [],
      windowStart: Date.now(),
      violations: 0,
      lastViolationTime: null,
      status: 'normal',
      emailVerified: !!user.prefs?.emailVerification,
    };

    mergedPrefs.auth_attempt = this.serializeAuthData(cleanAuthData);
    await this.users.updatePrefs(user.$id, mergedPrefs);
  }
}
