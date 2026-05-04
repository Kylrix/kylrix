import { KylrixApp, TOPBAR_LAYOUT, getAppTone } from '../design';

export type TopbarPanel = 'ecosystem' | 'profile' | 'search';

export interface TopbarSnippet {
  id: string;
  kind: string;
  title: string;
  description: string;
  href?: string | null;
  disabled?: boolean;
}

export interface TopbarAction extends TopbarSnippet {
  accent: string;
  terms: string[];
  onSelect: () => void;
  app?: KylrixApp;
}

export interface TopbarPanelItem {
  id: string;
  app: KylrixApp;
  label: string;
  description: string;
  href?: string | null;
  selected?: boolean;
}

export interface TopbarSurface {
  routeLabel: string;
  currentApp: KylrixApp;
  snippets: TopbarSnippet[];
  quickActions: TopbarAction[];
  searchTargets: TopbarAction[];
  layout: typeof TOPBAR_LAYOUT;
}

export interface TopbarNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'pro' | 'system' | 'suggestion' | 'connect';
  title: string;
  message?: string;
  app?: KylrixApp;
  duration?: number;
  majestic?: boolean;
  defaultExpanded?: boolean;
}

export interface ConnectTopbarIdentity {
  displayName: string;
  username?: string | null;
  profilePicId?: string | null;
  profilePreviewUrl?: string | null;
  walletConnected?: boolean;
}

export interface ConnectTopbarSurface extends TopbarSurface {
  identity: ConnectTopbarIdentity;
  searchPlaceholder: string;
  walletLabel: string;
  showConnectCta: boolean;
}

export interface TopbarPanelSurface extends TopbarSurface {
  panel: TopbarPanel | null;
  panelItems: TopbarPanelItem[];
  searchPlaceholder: string;
  panelMaxHeight: string;
}

export interface TopbarPanelMotion {
  initial: { opacity: number; y: number; scaleY: number };
  animate: { opacity: number; y: number; scaleY: number };
  exit: { opacity: number; y: number; scaleY: number };
  transition: { duration: number; ease: 'easeOut' };
}

export interface TopbarSearchCard {
  id: string;
  kind: string;
  title: string;
  description: string;
  href: string;
  accent: string;
  terms: string[];
  disabled?: boolean;
}

export interface TopbarSearchSurface extends TopbarSurface {
  query: string;
  searchPlaceholder: string;
  quickActionLabel: string;
  searchAcrossLabel: string;
  peopleLabel: string;
  snippets: TopbarSnippet[];
  quickActions: TopbarSearchCard[];
  searchTargets: TopbarSearchCard[];
}

export interface TopbarProfileSurface {
  displayName: string;
  username?: string | null;
  bio?: string | null;
  avatar?: string | null;
  userId?: string | null;
  handlePosition?: 'top' | 'bottom';
}

export function createTopbarAction(action: Omit<TopbarAction, 'accent'> & { app?: KylrixApp; accent?: string }): TopbarAction {
  const accent = action.accent || getAppTone(action.app || 'kylrix').secondary;
  return {
    ...action,
    accent,
    app: action.app,
  };
}

export function createTopbarSurface(params: Omit<TopbarSurface, 'layout'>): TopbarSurface {
  return {
    ...params,
    layout: TOPBAR_LAYOUT,
  };
}

export function createConnectTopbarSurface(params: {
  routeLabel?: string;
  snippets?: TopbarSnippet[];
  identity: ConnectTopbarIdentity;
  searchPlaceholder?: string;
  walletLabel?: string;
  showConnectCta?: boolean;
}): ConnectTopbarSurface {
  return {
    routeLabel: params.routeLabel || 'Connect',
    currentApp: 'connect',
    snippets: params.snippets || [],
    quickActions: [],
    searchTargets: [],
    layout: TOPBAR_LAYOUT,
    identity: params.identity,
    searchPlaceholder: params.searchPlaceholder || 'Search notes, goals, moments, calls, people, apps',
    walletLabel: params.walletLabel || 'Wallet',
    showConnectCta: params.showConnectCta ?? !params.identity.walletConnected,
  };
}

