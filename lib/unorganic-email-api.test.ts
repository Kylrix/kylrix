import { describe, it, expect } from 'vitest';
import { redactSensitiveEnvContent } from './unorganic-email-api';

describe('redactSensitiveEnvContent', () => {
  it('handles empty or non-string inputs', () => {
    expect(redactSensitiveEnvContent('')).toBe('');
    expect(redactSensitiveEnvContent(null as any)).toBe('');
    expect(redactSensitiveEnvContent(undefined as any)).toBe('');
  });

  it('leaves normal messages intact', () => {
    const text = 'Hey there! How is the project coming along? Let us sync at 3 PM.';
    expect(redactSensitiveEnvContent(text)).toBe(text);
  });

  it('redacts KEY=VALUE environment variable lines', () => {
    const text = 'Check out these configs:\nDATABASE_URL=postgres://user:pass@localhost:5432/db\nexport API_KEY=secret_123\nOTHER_FLAG=true';
    const redacted = redactSensitiveEnvContent(text);
    expect(redacted).toContain('DATABASE_URL=[REDACTED_ENV]');
    expect(redacted).toContain('API_KEY=[REDACTED_ENV]');
    expect(redacted).toContain('OTHER_FLAG=[REDACTED_ENV]');
    expect(redacted).not.toContain('postgres://user:pass@localhost:5432/db');
    expect(redacted).not.toContain('secret_123');
  });

  it('redacts API key and token patterns', () => {
    const text = 'My OpenAI key is sk-1234567890abcdef123456 and github token is ghp_1234567890abcdef1234567890';
    const redacted = redactSensitiveEnvContent(text);
    expect(redacted).toContain('[REDACTED_SECRET]');
    expect(redacted).not.toContain('sk-1234567890abcdef123456');
    expect(redacted).not.toContain('ghp_1234567890abcdef1234567890');
  });

  it('redacts JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const text = `Here is your auth token: ${jwt}`;
    const redacted = redactSensitiveEnvContent(text);
    expect(redacted).toContain('[REDACTED_TOKEN]');
    expect(redacted).not.toContain(jwt);
  });

  it('redacts DB URIs and Private Keys', () => {
    const dbUri = 'postgres://admin:supersecret@db.internal:5432/production';
    const privateKey = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----';
    const text = `DB_URL=${dbUri}\nKey:\n${privateKey}`;
    const redacted = redactSensitiveEnvContent(text);
    expect(redacted).toContain('DB_URL=[REDACTED_ENV]');
    expect(redacted).toContain('[REDACTED_PRIVATE_KEY]');
    expect(redacted).not.toContain('supersecret');
  });
});
