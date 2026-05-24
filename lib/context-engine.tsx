'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export type TelemetryNiche = 
  | 'workspace'      // Notes, Sheets, Document management
  | 'productivity'   // Tasks, Goals, Calendars, Events
  | 'connect'        // Chats, Calls, Huddles, Social Moments
  | 'security'       // Vault, Credentials, Keychains, Passkeys
  | 'intelligence'   // Smart Assistants, AI Model Routing
  | 'billing'        // Subscriptions, Tokens, Ledgers
  | 'system';        // Settings, Devices, Authentication

export interface LocalEvent {
  niche: TelemetryNiche;
  app: string;
  action: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface EphemeralSuggestion {
  id: string;
  title: string;
  description: string;
  niche: TelemetryNiche;
  actionLabel?: string;
  actionHref?: string;
  timestamp: string;
}

export interface CompiledLocalContext {
  activeNiches: string[];
  recentApps: string[];
  lastSearchQuery?: string;
  flowTransitions: string[];
  timestamp: string;
}

interface LocalContextType {
  events: LocalEvent[];
  suggestions: EphemeralSuggestion[];
  bufferEvent: (event: Omit<LocalEvent, 'timestamp'>) => void;
  dismissSuggestion: (id: string) => void;
  compileContextForAI: () => CompiledLocalContext;
}

const LocalContext = createContext<LocalContextType | undefined>(undefined);

const MAX_EVENTS = 30;

export function LocalContextProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [suggestions, setSuggestions] = useState<EphemeralSuggestion[]>([]);
  const pathname = usePathname();

  const addSuggestion = useCallback((suggestion: Omit<EphemeralSuggestion, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newSuggestion: EphemeralSuggestion = {
      ...suggestion,
      id,
      timestamp: new Date().toISOString()
    };
    
    // Prevent duplicate suggestions with same title/description active at once
    setSuggestions(prev => {
      if (prev.some(s => s.title === suggestion.title)) return prev;
      return [newSuggestion, ...prev].slice(0, 5); // Keep max 5 suggestions
    });

    console.log('[LocalContextEngine] Generated Ephemeral Suggestion:', newSuggestion);
  }, []);

  const dismissSuggestion = useCallback((id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
  }, []);

  const bufferEvent = useCallback((eventInput: Omit<LocalEvent, 'timestamp'>) => {
    const newEvent: LocalEvent = {
      ...eventInput,
      timestamp: new Date().toISOString()
    };

    setEvents(prev => {
      const updated = [...prev, newEvent];
      if (updated.length > MAX_EVENTS) {
        return updated.slice(updated.length - MAX_EVENTS);
      }
      return updated;
    });

    console.log('[LocalContextEngine] Buffered Event:', newEvent);

    // Heuristics Engine (Client-side execution to prevent server queries/bloat)
    // Runs against the current updated event queue
    setTimeout(() => {
      setEvents(currentEvents => {
        const now = new Date().getTime();

        // Heuristic 1: Search Abandonment to Moments Transition
        if (newEvent.niche === 'connect' && (newEvent.app === 'connect' || newEvent.app === 'moments') && newEvent.action === 'page_view') {
          // Look for search_focused/typing within last 20 seconds
          const recentSearch = currentEvents.find(e => 
            e.app === 'search' && 
            (e.action === 'search_focused' || e.action === 'search_typing') &&
            (now - new Date(e.timestamp).getTime() < 20000)
          );

          // Ensure NO clicked result happened after that search focus
          const clickedResult = currentEvents.find(e => 
            e.app === 'search' && 
            e.action === 'search_clicked_result' &&
            new Date(e.timestamp).getTime() > (recentSearch ? new Date(recentSearch.timestamp).getTime() : 0)
          );

          if (recentSearch && !clickedResult) {
            const query = recentSearch.metadata?.query || '';
            addSuggestion({
              title: 'Explore Moments Content',
              description: query 
                ? `Did you search for "${query}"? Browse the active public channels inside Moments!`
                : 'Browse trending topics and user updates in the public Moments feed!',
              niche: 'connect',
              actionLabel: 'Explore moments',
              actionHref: '/connect'
            });
          }
        }

        // Heuristic 2: Workspace Assistants Configuration Friction
        if (newEvent.niche === 'intelligence' && newEvent.app === 'agents' && newEvent.action === 'page_view') {
          const hasKey = typeof window !== 'undefined' && (
            localStorage.getItem('byokKey') || 
            localStorage.getItem('google_api_key') || 
            localStorage.getItem('secure_vault_active')
          );

          if (!hasKey) {
            addSuggestion({
              title: 'Secure Smart Assistants',
              description: 'Supply your private API key in Settings to unleash offline intelligent assistants.',
              niche: 'intelligence',
              actionLabel: 'Set up assistants',
              actionHref: '/settings/agents'
            });
          }
        }

        // Heuristic 3: Workspace and Productivity Synergy
        if (newEvent.niche === 'productivity' && newEvent.app === 'flow' && newEvent.action === 'page_view') {
          // Look for active note views within last 15 seconds
          const recentNoteView = currentEvents.find(e => 
            e.niche === 'workspace' && 
            e.app === 'note' && 
            e.action === 'page_view' &&
            (now - new Date(e.timestamp).getTime() < 15000)
          );

          if (recentNoteView) {
            addSuggestion({
              title: 'Bridge Notes & Tasks',
              description: 'We notice you are actively switching between Notes and Tasks. Keep notes open in side panel?',
              niche: 'productivity',
              actionLabel: 'Open notes',
              actionHref: '/note/notes'
            });
          }
        }

        return currentEvents;
      });
    }, 50);

  }, [addSuggestion]);

