'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';

export type PotatoSnippetKind = 'note' | 'tag' | 'shared' | 'extension' | 'settings' | 'context';

export type PotatoSnippet = {
  id: string;
  kind: PotatoSnippetKind;
  title: string;
  description: string;
  href?: string | null;
  disabled?: boolean;
};

export type PotatoAction = PotatoSnippet & {
  accent: string;
  terms: string[];
  onSelect: () => void;
};

type PotatoSurface = {
  routeLabel: string;
  currentApp: 'note';
  snippets: PotatoSnippet[];
  quickActions: PotatoAction[];
  searchTargets: PotatoAction[];
};

type PotatoContextType = {
  routeLabel: string;
  currentApp: 'note';
  snippets: PotatoSnippet[];
  pushSnippet: (snippet: Omit<PotatoSnippet, 'id'>) => string;
  clearSnippets: () => void;
  buildSearchSurface: (query: string) => PotatoSurface;
};

const PotatoContext = createContext<PotatoContextType | undefined>(undefined);

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase();
}

function routeLabelFromPath(pathname: string | null) {
  if (!pathname) return 'Note';
  if (pathname === '/' || pathname === '/landing') return 'Landing';
  if (pathname === '/note' || pathname === '/note/notes') return 'Notes';
  if (pathname.startsWith('/note/notes/')) return 'Note';
  if (pathname === '/note/shared' || pathname.startsWith('/note/shared/')) return 'Shared';
  if (pathname === '/note/tags') return 'Tags';
  if (pathname === '/note/extensions') return 'Extensions';
  if (pathname === '/note/settings') return 'Settings';
  if (pathname === '/pitch') return 'Pitch';
  return 'Note';
}

function routeSnippets(pathname: string | null, user: any | null): PotatoSnippet[] {
  const name = user?.name || user?.email || 'your notes';

  if (!pathname) {
    return [
      {
        id: 'note-default',
        kind: 'context',
        title: 'Note is ready',
        description: 'Search notes, tags, shared links, and extensions from one place.',
      },
    ];
  }

  if (pathname === '/note' || pathname === '/note/notes') {
    return [
      {
        id: 'notes-current',
        kind: 'note',
        title: 'Active notebook',
        description: 'Capture a new note or continue your latest draft.',
      },
      {
        id: 'notes-personal',
        kind: 'context',
        title: name,
        description: 'Your private workspace and note graph.',
      },
    ];
  }

  if (pathname.startsWith('/note/notes/')) {
    return [
      {
        id: 'note-editor',
        kind: 'note',
        title: 'Editor context',
        description: 'Use the current note as a source for search, tags, or sharing.',
      },
      {
        id: 'note-share',
        kind: 'shared',
        title: 'Sharing context',
        description: 'Jump to public links or shared copies of this note.',
      },
    ];
  }

  if (pathname === '/note/shared' || pathname.startsWith('/note/shared/')) {
    return [
      {
        id: 'shared-notes',
        kind: 'shared',
        title: 'Shared notes',
        description: 'Review notes shared with you and your public notes.',
      },
    ];
  }

  if (pathname === '/note/tags') {
    return [
      {
        id: 'tags-overview',
        kind: 'tag',
        title: 'Tags overview',
        description: 'Cluster your notes by topic, project, or signal.',
      },
    ];
  }

  if (pathname === '/note/extensions') {
    return [
      {
        id: 'extensions-overview',
        kind: 'extension',
        title: 'Extensions',
        description: 'Link automations, exporters, and custom surfaces.',
      },
    ];
  }

  if (pathname === '/note/settings' || pathname.startsWith('/accounts/settings')) {
    return [
      {
        id: 'settings-profile',
        kind: 'settings',
        title: 'Settings',
        description: 'Tune your Note identity, privacy, and workspace.',
      },
    ];
  }

  return [
    {
      id: 'note-default',
      kind: 'context',
      title: 'Note context',
      description: 'Search notes, tags, shared links, and extensions from one place.',
    },
  ];
}

function matchesTerms(query: string, terms: string[]) {
  return terms.some((term) => term.includes(query) || query.includes(term));
}

