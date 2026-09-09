import { describe, expect, it, vi } from 'vitest';
import {
  createConnectTopbarSurface,
  createTopbarAction,
  createTopbarSurface,
  createEcosystemPanelItems,
  createTopbarPanelMotion,
  createTopbarSearchSurface,
  isTopbarScrollAtTop,
  topbarMatches,
} from './index';

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

    const defaultAccent = createTopbarAction({
      id: 'custom',
      kind: 'custom',
      title: 'Title',
      description: 'Desc',
      terms: ['custom'],
      onSelect: vi.fn(),
    });
    expect(defaultAccent.accent).toBeDefined();
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

    const disconnectedSurface = createConnectTopbarSurface({
      identity: {
        displayName: 'Guest',
        walletConnected: false,
      },
    });
    expect(disconnectedSurface.showConnectCta).toBe(true);
  });

  it('creates ecosystem panel items with selected indicator', () => {
    const items = createEcosystemPanelItems('vault');
    expect(items.length).toBe(5);
    expect(items.find((i) => i.app === 'vault')?.selected).toBe(true);
    expect(items.find((i) => i.app === 'note')?.selected).toBe(false);
  });

  it('creates topbar panel motion object', () => {
    const motion = createTopbarPanelMotion();
    expect(motion.initial.opacity).toBe(0);
    expect(motion.animate.opacity).toBe(1);
  });

  it('creates topbar search surface with query pool and hints', () => {
    const resolveUrl = (app: string, path?: string) => `https://${app}.kylrix.space${path || ''}`;
    const searchSurface = createTopbarSearchSurface({
      query: 'note',
      routeLabel: 'Connect',
      currentApp: 'connect',
      snippets: [
        { id: 'snip-1', kind: 'goal', title: 'Goal snippet', description: 'Desc', href: null },
        { id: 'snip-2', kind: 'moment', title: 'Moment snippet', description: 'Desc2' },
        { id: 'snip-3', kind: 'call', title: 'Call snippet', description: 'Desc3' },
        { id: 'snip-4', kind: 'other', title: 'Other snippet', description: 'Desc4' },
      ],
      resolveUrl,
    });

    expect(searchSurface.query).toBe('note');
    expect(searchSurface.quickActions.length).toBeGreaterThan(0);

    const emptyQuerySurface = createTopbarSearchSurface({
      query: '',
      resolveUrl,
    });
    expect(emptyQuerySurface.query).toBe('');
  });

  it('checks topbar scroll top status', () => {
    expect(isTopbarScrollAtTop(null)).toBe(false);
    expect(isTopbarScrollAtTop({ scrollTop: 0 } as any)).toBe(true);
    expect(isTopbarScrollAtTop({ scrollTop: 10 } as any)).toBe(false);
  });
});