  // Automatic pathname router tracker
  useEffect(() => {
    if (!pathname) return;

    // Helper to map paths to niches and apps
    const getNicheAndApp = (path: string): { niche: TelemetryNiche; app: string } => {
      if (path.startsWith('/note')) return { niche: 'workspace', app: 'note' };
      if (path.startsWith('/vault')) return { niche: 'security', app: 'vault' };
      if (path.startsWith('/flow')) return { niche: 'productivity', app: 'flow' };
      if (path.startsWith('/connect')) return { niche: 'connect', app: 'connect' };
      if (path.startsWith('/projects')) return { niche: 'workspace', app: 'projects' };
      if (path.startsWith('/settings/agents')) return { niche: 'intelligence', app: 'agents' };
      if (path.startsWith('/settings')) return { niche: 'system', app: 'settings' };
      if (path.startsWith('/agents')) return { niche: 'intelligence', app: 'agents' };
      return { niche: 'system', app: 'home' };
    };

    const { niche, app } = getNicheAndApp(pathname);
    bufferEvent({
      niche,
      app,
      action: 'page_view',
      metadata: { path: pathname }
    });
  }, [pathname, bufferEvent]);

  // Compile context bundle for smart assistant prompt context
  const compileContextForAI = useCallback((): CompiledLocalContext => {
    const activeNichesSet = new Set<TelemetryNiche>();
    const recentAppsSet = new Set<string>();
    const flowTransitions: string[] = [];

    // Extract recent search query
    let lastSearchQuery: string | undefined;
    
    // Scan events chronologically
    events.forEach(e => {
      activeNichesSet.add(e.niche);
      recentAppsSet.add(e.app);
      if (e.action === 'page_view' && e.metadata?.path) {
        flowTransitions.push(e.metadata.path);
      }
      if (e.app === 'search' && e.metadata?.query) {
        lastSearchQuery = e.metadata.query;
      }
    });

    return {
      activeNiches: Array.from(activeNichesSet),
      recentApps: Array.from(recentAppsSet),
      lastSearchQuery,
      flowTransitions: flowTransitions.slice(-5), // Keep last 5 path transitions
      timestamp: new Date().toISOString()
    };
  }, [events]);

  return (
    <LocalContext.Provider
      value={{
        events,
        suggestions,
        bufferEvent,
        dismissSuggestion,
        compileContextForAI
      }}
    >
      {children}
    </LocalContext.Provider>
  );
}

export function useLocalContext() {
  const context = useContext(LocalContext);
  if (!context) {
    throw new Error('useLocalContext must be used within a LocalContextProvider');
  }
  return context;
}
