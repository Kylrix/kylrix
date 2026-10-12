import { describe, expect, it } from 'vitest';
import { computeIdentityFlags, getUserProfilePicId, normalizeUsername, shortenUserId } from './index';

describe('identity helpers', () => {
  it('normalizes usernames', () => {
    expect(normalizeUsername('@Kylrix')).toBe('kylrix');
    expect(normalizeUsername('@@User')).toBe('user');
    expect(normalizeUsername(null)).toBeNull();
    expect(normalizeUsername('')).toBeNull();
  });

  it('resolves the best avatar source', () => {
    expect(getUserProfilePicId(null)).toBeNull();
    expect(getUserProfilePicId({})).toBeNull();
    expect(getUserProfilePicId({ avatarFileId: 'file-id' })).toBe('file-id');
    expect(getUserProfilePicId({ avatarUrl: 'avatar-url' })).toBe('avatar-url');
    expect(getUserProfilePicId({ profilePicId: 'pic-id' })).toBe('pic-id');
    expect(getUserProfilePicId({ avatar: 'avatar-id' })).toBe('avatar-id');
    expect(getUserProfilePicId({ prefs: { profilePicId: 'prefs-id' } })).toBe('prefs-id');
    expect(getUserProfilePicId({ preferences: { profilePicId: 'preferences-id' } })).toBe('preferences-id');
  });

  it('shortens ids consistently', () => {
    expect(shortenUserId(null)).toBe('local');
    expect(shortenUserId('')).toBe('local');
    expect(shortenUserId('shortid')).toBe('shortid');
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

    const unverified = computeIdentityFlags({
      createdAt: null,
      tier: 'free',
    });
    expect(unverified.verified).toBe(false);
    expect(unverified.pro).toBe(false);
  });
});
