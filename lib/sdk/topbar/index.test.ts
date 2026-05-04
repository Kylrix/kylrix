import { describe, expect, it, vi } from 'vitest';
import { createConnectTopbarSurface, createTopbarAction, createTopbarSurface, topbarMatches } from './index';

describe('topbar helpers', () => {
  it('matches queries against terms', () => {
    expect(topbarMatches('note', ['notes', 'shared'])).toBe(true);
    expect(topbarMatches('vault', ['note', 'flow'])).toBe(false);
  });

  it('fills in action accent defaults', () => {
    const action = createTopbarAction({
      id: 'draft',
      kind: 'note',
      title: 'Draft a note',
      description: 'Capture a note',
      terms: ['draft'],
      onSelect: vi.fn(),
      app: 'note',
    });

    expect(action.accent).toBe('#EC4899');
  });

  it('attaches the shared layout model', () => {
    const surface = createTopbarSurface({
      routeLabel: 'Notes',
      currentApp: 'note',
      snippets: [],
      quickActions: [],
      searchTargets: [],
    });

    expect(surface.layout.height).toBe(88);
    expect(surface.layout.searchDockMaxHeight).toBe('50vh');
  });

  it('creates a connect topbar surface', () => {
    const surface = createConnectTopbarSurface({
      identity: {
        displayName: 'Kylrix User',
        username: 'kylrix',
        walletConnected: true,
      },
    });

    expect(surface.currentApp).toBe('connect');
    expect(surface.identity.displayName).toBe('Kylrix User');
    expect(surface.showConnectCta).toBe(false);
  });
});