export function createTopbarPanelSurface(params: {
  routeLabel?: string;
  currentApp?: KylrixApp;
  snippets?: TopbarSnippet[];
  quickActions?: TopbarAction[];
  searchTargets?: TopbarAction[];
  panel?: TopbarPanel | null;
  panelItems?: TopbarPanelItem[];
  searchPlaceholder?: string;
  panelMaxHeight?: string;
}): TopbarPanelSurface {
  return {
    routeLabel: params.routeLabel || 'Note',
    currentApp: params.currentApp || 'note',
    snippets: params.snippets || [],
    quickActions: params.quickActions || [],
    searchTargets: params.searchTargets || [],
    layout: TOPBAR_LAYOUT,
    panel: params.panel || null,
    panelItems: params.panelItems || [],
    searchPlaceholder: params.searchPlaceholder || 'Search notes, tags, shared links, people',
    panelMaxHeight: params.panelMaxHeight || TOPBAR_LAYOUT.searchDockMaxHeight,
  };
}

export function createEcosystemPanelItems(currentApp: KylrixApp = 'note'): TopbarPanelItem[] {
  return [
    { id: 'note', app: 'note', label: 'Note', description: 'Secure notes and research.', selected: currentApp === 'note' },
    { id: 'vault', app: 'vault', label: 'Vault', description: 'Passwords, 2FA, and keys.', selected: currentApp === 'vault' },
    { id: 'flow', app: 'flow', label: 'Goals', description: 'Tasks, plans, and follow-through.', selected: currentApp === 'flow' },
    { id: 'connect', app: 'connect', label: 'Connect', description: 'Secure messages and sharing.', selected: currentApp === 'connect' },
    { id: 'accounts', app: 'kylrix', label: 'Accounts', description: 'Your Kylrix account.', selected: currentApp === 'kylrix' },
  ];
}

export function createTopbarPanelMotion(): TopbarPanelMotion {
  return {
    initial: { opacity: 0, y: -14, scaleY: 0.985 },
    animate: { opacity: 1, y: 0, scaleY: 1 },
    exit: { opacity: 0, y: -10, scaleY: 0.98 },
    transition: { duration: 0.18, ease: 'easeOut' },
  };
}

function normalizeTopbarQuery(query: string) {
  return query.trim().toLowerCase();
}

function matchesTopbarTerms(query: string, terms: string[]) {
  return terms.some((term) => term.includes(query) || query.includes(term));
}

