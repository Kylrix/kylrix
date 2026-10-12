import { describe, it, expect } from 'vitest';
import { PrivacyFilter } from './sanitizer';

describe('PrivacyFilter', () => {
  describe('sanitize - VAULT_ORGANIZE', () => {
    it('sanitizes single credential stripping sensitive fields', () => {
      const sensitiveCred = {
        $id: 'cred_123',
        name: 'GitHub',
        url: 'https://github.com',
        username: 'user@example.com',
        password: 'super-secret-password-123!',
        folderId: 'folder_456',
        notes: 'These are private notes',
        customFields: { pin: '1234' },
      };

      const sanitized = PrivacyFilter.sanitize('VAULT_ORGANIZE', sensitiveCred) as any[];

      expect(sanitized).toHaveLength(1);
      expect(sanitized[0]).toEqual({
        id: 'cred_123',
        name: 'GitHub',
        url: 'https://github.com',
        currentFolder: 'folder_456',
      });
      expect(sanitized[0]).not.toHaveProperty('password');
      expect(sanitized[0]).not.toHaveProperty('username');
      expect(sanitized[0]).not.toHaveProperty('notes');
      expect(sanitized[0]).not.toHaveProperty('customFields');
    });

    it('sanitizes array of credentials stripping passwords and notes from all entries', () => {
      const creds = [
        {
          $id: 'c1',
          name: 'App 1',
          url: 'https://app1.com',
          username: 'u1',
          password: 'p1',
          folderId: 'f1',
        },
        {
          $id: 'c2',
          name: 'App 2',
          url: 'https://app2.com',
          username: 'u2',
          password: 'p2',
          folderId: 'f2',
        },
      ];

      const sanitized = PrivacyFilter.sanitize('VAULT_ORGANIZE', creds) as any[];

      expect(sanitized).toHaveLength(2);
      expect(sanitized[0]).toEqual({
        id: 'c1',
        name: 'App 1',
        url: 'https://app1.com',
        currentFolder: 'f1',
      });
      expect(sanitized[1]).toEqual({
        id: 'c2',
        name: 'App 2',
        url: 'https://app2.com',
        currentFolder: 'f2',
      });
    });
  });

  describe('sanitize - URL_SAFETY', () => {
    it('handles string input', () => {
      const sanitized = PrivacyFilter.sanitize('URL_SAFETY', 'https://example.com/login');
      expect(sanitized).toEqual({ url: 'https://example.com/login' });
    });

    it('handles object input', () => {
      const sanitized = PrivacyFilter.sanitize('URL_SAFETY', {
        url: 'https://example.com/dashboard',
        other: 'ignored',
      });
      expect(sanitized).toEqual({ url: 'https://example.com/dashboard' });
    });

    it('returns empty url when input object has no url property', () => {
      const sanitized = PrivacyFilter.sanitize('URL_SAFETY', { foo: 'bar' });
      expect(sanitized).toEqual({ url: '' });
    });
  });

  describe('sanitize - PASSWORD_AUDIT', () => {
    it('handles string password input', () => {
      const sanitized = PrivacyFilter.sanitize('PASSWORD_AUDIT', 'mypassword123');
      expect(sanitized).toEqual({ password: 'mypassword123' });
    });

    it('handles object input with password property', () => {
      const sanitized = PrivacyFilter.sanitize('PASSWORD_AUDIT', {
        password: 'mypassword123',
        username: 'john',
      });
      expect(sanitized).toEqual({ password: 'mypassword123' });
    });
  });

  describe('sanitize - GENERAL_QUERY & COMMAND_INTENT', () => {
    it('returns null for GENERAL_QUERY to prevent data context leakage', () => {
      const result = PrivacyFilter.sanitize('GENERAL_QUERY', { secret: 'data' });
      expect(result).toBeNull();
    });

    it('returns null for COMMAND_INTENT to prevent data context leakage', () => {
      const result = PrivacyFilter.sanitize('COMMAND_INTENT', { secret: 'data' });
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns null for falsy data', () => {
      expect(PrivacyFilter.sanitize('VAULT_ORGANIZE', null)).toBeNull();
      expect(PrivacyFilter.sanitize('VAULT_ORGANIZE', undefined)).toBeNull();
    });

    it('throws error for unsupported analysis mode', () => {
      expect(() =>
        PrivacyFilter.sanitize('UNKNOWN_MODE' as any, { test: 1 }),
      ).toThrow('Unsupported analysis mode: UNKNOWN_MODE');
    });
  });
});
