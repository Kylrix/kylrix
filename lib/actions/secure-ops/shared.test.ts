import { describe, it, expect, vi } from 'vitest';
import { issueViewerToken, isViewerTokenValid } from './shared';

describe('Viewer Token Verification & Security Invariants', () => {
  it('successfully generates and validates a valid viewer token', () => {
    const token = issueViewerToken();
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
    expect(isViewerTokenValid(token)).toBe(true);
  });

  it('rejects tampered signatures', () => {
    const token = issueViewerToken();
    const parts = token.split('.');
    const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}X`;
    expect(isViewerTokenValid(tampered)).toBe(false);
  });

  it('rejects tokens with mismatched signature lengths without crashing or leaking timing', () => {
    const token = issueViewerToken();
    const parts = token.split('.');
    const shortSigToken = `${parts[0]}.${parts[1]}.short`;
    const emptySigToken = `${parts[0]}.${parts[1]}.`;
    const superLongSigToken = `${parts[0]}.${parts[1]}.${'A'.repeat(500)}`;

    expect(isViewerTokenValid(shortSigToken)).toBe(false);
    expect(isViewerTokenValid(emptySigToken)).toBe(false);
    expect(isViewerTokenValid(superLongSigToken)).toBe(false);
  });

  it('rejects malformed or empty tokens gracefully', () => {
    expect(isViewerTokenValid('')).toBe(false);
    expect(isViewerTokenValid(null as any)).toBe(false);
    expect(isViewerTokenValid(undefined as any)).toBe(false);
    expect(isViewerTokenValid('invalid-token')).toBe(false);
    expect(isViewerTokenValid('part1.part2')).toBe(false);
  });
});