export function createTopbarSearchSurface(params: {
  query: string;
  routeLabel?: string;
  currentApp?: KylrixApp;
  snippets?: TopbarSnippet[];
  resolveUrl: (app: KylrixApp, path?: string) => string;
}): TopbarSearchSurface {
  const query = normalizeTopbarQuery(params.query);
  const currentApp = params.currentApp || 'connect';
  const snippets = params.snippets || [];
  const resolveUrl = params.resolveUrl;

  const quickActions: TopbarSearchCard[] = [
    {
      id: 'draft-note',
      kind: 'note',
      title: 'Draft a note',
      description: 'Capture the current context before it disappears.',
      href: resolveUrl('note', '/notes?mode=compose'),
      accent: '#EC4899',
      terms: ['note', 'draft', 'capture', 'write'],
    },
    {
      id: 'create-goal',
      kind: 'goal',
      title: 'Create a goal',
      description: 'Convert the current moment into a premium follow-through.',
      href: resolveUrl('flow', '/tasks?mode=create'),
      accent: '#A855F7',
      terms: ['goal', 'task', 'plan', 'follow up', 'follow-up'],
    },
    {
      id: 'open-moment',
      kind: 'moment',
      title: 'Open moments',
      description: 'Jump into the feed and surface recent moments.',
      href: resolveUrl('kylrix', '/'),
      accent: '#F59E0B',
      terms: ['moment', 'moments', 'feed', 'post'],
    },
    {
      id: 'start-call',
      kind: 'call',
      title: 'Start a call',
      description: 'Move straight from thought to voice.',
      href: resolveUrl('connect', '/calls'),
      accent: '#10B981',
      terms: ['call', 'voice', 'video', 'phone'],
    },
    {
      id: 'find-people',
      kind: 'person',
      title: 'Find people',
      description: 'Search usernames and open a direct chat.',
      href: resolveUrl('connect', '/chats'),
      accent: '#6366F1',
      terms: ['people', 'person', 'user', 'contact', 'chat'],
    },
  ];

  const searchTargets: TopbarSearchCard[] = [
    {
      id: 'search-notes',
      kind: 'note',
      title: 'Search notes',
      description: 'Find drafts, archives, and research.',
      href: resolveUrl('note', `/notes?search=${encodeURIComponent(query)}`),
      accent: '#EC4899',
      terms: ['note', 'notes', 'writing', 'draft'],
    },
    {
      id: 'search-goals',
      kind: 'goal',
      title: 'Search goals',
      description: 'Find tasks and follow-through in Flow.',
      href: resolveUrl('flow', `/tasks?search=${encodeURIComponent(query)}`),
      accent: '#A855F7',
      terms: ['goal', 'goals', 'task', 'tasks', 'flow'],
    },
    {
      id: 'search-moments',
      kind: 'moment',
      title: 'Search moments',
      description: 'Search feed posts and public replies.',
      href: resolveUrl('kylrix', `/?search=${encodeURIComponent(query)}`),
      accent: '#F59E0B',
      terms: ['moment', 'moments', 'post', 'feed'],
    },
    {
      id: 'search-calls',
      kind: 'call',
      title: 'Search calls',
      description: 'Review call history and live sessions.',
      href: resolveUrl('connect', `/calls?search=${encodeURIComponent(query)}`),
      accent: '#10B981',
      terms: ['call', 'calls', 'voice', 'video'],
    },
    {
      id: 'search-people',
      kind: 'person',
      title: 'Search people',
      description: 'Find contacts, usernames, and collaborators.',
      href: resolveUrl('connect', '/chats'),
      accent: '#6366F1',
      terms: ['people', 'person', 'users', 'chat', 'contacts'],
    },
    {
      id: 'search-apps',
      kind: 'app',
      title: 'Search apps',
      description: 'Jump between Kylrix apps instantly.',
      href: resolveUrl('kylrix', '/'),
      accent: '#F59E0B',
      terms: ['app', 'apps', 'note', 'flow', 'vault', 'connect'],
    },
  ];

  const contextualHints = snippets.map((snippet) => ({
    id: snippet.id,
    kind: snippet.kind,
    title: snippet.title,
    description: snippet.description,
    href: snippet.href || resolveUrl(currentApp, '/'),
    accent: snippet.kind === 'goal' ? '#A855F7' : snippet.kind === 'moment' ? '#F59E0B' : snippet.kind === 'call' ? '#10B981' : '#6366F1',
    terms: [snippet.title, snippet.description, params.routeLabel || ''].map((value) => value.toLowerCase()),
  }));

  const pool = [...quickActions, ...searchTargets, ...contextualHints];
  const filtered = query ? pool.filter((item) => matchesTopbarTerms(query, item.terms)) : pool;

  return {
    routeLabel: params.routeLabel || 'Connect',
    currentApp,
    snippets: snippets.slice(0, 4),
    quickActions: (query ? filtered : quickActions).slice(0, 5),
    searchTargets: (query ? filtered : searchTargets).slice(0, 6),
    layout: TOPBAR_LAYOUT,
    query,
    searchPlaceholder: 'Search notes, goals, moments, calls, people, apps',
    quickActionLabel: 'Quick actions',
    searchAcrossLabel: 'Search across apps',
    peopleLabel: 'People',
  };
}

export function createTopbarProfileSurface(params: TopbarProfileSurface): TopbarProfileSurface {
  return {
    handlePosition: 'bottom',
    ...params,
  };
}

export function isTopbarScrollAtTop(node: HTMLElement | null) {
  if (!node) return false;
  return node.scrollTop <= 0;
}

export function isTopbarScrollAtBottom(node: HTMLElement | null) {
  if (!node) return false;
  return Math.ceil(node.scrollTop + node.clientHeight) >= node.scrollHeight;
}

export function topbarMatches(query: string, terms: string[]) {
  const normalized = query.trim().toLowerCase();
  return terms.some((term) => term.includes(normalized) || normalized.includes(term));
}

/**
 * Get the href for topbar logo based on the app
 * Returns the landing page or dashboard for the given app
 */
export function getTopbarLogoHref(app: 'accounts' | 'note' | 'vault' | 'flow' | 'connect' | 'kylrix'): string {
  const paths: Record<string, string> = {
    'accounts': '/dashboard',
    'note': '/dashboard',
    'vault': '/dashboard',
    'flow': '/dashboard',
    'connect': '/dashboard',
    'kylrix': '/',
  };
  return paths[app] || '/';
}
