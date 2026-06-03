'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { 
  WorkflowStep, 
  WorkflowChain, 
  getStepImportance, 
  getNegationActionId 
} from './workflow-engine';

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
  activeWorkflowSteps?: string[];
}

interface LocalContextType {
  events: LocalEvent[];
  suggestions: EphemeralSuggestion[];
  bufferEvent: (event: Omit<LocalEvent, 'timestamp'>) => void;
  dismissSuggestion: (id: string) => void;
  compileContextForAI: () => CompiledLocalContext;
  
  // Workflow Recording Engine
  isRecording: boolean;
  currentWorkflow: WorkflowStep[];
  savedWorkflows: Record<string, WorkflowChain>;
  startRecording: () => void;
  stopRecording: (name: string, description: string, niche: TelemetryNiche) => WorkflowChain | null;
  clearSavedWorkflows: () => void;
  updateWorkflow: (workflowId: string, updated: WorkflowChain) => void;
}

const LocalContext = createContext<LocalContextType | undefined>(undefined);

const MAX_EVENTS = 30;

export function LocalContextProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [suggestions, setSuggestions] = useState<EphemeralSuggestion[]>([]);
  const pathname = usePathname();

  // Workflow Engine States
  const [isRecording, setIsRecording] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<WorkflowStep[]>([]);
  const [savedWorkflows, setSavedWorkflows] = useState<Record<string, WorkflowChain>>({});

  // Use refs to avoid re-binding the global window listener on state changes
  const isRecordingRef = useRef(isRecording);
  const bufferEventRef = useRef<(event: Omit<LocalEvent, 'timestamp'>) => void>(() => {});

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const addSuggestion = useCallback((suggestion: Omit<EphemeralSuggestion, 'id' | 'timestamp'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newSuggestion: EphemeralSuggestion = {
      ...suggestion,
      id,
      timestamp: new Date().toISOString()
    };
    
    setSuggestions(prev => {
      if (prev.some(s => s.title === suggestion.title)) return prev;
      return [newSuggestion, ...prev].slice(0, 5);
    });

    console.log('[LocalContextEngine] Generated Ephemeral Suggestion:', newSuggestion);
  }, []);

  const dismissSuggestion = useCallback((id: string) => {
    setSuggestions(prev => {
      const target = prev.find(s => s.id === id);
      if (target && (target as any).metadata?.actionKey) {
        const actionKey = (target as any).metadata.actionKey;
        if (typeof window !== 'undefined') {
          try {
            const deIncentivizedStr = localStorage.getItem('kylrix_deincentivized_suggestions');
            const deIncentivized: string[] = deIncentivizedStr ? JSON.parse(deIncentivizedStr) : [];
            if (!deIncentivized.includes(actionKey)) {
              deIncentivized.push(actionKey);
              localStorage.setItem('kylrix_deincentivized_suggestions', JSON.stringify(deIncentivized));
              console.log('[LocalContextEngine] De-incentivized suggestion pattern on this device:', actionKey);
            }
          } catch (err) {
            console.error('Failed to save de-incentivized suggestions:', err);
          }
        }
      }
      return prev.filter(s => s.id !== id);
    });
  }, []);

  const bufferEvent = useCallback((eventInput: Omit<LocalEvent, 'timestamp'>) => {
    const newEvent: LocalEvent = {
      ...eventInput,
      timestamp: new Date().toISOString()
    };

    setEvents(prev => {
      const updated = [...prev, newEvent];
      const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const valid = updated.filter(e => now - new Date(e.timestamp).getTime() < ONE_WEEK);
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('kylrix_action_cache_v1', JSON.stringify(valid));
      }
      return valid;
    });

    console.log('[LocalContextEngine] Buffered Event:', newEvent);

    // Heuristics & Confident Pattern Suggestion Engine
    setTimeout(() => {
      setEvents(currentEvents => {
        const now = new Date().getTime();

        // 1. Confident Context Suggestion Engine (Repeated actions counts)
        const actionCounts: Record<string, number> = {};
        currentEvents.forEach(e => {
          const key = `${e.niche}.${e.app}.${e.action}`;
          actionCounts[key] = (actionCounts[key] || 0) + 1;
        });

        Object.entries(actionCounts).forEach(([actionKey, count]) => {
          if (count >= 3) {
            const deIncentivizedStr = typeof window !== 'undefined' ? localStorage.getItem('kylrix_deincentivized_suggestions') : null;
            const deIncentivized: string[] = deIncentivizedStr ? JSON.parse(deIncentivizedStr) : [];
            
            if (deIncentivized.includes(actionKey)) return;

            const parts = actionKey.split('.');
            const niche = parts[0] as TelemetryNiche;
            const app = parts[1];

            let title = '';
            let description = '';
            let actionLabel = '';
            let actionHref = '';

            if (app === 'note') {
              title = 'Quick Note Shortcut';
              description = 'You frequently manage notes. Jump straight back to your workspace notes?';
              actionLabel = 'Write note';
              actionHref = '/note/notes';
            } else if (app === 'projects') {
              title = 'Workflow Hub Suggestion';
              description = 'We notice you are actively working in Projects. Manage your recorded workflows to speed up task automation?';
              actionLabel = 'Manage workflows';
              actionHref = '/projects/workflows';
            } else if (app === 'flow') {
              title = 'Synergize Your Tasks';
              description = 'You frequently update your tasks and flows. Review outstanding goals in the Productivity Center?';
              actionLabel = 'Open flows';
              actionHref = '/flow/tasks';
            } else if (app === 'vault') {
              title = 'Secure Password Manager';
              description = 'You frequently access credentials. Review and audit vault item sharing rules?';
              actionLabel = 'Manage secrets';
              actionHref = '/vault/sharing';
            } else if (app === 'connect') {
              title = 'Connect Huddles & Channels';
              description = 'You frequently connect with teammates. Start a persistent workspace call?';
              actionLabel = 'Open connect';
              actionHref = '/connect';
            }

            if (title) {
              addSuggestion({
                title,
                description,
                niche,
                actionLabel,
                actionHref,
                metadata: { actionKey }
              } as any);
            }
          }
        });

        // 2. Standard Heuristics (Heuristic 1: Search Abandonment to Moments Transition)
        if (newEvent.niche === 'connect' && (newEvent.app === 'connect' || newEvent.app === 'moments') && newEvent.action === 'page_view') {
          const recentSearch = currentEvents.find(e => 
            e.app === 'search' && 
            (e.action === 'search_focused' || e.action === 'search_typing') &&
            (now - new Date(e.timestamp).getTime() < 20000)
          );

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
    }, 100);

  }, [addSuggestion]);

  // Keep bufferEvent Ref current
  useEffect(() => {
    bufferEventRef.current = bufferEvent;
  }, [bufferEvent]);

  // Global DOM click interceptor for zero-boilerplate action recording
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const actionEl = target.closest('[data-action-id]') as HTMLElement;
      if (!actionEl) return;

      const actionId = actionEl.getAttribute('data-action-id');
      if (!actionId) return;

      console.log('[LocalContextEngine] Intercepted Action:', actionId);

      // Parse fields from niche.app.context.action.element
      const parts = actionId.split('.');
      const niche = (parts[0] || 'system') as TelemetryNiche;
      const app = parts[1] || 'unknown';
      const context = parts[2] || 'unknown';
      const action = parts[3] || 'unknown';
      const element = parts[4] || 'unknown';

      // Automatically report action click to local event queue
      bufferEventRef.current({
        niche,
        app,
        action: `${context}_${action}_${element}`,
        metadata: { actionId }
      });

      // Record step if in workflow recording mode
      if (isRecordingRef.current) {
        const importance = getStepImportance(actionId);
        const negationActionId = getNegationActionId(actionId);
        const newStep: WorkflowStep = {
          actionId,
          timestamp: new Date().toISOString(),
          importance,
          negationActionId,
          isDynamic: false
        };
        setCurrentWorkflow(prev => [...prev, newStep]);
      }
    };

    window.addEventListener('click', handleGlobalClick, true);
    return () => window.removeEventListener('click', handleGlobalClick, true);
  }, []);

  // Automatic pathname router tracker
  useEffect(() => {
    if (!pathname) return;

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

  // Load local action cache on mount and clean up old events
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('kylrix_action_cache_v1');
        if (cached) {
          const parsed = JSON.parse(cached) as LocalEvent[];
          const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
          const now = Date.now();
          const valid = parsed.filter(e => now - new Date(e.timestamp).getTime() < ONE_WEEK);
          setEvents(valid);
          localStorage.setItem('kylrix_action_cache_v1', JSON.stringify(valid));
        }
      } catch (err) {
        console.error('Failed to load action cache:', err);
      }
    }
  }, []);

  // Load saved workflows
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('kylrix_saved_workflows');
        if (stored) {
          setSavedWorkflows(JSON.parse(stored));
        }
      } catch (err) {
        console.error('Failed to load saved workflows:', err);
      }
    }
  }, []);

  const startRecording = useCallback(() => {
    setIsRecording(true);
    setCurrentWorkflow([]);
    console.log('[LocalContextEngine] Started Workflow Recording...');
  }, []);

  const stopRecording = useCallback((name: string, description: string, niche: TelemetryNiche) => {
    setIsRecording(false);
    if (currentWorkflow.length === 0) {
      console.log('[LocalContextEngine] Workflow Recording stopped: No steps recorded.');
      return null;
    }

    const workflowId = Math.random().toString(36).substring(2, 9);
    const newWorkflow: WorkflowChain = {
      id: workflowId,
      name,
      description,
      niche,
      steps: currentWorkflow,
      isPublic: false,
      isAnonymized: false,
      createdAt: new Date().toISOString()
    };

    setSavedWorkflows(prev => {
      const updated = { ...prev, [workflowId]: newWorkflow };
      if (typeof window !== 'undefined') {
        localStorage.setItem('kylrix_saved_workflows', JSON.stringify(updated));
      }
      return updated;
    });

    console.log('[LocalContextEngine] Saved Workflow:', newWorkflow);
    return newWorkflow;
  }, [currentWorkflow]);

  const updateWorkflow = useCallback((workflowId: string, updated: WorkflowChain) => {
    setSavedWorkflows(prev => {
      const next = { ...prev, [workflowId]: updated };
      if (typeof window !== 'undefined') {
        localStorage.setItem('kylrix_saved_workflows', JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const clearSavedWorkflows = useCallback(() => {
    setSavedWorkflows({});
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kylrix_saved_workflows');
    }
  }, []);

  const compileContextForAI = useCallback((): CompiledLocalContext => {
    const activeNichesSet = new Set<TelemetryNiche>();
    const recentAppsSet = new Set<string>();
    const flowTransitions: string[] = [];
    let lastSearchQuery: string | undefined;
    
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

    const sanitizeCdrValue = (val: string | undefined): string | undefined => {
      if (!val) return val;
      if (val.includes('"type":"cdr"') || val.includes("'type':'cdr'") || val.includes('"type": "cdr"')) {
        return '[Secure CDR Asset: Locked Vault Payload]';
      }
      return val;
    };

    return {
      activeNiches: Array.from(activeNichesSet),
      recentApps: Array.from(recentAppsSet),
      lastSearchQuery: sanitizeCdrValue(lastSearchQuery),
      flowTransitions: flowTransitions.slice(-5),
      timestamp: new Date().toISOString(),
      activeWorkflowSteps: currentWorkflow.map(step => step.actionId)
    };
  }, [events, currentWorkflow]);

  return (
    <LocalContext.Provider
      value={{
        events,
        suggestions,
        bufferEvent,
        dismissSuggestion,
        compileContextForAI,
        isRecording,
        currentWorkflow,
        savedWorkflows,
        startRecording,
        stopRecording,
        clearSavedWorkflows,
        updateWorkflow
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
