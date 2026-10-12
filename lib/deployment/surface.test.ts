import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isSelfHostedDeployment,
  isIntegratedBackend,
  isDogfoodSafetyActive,
  isBillingCommerceEnabled,
  isKylrixCloud,
} from './surface';

describe('deployment/surface', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('isSelfHostedDeployment', () => {
    it('returns true when NEXT_PUBLIC_SELFHOSTED env var is true in client context', () => {
      process.env.NEXT_PUBLIC_SELFHOSTED = 'true';
      expect(isSelfHostedDeployment()).toBe(true);
    });

    it('returns true when NEXT_PUBLIC_SELFHOST_MODE env var is 1 in client context', () => {
      process.env.NEXT_PUBLIC_SELFHOST_MODE = '1';
      expect(isSelfHostedDeployment()).toBe(true);
    });

    it('returns false when no self-host env variables are set', () => {
      delete process.env.SELFHOSTED;
      delete process.env.SELFHOST_MODE;
      delete process.env.NEXT_PUBLIC_SELFHOSTED;
      delete process.env.NEXT_PUBLIC_SELFHOST_MODE;
      expect(isSelfHostedDeployment()).toBe(false);
    });
  });

  describe('isIntegratedBackend', () => {
    it('returns true when NEXT_PUBLIC_BACKEND env is true', () => {
      process.env.NEXT_PUBLIC_BACKEND = 'true';
      expect(isIntegratedBackend()).toBe(true);
    });

    it('returns false when NEXT_PUBLIC_BACKEND env is false', () => {
      process.env.NEXT_PUBLIC_BACKEND = 'false';
      expect(isIntegratedBackend()).toBe(false);
    });
  });

  describe('isDogfoodSafetyActive', () => {
    it('detects NEXT_PUBLIC_DOGFOOD_SAFETY flag on client', () => {
      process.env.NEXT_PUBLIC_DOGFOOD_SAFETY = 'true';
      expect(isDogfoodSafetyActive()).toBe(true);
    });

    it('detects __KYLRIX_DOGFOOD_SAFETY__ on global window', () => {
      delete process.env.NEXT_PUBLIC_DOGFOOD_SAFETY;
      (window as any).__KYLRIX_DOGFOOD_SAFETY__ = true;
      expect(isDogfoodSafetyActive()).toBe(true);
      delete (window as any).__KYLRIX_DOGFOOD_SAFETY__;
    });

    it('returns false when DOGFOOD_SAFETY is unset or false', () => {
      delete process.env.DOGFOOD_SAFETY;
      delete process.env.NEXT_PUBLIC_DOGFOOD_SAFETY;
      delete (window as any).__KYLRIX_DOGFOOD_SAFETY__;
      expect(isDogfoodSafetyActive()).toBe(false);
    });
  });

  describe('isBillingCommerceEnabled', () => {
    it('returns false for self-hosted client deployments', () => {
      process.env.NEXT_PUBLIC_SELFHOSTED = 'true';
      process.env.NEXT_PUBLIC_PRICING_TIERS_ENABLED = 'true';
      expect(isBillingCommerceEnabled()).toBe(false);
    });
  });

  describe('isKylrixCloud', () => {
    it('returns true when NEXT_PUBLIC_KYLRIX_CLOUD env variable is true', () => {
      process.env.NEXT_PUBLIC_KYLRIX_CLOUD = 'true';
      expect(isKylrixCloud()).toBe(true);
    });

    it('returns true when window location hostname matches kylrix.space', () => {
      delete process.env.NEXT_PUBLIC_KYLRIX_CLOUD;
      delete (window as any).__KYLRIX_CLOUD__;
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        value: { hostname: 'app.kylrix.space' },
        writable: true,
        configurable: true,
      });

      expect(isKylrixCloud()).toBe(true);

      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      });
    });

    it('returns false when cloud flags are absent and hostname is localhost', () => {
      delete process.env.KYLRIX_CLOUD;
      delete process.env.NEXT_PUBLIC_KYLRIX_CLOUD;
      delete (window as any).__KYLRIX_CLOUD__;
      expect(isKylrixCloud()).toBe(false);
    });
  });
});
