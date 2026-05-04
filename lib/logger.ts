/**
 * Secure logging utility for production applications
 * Only logs in development environment
 * Never logs sensitive data
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class SecureLogger {
  private isDevelopment: boolean;
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
      // In production, send to error tracking service (e.g., Sentry)
      // This is a placeholder for production error tracking
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
      // In production, send to error tracking service
      this.sendToErrorTracking('error', message, { error, context: sanitized });
    }
  }

  /**
   * Placeholder for production error tracking integration
   * Replace with actual error tracking service (Sentry, DataDog, etc.)
   */
  private sendToErrorTracking(level: LogLevel, message: string, data?: unknown): void {
    // TODO: Integrate with error tracking service
    // Example: Sentry.captureException(message, { level, extra: data });
    
    // For now, just ensure nothing is logged to console in production
    if (this.isDevelopment) {
      console.log('[ERROR_TRACKING]', level, message, data);
    }
  }
}

// Export singleton instance
export const logger = new SecureLogger();

// Export utility functions
export const logDebug = (message: string, context?: LogContext) => logger.debug(message, context);
export const logInfo = (message: string, context?: LogContext) => logger.info(message, context);
export const logWarn = (message: string, context?: LogContext) => logger.warn(message, context);
export const logError = (message: string, error?: Error, context?: LogContext) => logger.error(message, error, context);