function buildSurface(query: string, routeLabel: string, snippets: PotatoSnippet[]) {
  const normalized = normalizeQuery(query);

  const quickActions: PotatoAction[] = [
    {
      id: 'draft-note',
      kind: 'note',
      title: 'Draft a note',
      description: 'Capture the current context before it disappears.',
        href: '/note/notes/new',
      accent: '#EC4899',
      terms: ['note', 'draft', 'capture', 'write'],
      onSelect: () => window.location.assign('/note/notes/new'),
    },
    {
      id: 'browse-notes',
      kind: 'note',
      title: 'Open notes',
      description: 'Jump to your notes workspace.',
        href: '/note/notes',
      accent: '#EC4899',
      terms: ['notes', 'note', 'workspace', 'home'],
      onSelect: () => window.location.assign('/note/notes'),
    },
    {
      id: 'browse-shared',
      kind: 'shared',
      title: 'Review shared notes',
      description: 'Open notes shared with you or published by link.',
        href: '/note/shared',
      accent: '#6366F1',
      terms: ['shared', 'share', 'public', 'link'],
      onSelect: () => window.location.assign('/note/shared'),
    },
    {
      id: 'open-tags',
      kind: 'tag',
      title: 'Organize tags',
      description: 'Sort notes into clear topical clusters.',
        href: '/note/tags',
      accent: '#6366F1',
      terms: ['tag', 'tags', 'organize', 'cluster'],
      onSelect: () => window.location.assign('/note/tags'),
    },
    {
      id: 'open-extensions',
      kind: 'extension',
      title: 'Manage extensions',
      description: 'Connect automations and editor extensions.',
        href: '/note/extensions',
      accent: '#6366F1',
      terms: ['extension', 'extensions', 'automation', 'plugin'],
      onSelect: () => window.location.assign('/note/extensions'),
    },
  ];

  const searchTargets: PotatoAction[] = [
    {
      id: 'search-notes',
      kind: 'note',
      title: 'Search notes',
      description: 'Find drafts, archives, and research.',
        href: `/note/notes?search=${encodeURIComponent(query)}`,
      accent: '#EC4899',
      terms: ['note', 'notes', 'writing', 'draft'],
      onSelect: () => window.location.assign(`/note/notes?search=${encodeURIComponent(query)}`),
    },
    {
      id: 'search-shared',
      kind: 'shared',
      title: 'Search shared notes',
      description: 'Find public links and shared copies.',
        href: `/note/shared?search=${encodeURIComponent(query)}`,
      accent: '#6366F1',
      terms: ['shared', 'public', 'link', 'share'],
      onSelect: () => window.location.assign(`/note/shared?search=${encodeURIComponent(query)}`),
    },
    {
      id: 'search-tags',
      kind: 'tag',
      title: 'Search tags',
      description: 'Find topics and clusters faster.',
        href: `/note/tags?search=${encodeURIComponent(query)}`,
      accent: '#6366F1',
      terms: ['tag', 'tags', 'topic', 'cluster'],
      onSelect: () => window.location.assign(`/note/tags?search=${encodeURIComponent(query)}`),
    },
    {
      id: 'search-extensions',
      kind: 'extension',
      title: 'Search extensions',
      description: 'Find tools, automations, and plugins.',
      href: `/extensions?search=${encodeURIComponent(query)}`,
      accent: '#6366F1',
      terms: ['extension', 'extensions', 'automation', 'plugin'],
      onSelect: () => window.location.assign(`/extensions?search=${encodeURIComponent(query)}`),
    },
    {
      id: 'search-settings',
      kind: 'settings',
      title: 'Search settings',
      description: 'Jump to identity, privacy, or workspace controls.',
      href: `/settings?search=${encodeURIComponent(query)}`,
      accent: '#6366F1',
      terms: ['setting', 'settings', 'privacy', 'workspace'],
      onSelect: () => window.location.assign(`/settings?search=${encodeURIComponent(query)}`),
    },
  ];

  const contextualHints = snippets.map((snippet) => ({
    id: snippet.id,
    kind: snippet.kind,
    title: snippet.title,
    description: snippet.description,
    href: snippet.href || undefined,
    accent: snippet.kind === 'shared' ? '#6366F1' : snippet.kind === 'tag' ? '#EC4899' : snippet.kind === 'extension' ? '#A855F7' : '#6366F1',
    terms: [snippet.title, snippet.description, routeLabel].map((value) => value.toLowerCase()),
    onSelect: () => {
      if (snippet.href) {
        window.location.assign(snippet.href);
      }
    },
  }));

  const pool = [...quickActions, ...searchTargets, ...contextualHints];
  const filtered = normalized ? pool.filter((item) => matchesTerms(normalized, item.terms)) : pool;

  return {
    routeLabel,
    currentApp: 'note' as const,
    snippets,
    quickActions: (normalized ? filtered : quickActions).slice(0, 5),
    searchTargets: (normalized ? filtered : searchTargets).slice(0, 6),
  };
}

export function PotatoProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [snippets, setSnippets] = useState<PotatoSnippet[]>(() => routeSnippets(pathname, user));

  useEffect(() => {
    setSnippets(routeSnippets(pathname, user));
  }, [pathname, user]);

  const pushSnippet = useCallback((snippet: Omit<PotatoSnippet, 'id'>) => {
    const id = makeId(snippet.kind);
    setSnippets((current) => [...current, { ...snippet, id }]);
    return id;
  }, []);

  const clearSnippets = useCallback(() => {
    setSnippets(routeSnippets(pathname, user));
  }, [pathname, user]);

  const value = useMemo<PotatoContextType>(() => ({
    routeLabel: routeLabelFromPath(pathname),
    currentApp: 'note',
    snippets,
    pushSnippet,
    clearSnippets,
    buildSearchSurface: (query: string) => buildSurface(query, routeLabelFromPath(pathname), snippets),
  }), [clearSnippets, pathname, pushSnippet, snippets]);

  return <PotatoContext.Provider value={value}>{children}</PotatoContext.Provider>;
}

export function usePotato() {
  const context = useContext(PotatoContext);
  if (!context) {
    throw new Error('usePotato must be used within a PotatoProvider');
  }
  return context;
}
