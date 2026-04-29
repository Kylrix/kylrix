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

export function createTopbarAction(action: Omit<TopbarAction, 'accent'> & { app?: KylrixApp; accent?: string }): TopbarAction {
  const accent = action.accent || getAppTone(action.app || 'root').secondary;
  return {
    ...action,
    accent,
  };
}

export function createTopbarSurface(params: Omit<TopbarSurface, 'layout'>): TopbarSurface {
  return {
    ...params,
    layout: TOPBAR_LAYOUT,
  };
}

export function topbarMatches(query: string, terms: string[]) {
  const normalized = query.trim().toLowerCase();
  return terms.some((term) => term.includes(normalized) || normalized.includes(term));
}
