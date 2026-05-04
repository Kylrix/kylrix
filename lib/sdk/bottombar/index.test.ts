import { describe, expect, it } from 'vitest';
import { bottomBarMatches, createBottomBarSurface, getBottomBarViewportOffset } from './index';

describe('bottom bar helpers', () => {
  it('marks matching items as active', () => {
    const surface = createBottomBarSurface({
      activeHref: '/shared',
      items: [
        { id: 'notes', label: 'Notes', href: '/notes' },
        { id: 'shared', label: 'Shared', href: '/shared' },
      ],
    });

    expect(surface.items[1].active).toBe(true);
    expect(surface.items[0].active).toBe(false);
  });

  it('matches nested routes', () => {
    expect(bottomBarMatches('/shared/123', '/shared')).toBe(true);
    expect(bottomBarMatches('/notes', '/shared')).toBe(false);
  });

  it('falls back safely without a viewport', () => {
    expect(getBottomBarViewportOffset(null)).toBe(0);
  });
});
