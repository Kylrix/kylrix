/**
 * Secure logging utility for production applications
 * Only logs in development environment
 * Never logs sensitive data
 * Integrates with production error tracking services (Sentry, generic HTTP intake endpoints, custom handlers)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export type ErrorTrackingHandler = (level: LogLevel, message: string, data?: unknown) => void | Promise<void>;

interface ParsedSentryDsn {
  endpoint: string;
  publicKey: string;
}

/**
 * Parses a Sentry DSN string into endpoint URL and public key.
 * Expected format: https://<public_key>@<host>/<project_id>
 */
function parseSentryDsn(dsn: string): ParsedSentryDsn | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, '');
    if (!publicKey || !projectId) return null;
    const endpoint = `${url.protocol}//${url.host}/api/${projectId}/store/?sentry_version=7&sentry_key=${publicKey}`;
    return { endpoint, publicKey };
  } catch {
    return null;
  }
}

/**
 * Helper to generate a 32-character hex ID for Sentry event IDs
 */
function generateEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

export class SecureLogger {
  private isDevelopment: boolean;
  private customHandler: ErrorTrackingHandler | null = null;
  private sensitiveKeys = new Set([
    'password',
    'token',
    'secret',
    'key',
    'masterPassword',
    'masterKey',
    'otp',
    'mfa',
    'credential',
    'authorization',
    'cookie',
    'session',
  ]);

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  /**
   * Register a custom error tracking handler callback
   */
  setErrorTrackingHandler(handler: ErrorTrackingHandler | null): void {
    this.customHandler = handler;
  }

  /**
   * Get current error tracking handler callback
   */
  getErrorTrackingHandler(): ErrorTrackingHandler | null {
    return this.customHandler;
  }

  /**
   * Check if a key contains sensitive information
   */
  private isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return Array.from(this.sensitiveKeys).some(sensitive => 
      lowerKey.includes(sensitive)
    );
  }

  /**
   * Sanitize context object by removing sensitive keys
   */
  private sanitizeContext(context: LogContext): LogContext {
    const sanitized: LogContext = {};
    for (const [key, value] of Object.entries(context)) {
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value as LogContext);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Log debug message (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      const sanitized = context ? this.sanitizeContext(context) : undefined;
      console.debug(`[DEBUG] ${message}`, sanitized || '');
    }
  }

  /**
   * Log info message (development only)
   */
  info(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      const sanitized = context ? this.sanitizeContext(context) : undefined;
      console.info(`[INFO] ${message}`, sanitized || '');
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    const sanitized = context ? this.sanitizeContext(context) : undefined;
    if (this.isDevelopment) {
      console.warn(`[WARN] ${message}`, sanitized || '');
    } else {
      this.sendToErrorTracking('warn', message, sanitized);
    }
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const sanitized = context ? this.sanitizeContext(context) : undefined;
    
    if (this.isDevelopment) {
      console.error(`[ERROR] ${message}`, error, sanitized || '');
    } else {
      this.sendToErrorTracking('error', message, { error, context: sanitized });
    }
  }

  /**
   * Production error tracking integration
   * Dispatches warning & error events to Sentry, configured error tracking URLs, or custom handlers.
   */
  private sendToErrorTracking(level: LogLevel, message: string, data?: unknown): void {
    // 1. Invoke custom error tracking handler if registered
    if (this.customHandler) {
      try {
        this.customHandler(level, message, data);
      } catch {
        // Ignore custom handler errors to prevent app crashes
      }
    }

    // 2. Check Sentry DSN configuration
    const sentryDsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
    if (sentryDsn) {
      const parsed = parseSentryDsn(sentryDsn);
      if (parsed) {
        try {
          let extractedError: Error | undefined;
          if (data && typeof data === 'object') {
            if ('error' in data && (data as { error?: unknown }).error instanceof Error) {
              extractedError = (data as { error?: Error }).error;
            } else if (data instanceof Error) {
              extractedError = data;
            }
          }

          const payload: Record<string, unknown> = {
            event_id: generateEventId(),
            timestamp: new Date().toISOString(),
            platform: 'javascript',
            level: level === 'warn' ? 'warning' : 'error',
            message: { formatted: message },
            environment: process.env.NODE_ENV || 'production',
            extra: data,
          };

          if (extractedError) {
            payload.exception = {
              values: [
                {
                  type: extractedError.name || 'Error',
                  value: extractedError.message || String(extractedError),
                  stacktrace: extractedError.stack
                    ? {
                        frames: extractedError.stack.split('\n').map(line => ({
                          filename: line.trim(),
                        })),
                      }
                    : undefined,
                },
              ],
            };
          }

          fetch(parsed.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).catch(() => {
            // Silently swallow network errors
          });
        } catch {
          // Silently swallow parsing/serialization errors
        }
      }
    }

    // 3. Check generic HTTP error tracking URL endpoint
    const errorTrackingUrl = process.env.ERROR_TRACKING_URL || process.env.NEXT_PUBLIC_ERROR_TRACKING_URL;
    if (errorTrackingUrl) {
      try {
        const payload = {
          level,
          message,
          data,
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'production',
        };

        fetch(errorTrackingUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {
          // Silently swallow network errors
        });
      } catch {
        // Silently swallow errors
      }
    }

    // In development mode, also output to console for local debugging
    if (this.isDevelopment) {
      console.log('[ERROR_TRACKING]', level, message, data);
    }
  }
}

// Export singleton instance
const logger = new SecureLogger();

// Export utility functions
export const logDebug = (message: string, context?: LogContext) => logger.debug(message, context);
export const logWarn = (message: string, context?: LogContext) => logger.warn(message, context);
export const logError = (message: string, error?: Error, context?: LogContext) => logger.error(message, error, context);
export const setErrorTrackingHandler = (handler: ErrorTrackingHandler | null) => logger.setErrorTrackingHandler(handler);

export default logger;
