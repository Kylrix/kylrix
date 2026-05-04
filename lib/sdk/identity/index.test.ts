import { describe, expect, it } from 'vitest';
import { computeIdentityFlags, getUserProfilePicId, normalizeUsername, shortenUserId } from './index';

describe('identity helpers', () => {
  it('normalizes usernames', () => {
    expect(normalizeUsername('@Kylrix')).toBe('kylrix');
  });

  it('resolves the best avatar source', () => {
    expect(getUserProfilePicId({ prefs: { profilePicId: 'prefs-id' } })).toBe('prefs-id');
    expect(getUserProfilePicId({ avatarUrl: 'avatar-url' })).toBe('avatar-url');
  });

  it('shortens ids consistently', () => {
    expect(shortenUserId('1234567890abcdef')).toBe('123456…cdef');
  });

  it('derives profile flags from the signal bundle', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const flags = computeIdentityFlags({
      createdAt: thirtyOneDaysAgo,
      lastUsernameEdit: thirtyOneDaysAgo,
      profilePicId: 'file-1',
      username: 'kylrix',
      bio: 'builds things',
      tier: 'pro',
    });

    expect(flags.verified).toBe(true);
    expect(flags.pro).toBe(true);
  });
});
