import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import logger, { logDebug, logInfo, logWarn, logError, setErrorTrackingHandler, SecureLogger } from './logger';

describe('SecureLogger', () => {
  const originalEnv = process.env;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env = { ...originalEnv };
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    setErrorTrackingHandler(null);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Sanitization', () => {
    it('redacts sensitive fields in logging context', () => {
      process.env.NODE_ENV = 'development';
      const testLogger = new SecureLogger();
      const rawContext = {
        user: 'alice',
        password: 'super-secret-password',
        apiToken: 'bearer-xyz-123',
        nested: {
          masterPassword: 'vault-master-pass',
          normalProp: 'visible',
        },
      };

      testLogger.debug('Testing context sanitization', rawContext);

      expect(console.debug).toHaveBeenCalled();
      const consoleArgs = (console.debug as ReturnType<typeof vi.fn>).mock.calls[0];
      const sanitized = consoleArgs[1];

      expect(sanitized.user).toBe('alice');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiToken).toBe('[REDACTED]');
      expect(sanitized.nested.masterPassword).toBe('[REDACTED]');
      expect(sanitized.nested.normalProp).toBe('visible');
    });
  });

  describe('Development vs Production behavior', () => {
    it('logs to console in development mode', () => {
      process.env.NODE_ENV = 'development';
      const devLogger = new SecureLogger();

      devLogger.debug('Debug msg');
      devLogger.info('Info msg');
      devLogger.warn('Warn msg');
      devLogger.error('Error msg');

      expect(console.debug).toHaveBeenCalledWith('[DEBUG] Debug msg', '');
      expect(console.info).toHaveBeenCalledWith('[INFO] Info msg', '');
      expect(console.warn).toHaveBeenCalledWith('[WARN] Warn msg', '');
      expect(console.error).toHaveBeenCalledWith('[ERROR] Error msg', undefined, '');
    });

    it('does not log debug/info to console in production mode', () => {
      process.env.NODE_ENV = 'production';
      const prodLogger = new SecureLogger();

      prodLogger.debug('Debug msg');
      prodLogger.info('Info msg');

      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
    });
  });

  describe('Custom Error Tracking Handler', () => {
    it('invokes registered custom error tracking handler on warn/error in production', () => {
      process.env.NODE_ENV = 'production';
      const prodLogger = new SecureLogger();
      const handlerMock = vi.fn();

      prodLogger.setErrorTrackingHandler(handlerMock);
      expect(prodLogger.getErrorTrackingHandler()).toBe(handlerMock);

      prodLogger.warn('Warning triggered', { meta: 'data' });
      expect(handlerMock).toHaveBeenCalledWith('warn', 'Warning triggered', { meta: 'data' });

      const testError = new Error('Test Failure');
      prodLogger.error('Error occurred', testError, { userId: '123' });
      expect(handlerMock).toHaveBeenCalledWith('error', 'Error occurred', {
        error: testError,
        context: { userId: '123' },
      });
    });

    it('handles exceptions thrown by custom error tracking handler gracefully', () => {
      process.env.NODE_ENV = 'production';
      const prodLogger = new SecureLogger();
      const throwingHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler crash');
      });

      prodLogger.setErrorTrackingHandler(throwingHandler);

      expect(() => {
        prodLogger.warn('Should not throw despite handler failure');
      }).not.toThrow();
    });
  });

  describe('Sentry DSN Error Tracking', () => {
    it('parses Sentry DSN and sends formatted warning payload via fetch', () => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://abc123key@sentry.io/45012345';
      const prodLogger = new SecureLogger();

      prodLogger.warn('Database latency high', { queryTimeMs: 450 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];

      expect(url).toBe('https://sentry.io/api/45012345/store/?sentry_version=7&sentry_key=abc123key');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' });

      const body = JSON.parse(options.body);
      expect(body.level).toBe('warning');
      expect(body.message).toEqual({ formatted: 'Database latency high' });
      expect(body.extra).toEqual({ queryTimeMs: 450 });
      expect(body.platform).toBe('javascript');
      expect(body.event_id).toHaveLength(32);
    });

    it('sends exception stack traces in Sentry error payloads', () => {
      process.env.NODE_ENV = 'production';
      process.env.SENTRY_DSN = 'https://mykey@o1234.ingest.sentry.io/999999';
      const prodLogger = new SecureLogger();

      const err = new TypeError('Invalid option supplied');
      prodLogger.error('Operation failed', err, { attempts: 3 });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0];
      const body = JSON.parse(options.body);

      expect(body.level).toBe('error');
      expect(body.message).toEqual({ formatted: 'Operation failed' });
      expect(body.exception).toBeDefined();
      expect(body.exception.values[0].type).toBe('TypeError');
      expect(body.exception.values[0].value).toBe('Invalid option supplied');
      expect(body.exception.values[0].stacktrace).toBeDefined();
    });
  });

  describe('Generic HTTP Error Tracking Endpoint', () => {
    it('sends generic HTTP error tracking payload when ERROR_TRACKING_URL is configured', () => {
      process.env.NODE_ENV = 'production';
      process.env.ERROR_TRACKING_URL = 'https://telemetry.example.com/api/errors';
      const prodLogger = new SecureLogger();

      prodLogger.warn('Service degradation detected', { service: 'vault' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];

      expect(url).toBe('https://telemetry.example.com/api/errors');
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.level).toBe('warn');
      expect(body.message).toBe('Service degradation detected');
      expect(body.data).toEqual({ service: 'vault' });
      expect(body.environment).toBe('production');
    });
  });

  describe('Network and Parsing Error Resilience', () => {
    it('swallows network rejects silently without throwing unhandled rejections', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ERROR_TRACKING_URL = 'https://unreachable-host.local/errors';
      fetchMock.mockRejectedValue(new Error('Network error'));

      const prodLogger = new SecureLogger();

      expect(() => {
        prodLogger.warn('Network issue test');
      }).not.toThrow();
    });
  });

  describe('Exported Utility Functions', () => {
    it('correctly dispatches via exported logDebug, logWarn, logError, and setErrorTrackingHandler', () => {
      const handler = vi.fn();
      setErrorTrackingHandler(handler);

      process.env.NODE_ENV = 'production';
      logWarn('Exported warn test', { val: 42 });
      expect(handler).toHaveBeenCalledWith('warn', 'Exported warn test', { val: 42 });

      const err = new Error('Exported error test');
      logError('Exported error test', err);
      expect(handler).toHaveBeenCalledWith('error', 'Exported error test', { error: err, context: undefined });
    });
  });
});
