import { describe, it, expect } from 'vitest';
import { extractNormalizedProfile } from './profile-utils';

describe('extractNormalizedProfile', () => {
  it('extracts and normalizes profile data correctly', () => {
    const rawProfile = {
      displayName: 'Jane Doe',
      username: 'janedoe',
      bio: 'Building sovereign AI engines',
      avatar: 'https://example.com/avatar.jpg',
      website: 'https://janedoe.dev',
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      socialLinks: JSON.stringify({
        github: 'janedoe',
        twitter: '@janedoe_ai',
        telegram: 'janedoe_tg',
        linkedin: 'janedoe-linkedin'
      }),
      preferences: JSON.stringify({
        location: 'San Francisco, CA',
        tags: ['ai', 'crypto'],
        links: [
          { title: 'My Portfolio', url: 'https://janedoe.dev' },
          { title: 'Blog', url: 'blog.janedoe.dev' }
        ]
      })
    };

    const norm = extractNormalizedProfile(rawProfile);

    expect(norm.displayName).toBe('Jane Doe');
    expect(norm.username).toBe('janedoe');
    expect(norm.location).toBe('San Francisco, CA');
    expect(norm.walletAddress).toBe('0x1234567890abcdef1234567890abcdef12345678');
    expect(norm.tags).toEqual(['ai', 'crypto']);
    expect(norm.socials.github).toBe('janedoe');
    expect(norm.socials.twitter).toBe('@janedoe_ai');

    // Verify link deduplication and formatting
    const githubLink = norm.links.find(l => l.type === 'github');
    expect(githubLink?.url).toBe('https://github.com/janedoe');

    const twitterLink = norm.links.find(l => l.type === 'twitter');
    expect(twitterLink?.url).toBe('https://x.com/janedoe_ai');

    const telegramLink = norm.links.find(l => l.type === 'telegram');
    expect(telegramLink?.url).toBe('https://t.me/janedoe_tg');

    const blogLink = norm.links.find(l => l.title === 'Blog');
    expect(blogLink?.url).toBe('https://blog.janedoe.dev');
  });

  it('handles empty or missing profile gracefully', () => {
    const norm = extractNormalizedProfile(null);
    expect(norm.displayName).toBe('Kylrix User');
    expect(norm.links).toEqual([]);
    expect(norm.tags).toEqual([]);
  });
});
