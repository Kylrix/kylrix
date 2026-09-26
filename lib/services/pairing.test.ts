import { describe, it, expect } from 'vitest';
import { normalizeUserCode } from './pairing';

describe('Pairing Service User Code Normalization & Entropy', () => {
  it('normalizes 8-character codes without hyphen to XXXX-XXXX format', () => {
    expect(normalizeUserCode('7K9M4W2P')).toBe('7K9M-4W2P');
    expect(normalizeUserCode('7k9m4w2p')).toBe('7K9M-4W2P');
    expect(normalizeUserCode('  7k9m4w2p  ')).toBe('7K9M-4W2P');
  });

  it('preserves and trims existing hyphenated codes', () => {
    expect(normalizeUserCode('7K9M-4W2P')).toBe('7K9M-4W2P');
    expect(normalizeUserCode('  7k9m-4w2p  ')).toBe('7K9M-4W2P');
    expect(normalizeUserCode('7k9m - 4w2p')).toBe('7K9M-4W2P');
  });

  it('preserves legacy KYL- prefix codes for backward compatibility', () => {
    expect(normalizeUserCode('KYL-GWRP')).toBe('KYL-GWRP');
    expect(normalizeUserCode('kyl-gwrp')).toBe('KYL-GWRP');
  });

  it('normalizes wildcard "*" and "all" to all catalog PAT scopes', async () => {
    const { normalizeScopes, PAT_SCOPES } = await import('@/lib/api/scopes');
    const fromStar = normalizeScopes(['*']);
    expect(fromStar.length).toBe(PAT_SCOPES.length);
    expect(fromStar).toEqual(PAT_SCOPES);

    const fromAll = normalizeScopes('all');
    expect(fromAll.length).toBe(PAT_SCOPES.length);

    const fromJson = normalizeScopes('["*"]');
    expect(fromJson.length).toBe(PAT_SCOPES.length);
  });
});
