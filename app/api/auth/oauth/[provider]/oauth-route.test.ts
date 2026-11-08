import { describe, it, expect } from 'vitest';
import { sanitizeCallbackUrl } from './[provider]/route';

describe('sanitizeCallbackUrl', () => {
  it('allows valid relative paths', () => {
    expect(sanitizeCallbackUrl('/app')).toBe('/app');
    expect(sanitizeCallbackUrl('/settings?tab=identities')).toBe('/settings?tab=identities');
    expect(sanitizeCallbackUrl('/app?auth=success')).toBe('/app?auth=success');
  });

  it('defaults to /app for null, undefined, or empty values', () => {
    expect(sanitizeCallbackUrl(null)).toBe('/app');
    expect(sanitizeCallbackUrl(undefined)).toBe('/app');
    expect(sanitizeCallbackUrl('')).toBe('/app');
    expect(sanitizeCallbackUrl('   ')).toBe('/app');
  });

  it('rejects absolute URLs (http / https / javascript / data)', () => {
    expect(sanitizeCallbackUrl('https://evil.com')).toBe('/app');
    expect(sanitizeCallbackUrl('http://evil.com/app')).toBe('/app');
    expect(sanitizeCallbackUrl('javascript:alert(1)')).toBe('/app');
    expect(sanitizeCallbackUrl('data:text/html,<script>alert(1)</script>')).toBe('/app');
  });

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeCallbackUrl('//evil.com')).toBe('/app');
    expect(sanitizeCallbackUrl('//evil.com/app')).toBe('/app');
  });

  it('rejects backslash evasion attempts', () => {
    expect(sanitizeCallbackUrl('/\\evil.com')).toBe('/app');
    expect(sanitizeCallbackUrl('/\\/evil.com')).toBe('/app');
  });

  it('rejects whitespace and tab evasion attempts', () => {
    expect(sanitizeCallbackUrl('/\t/evil.com')).toBe('/app');
    expect(sanitizeCallbackUrl('/\r/evil.com')).toBe('/app');
    expect(sanitizeCallbackUrl('/\n/evil.com')).toBe('/app');
    expect(sanitizeCallbackUrl('/ /evil.com')).toBe('/app');
  });

  it('rejects URLs without a leading slash', () => {
    expect(sanitizeCallbackUrl('evil.com')).toBe('/app');
    expect(sanitizeCallbackUrl('app/dashboard')).toBe('/app');
  });
});
