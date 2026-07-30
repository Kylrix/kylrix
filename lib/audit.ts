/**
 * Security audit logging system
 * Logs all security-critical events for forensics and monitoring
 */

import { AppwriteService } from './appwrite';
import { getDeviceFingerprint } from './security';
import { logError } from './logger';

type SecurityEventType =
  | 'auth.login.success'
  | 'auth.login.failed'
  | 'auth.login.rate_limited'
  | 'auth.logout'
  | 'auth.register.success'
  | 'auth.register.failed'
  | 'auth.password_reset.requested'
  | 'auth.password_reset.completed'
  | 'auth.password_reset.failed'
  | 'vault.unlocked'
  | 'vault.unlock_failed'
  | 'vault.locked'
  | 'vault.timeout'
  | 'masterpass.created'
  | 'masterpass.changed'
  | 'masterpass.reset'
  | 'passkey.added'
  | 'passkey.removed'
  | 'passkey.unlock_success'
  | 'passkey.unlock_failed'
  | 'mfa.enabled'
  | 'mfa.disabled'
  | 'mfa.challenge_success'
  | 'mfa.challenge_failed'
  | 'credential.created'
  | 'credential.viewed'
  | 'credential.updated'
  | 'credential.deleted'
  | 'credential.exported'
  | 'data.imported'
  | 'data.exported'
  | 'security.suspicious_activity'
  | 'security.session_hijack_attempt'
  | 'security.xss_attempt'
  | 'security.injection_attempt';

interface SecurityEvent {
  userId: string;
  eventType: SecurityEventType;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  details?: Record<string, unknown>;
  success: boolean;
  timestamp: string;
}

class AuditLogger {
  private pendingLogs: SecurityEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 10;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds

  constructor() {
    // Auto-flush logs periodically
    if (typeof window !== 'undefined') {
      this.flushInterval = setInterval(() => {
        this.flush();
      }, this.FLUSH_INTERVAL);
    }
  }

  /**
   * Log a security event
   */
  async log(
    userId: string,
    eventType: SecurityEventType,
    success: boolean,
    details?: Record<string, unknown>
  ): Promise<void> {
    try {
      // Get client information
      const ipAddress = await this.getClientIP();
      const userAgent = this.getUserAgent();
      const deviceFingerprint = await this.getDeviceFingerprint();

      const event: SecurityEvent = {
        userId,
        eventType,
        ipAddress,
        userAgent,
        deviceFingerprint,
        details: this.sanitizeDetails(details),
        success,
        timestamp: new Date().toISOString()};

      // Add to pending logs
      this.pendingLogs.push(event);

      // Flush if batch size reached
      if (this.pendingLogs.length >= this.BATCH_SIZE) {
        await this.flush();
      }
    } catch (error: unknown) {
      logError('Failed to log security event', error as Error, { eventType, userId });
    }
  }

  /**
   * Sanitize event details to remove sensitive information
   */
  private sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!details) return undefined;

    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'otp', 'masterPassword'];

    for (const [key, value] of Object.entries(details)) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeDetails(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Get client IP address (requires server-side implementation)
   */
  private async getClientIP(): Promise<string | undefined> {
    // Client-side cannot reliably get real IP
    // This would need to be set by server middleware
    return undefined;
  }

  /**
   * Get user agent string
   */
  private getUserAgent(): string | undefined {
    if (typeof window === 'undefined' || !navigator) return undefined;
    return navigator.userAgent;
  }

  /**
   * Get device fingerprint
   */
  private async getDeviceFingerprint(): Promise<string | undefined> {
    try {
      return await getDeviceFingerprint();
    } catch {
      return undefined;
    }
  }

  /**
   * Flush pending logs to database
   */
  async flush(): Promise<void> {
    if (this.pendingLogs.length === 0) return;

    const logsToFlush = [...this.pendingLogs];
    this.pendingLogs = [];

    try {
      // Write logs to database in batch
      await Promise.all(
        logsToFlush.map(event =>
          AppwriteService.createSecurityLog({
            userId: event.userId,
            eventType: event.eventType,
            ipAddress: event.ipAddress || null,
            userAgent: event.userAgent || null,
            details: event.details ? JSON.stringify(event.details) : null,
            timestamp: event.timestamp,
            success: event.success})
        )
      );
    } catch (error: unknown) {
      logError('Failed to flush security logs', error as Error);
      // Put logs back if failed
      this.pendingLogs.unshift(...logsToFlush);
    }
  }

  /**
   * Clean up on unmount
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush(); // Final flush
  }
}

// Export singleton instance
const auditLogger = new AuditLogger();

// Export convenience functions





export const logPasskeyAdded = (userId: string, details?: Record<string, unknown>) =>
  auditLogger.log(userId, 'passkey.added', true, details);







