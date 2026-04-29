import { describe, expect, it } from 'vitest';

import { SDK_SECTIONS, getSdkSection } from './catalog';

describe('SDK catalog', () => {
  it('exposes the core sdk sections in order', () => {
    expect(SDK_SECTIONS.map((section) => section.id)).toEqual([
      'design',
      'topbar',
      'fab',
      'profile-preview',
      'ecosystem',
      'security',
      'messaging',
      'social',
      'huddles',
      'extensions',
    ]);
  });

  it('returns the first section as a safe fallback', () => {
    expect(getSdkSection('missing-section').id).toBe('design');
    expect(getSdkSection('topbar').sourceHref).toContain('/topbar/index.ts');
  });
});
