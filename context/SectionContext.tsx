'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Box, Divider, useTheme, useMediaQuery, CircularProgress, Typography, Drawer, alpha } from '@/lib/openbricks/primitives';
import { usePathname } from 'next/navigation';
import { recordAnonymizedTelemetry } from '@/lib/actions/client-ops';
import DesktopRightSection, { PanelType } from '@/components/layout/DesktopRightSection';

// Object detail components imports
import { PostViewClient } from '@/app/(app)/connect/post/[id]/PostViewClient';
import { NoteDetailSidebar } from '@/components/ui/NoteDetailSidebar';
import TaskDetails from '@/components/tasks/TaskDetails';
import EventDetails from '@/components/events/EventDetails';
import FormDetailsPage from '@/app/(app)/flow/(dashboard)/forms/[formId]/page';
import CredentialDetail from '@/components/app/dashboard/CredentialDetail';
import { TagNotesListSidebar } from '@/components/ui/TagNotesListSidebar';
import { PublicCall } from '@/app/(app)/connect/call/[id]/PublicCall';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { HuddleChatWindow } from '@/components/chat/HuddleChatWindow';
import { GithubIntegrationDrawer } from '@/components/overlays/GithubIntegrationDrawer';

// Helper imports for note detail fetching
import { Notes } from '@/types/appwrite';
import { getNote } from '@/lib/appwrite';
import { deleteNote } from '@/lib/actions/client-ops';
import { useDataNexus } from '@/context/DataNexusContext';
import { useToast } from '@/components/ui/Toast';
import CommentsSection from '@/app/(app)/app/(app)/notes/Comments';
import NoteReactions from '@/app/(app)/app/(app)/notes/NoteReactions';
import { useAuth } from '@/context/auth/AuthContext';
import { getNote as getChatNote } from '@/lib/appwrite/note';

export interface ActiveDetail {
  type: 'note' | 'moment' | 'goal' | 'form' | 'event' | 'tag' | 'secret' | 'chat' | 'call' | 'github' | 'huddle';
  id: string;
  data?: any; // Extra initial payload if we have it
}

export interface SectionConfig {
  columnsCount: number; // 1, 2, 3, or 4 columns
  sections: Array<{
    id: string;
    type: 'original' | 'panel';
    width: string; // e.g. '1fr', '400px'
    panels?: PanelType[];
  }>;
}

export interface PageState {
  activeDetail: ActiveDetail | null;
  scrollPositions: Record<string, number>;
  activeDrawers: Record<string, boolean>;
  routePaths: Record<string, string>;
  extra: Record<string, any>;
}

interface SectionContextType {
  getLayoutForRoute: (route: string) => SectionConfig;
  updateRouteOverride: (route: string, override: Partial<SectionConfig>) => void;
  resetOverrides: () => void;
  screenWidth: number;
  activeDetail: ActiveDetail | null;
  setActiveDetail: (detail: ActiveDetail | null) => void;
  pageState: PageState;
  updatePageState: (updater: Partial<PageState> | ((prev: PageState) => PageState)) => void;
  persistScrollPosition: (key: string, scrollY: number) => void;
  getScrollPosition: (key: string) => number;
}

const SectionContext = createContext<SectionContextType | undefined>(undefined);

// Core default layouts for flagged routes in Kylrix
const DEFAULT_LAYOUTS: Record<string, PanelType[]> = {
  '/app': ['note', 'huddles', 'projects'],
  '/tags': ['note', 'huddles', 'projects'],
  '/app/shared': ['tags', 'huddles', 'projects'],
  '/flow': ['forms', 'huddles', 'projects'],
  '/flow/forms': ['projects', 'huddles', 'goals'],
  '/flow/events': ['note', 'huddles', 'goals'],
  '/vault': ['note', 'totp', 'projects'],
  '/vault/totp': ['secrets', 'secret_chat'],
  '/vault/sharing': ['secrets', 'totp', 'secret_chat'],
  '/connect/chats': ['projects', 'huddles', 'note'],
  '/connect/calls': ['projects', 'threads'],
  '/projects': ['projects_stats', 'projects_templates'],
  '/projects/[projectId]': ['note', 'huddles', 'goals'],
  '/send': ['stash'],
};

import { getSettings, updateSettings, createSettings } from '@/lib/appwrite/note';

export function SectionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [activeDetail, setActiveDetail] = useState<ActiveDetail | null>(null);
  const { user } = useAuth();

  const [pageState, setPageState] = useState<PageState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('kylrix:pageState');
        return saved ? JSON.parse(saved) : {
          activeDetail: null,
          scrollPositions: {},
          activeDrawers: {},
          routePaths: {},
          extra: {},
        };
      } catch {
        // Fallback
      }
    }
    return {
      activeDetail: null,
      scrollPositions: {},
      activeDrawers: {},
      routePaths: {},
      extra: {},
    };
  });

  const updatePageState = useCallback((updater: Partial<PageState> | ((prev: PageState) => PageState)) => {
    setPageState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      if (typeof window !== 'undefined') {
        localStorage.setItem('kylrix:pageState', JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const persistScrollPosition = useCallback((key: string, scrollY: number) => {
    setPageState(prev => {
      const next = {
        ...prev,
        scrollPositions: {
          ...prev.scrollPositions,
          [key]: scrollY
        }
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('kylrix:pageState', JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const getScrollPosition = useCallback((key: string) => {
    return pageState.scrollPositions[key] || 0;
  }, [pageState.scrollPositions]);

  const handleSetActiveDetail = useCallback((detail: ActiveDetail | null) => {
    setActiveDetail(detail);
    updatePageState({ activeDetail: detail });
  }, [updatePageState]);

  // Sync cloud pageState to local state when user logs in
  useEffect(() => {
    if (!user?.$id) return;

    const loadCloudState = async () => {
      try {
        const userId = user.$id;
        const row = await getSettings(userId);
        if (row && row.settings) {
          const config = JSON.parse(row.settings);
          if (config.pageState) {
            setPageState(prev => {
              const merged = {
                ...prev,
                ...config.pageState,
                scrollPositions: { ...prev.scrollPositions, ...config.pageState.scrollPositions },
                activeDrawers: { ...prev.activeDrawers, ...config.pageState.activeDrawers },
                routePaths: { ...prev.routePaths, ...config.pageState.routePaths },
                extra: { ...prev.extra, ...config.pageState.extra },
              };
              if (typeof window !== 'undefined') {
                localStorage.setItem('kylrix:pageState', JSON.stringify(merged));
              }
              return merged;
            });
            if (config.pageState.activeDetail) {
              setActiveDetail(config.pageState.activeDetail);
            }
          }
        }
      } catch (err) {
        // Safe to ignore
      }
    };
    loadCloudState();
  }, [user?.$id]);

  // Debounced cloud sync of pageState
  useEffect(() => {
    if (!user?.$id) return;

    const handler = setTimeout(async () => {
      try {
        const userId = user.$id;
        let existingConfig: any = {};
        try {
          const row = await getSettings(userId);
          existingConfig = row.settings ? JSON.parse(row.settings) : {};
        } catch {
          // Row doesn't exist
        }

        existingConfig.pageState = pageState;

        try {
          await updateSettings(userId, { settings: JSON.stringify(existingConfig) });
        } catch {
          await createSettings({
            userId,
            settings: JSON.stringify(existingConfig)
          });
        }
      } catch (err) {
        console.error('Failed to sync page state to cloud:', err);
      }
    }, 1500);

    return () => clearTimeout(handler);
  }, [pageState, user?.$id]);

  // Restore initial active detail on mount
  useEffect(() => {
    if (pageState.activeDetail) {
      setActiveDetail(pageState.activeDetail);
    }
  }, []);
  
  const [overrides, setOverrides] = useState<Record<string, Partial<SectionConfig>>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('kylrix:sections:overrides');
        return saved ? JSON.parse(saved) : {};
      } catch {
        return {};
      }
    }
    return {};
  });

  const [screenWidth, setScreenWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close hijacked details panel automatically on path navigation to prevent UI state leakage
  const lastPathnameRef = useRef(pathname);
  useEffect(() => {
    if (lastPathnameRef.current !== pathname) {
      lastPathnameRef.current = pathname;
      handleSetActiveDetail(null);
    }
  }, [pathname, handleSetActiveDetail]);

  const updateRouteOverride = useCallback((route: string, override: Partial<SectionConfig>) => {
    setOverrides((prev) => {
      const updated = { ...prev, [route]: { ...prev[route], ...override } };
      if (typeof window !== 'undefined') {
        localStorage.setItem('kylrix:sections:overrides', JSON.stringify(updated));
        
        // 1% discretionary telemetry dispatch to optimize sections globally
        if (Math.random() < 0.01) {
          void recordAnonymizedTelemetry({
            niche: 'system',
            app: 'sections',
            action: 'layout_override',
            intent: 'optimize_columns',
            metadata: {
              route,
              screenWidth,
              columnsCount: override.columnsCount,
              overriddenAt: new Date().toISOString(),
            }
          }).catch(err => console.warn('[SectionProvider] Telemetry failed:', err));
        }
      }
      return updated;
    });
  }, [screenWidth]);

  const resetOverrides = useCallback(() => {
    setOverrides({});
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kylrix:sections:overrides');
    }
  }, []);

  // Intelligent fallback: auto-partitions data/sections for non-configured routes
  const analyzeAndPartitionRoute = useCallback((route: string): PanelType[] => {
    let cleanRoute = route.split('?')[0];
    if (cleanRoute.length > 1 && cleanRoute.endsWith('/')) {
      cleanRoute = cleanRoute.slice(0, -1);
    }

    // /send: stash history only — no notes, vault, or huddles in the sidebar
    if (cleanRoute.startsWith('/send')) {
      return ['stash'];
    }

    // /projects/[projectId] fallback: display relevant execution panels
    if (cleanRoute.startsWith('/projects/')) {
      return ['note', 'huddles', 'goals'];
    }

    // Default dynamic fallback
    if (cleanRoute.includes('settings')) {
      return ['totp'];
    }

    return ['note', 'projects'];
  }, []);

  // Computes the dynamic layout depending on screen width and route preferences
  const getLayoutForRoute = useCallback((route: string): SectionConfig => {
    let cleanRoute = route.split('?')[0];
    if (cleanRoute.length > 1 && cleanRoute.endsWith('/')) {
      cleanRoute = cleanRoute.slice(0, -1);
    }
    const userOverride = overrides[cleanRoute];

    // Find predefined panels or fetch dynamic partition fallback
    const routePanels = DEFAULT_LAYOUTS[cleanRoute] || analyzeAndPartitionRoute(cleanRoute);

    // Dynamic Section breakdown according to screen real estate
    let columnsCount = 2;
    let sections: SectionConfig['sections'] = [];

    if (screenWidth < 768) {
      // Mobile: Standard single-column flow
      columnsCount = 1;
      sections = [{ id: 'original', type: 'original', width: '1fr' }];
    } else if (screenWidth >= 768 && screenWidth < 1440) {
      // Laptop: Standard 2-column sidebar layout
      columnsCount = 2;
      sections = [
        { id: 'original', type: 'original', width: '1fr' },
        { id: 'sidebar-1', type: 'panel', width: '320px', panels: routePanels },
      ];
    } else if (screenWidth >= 1440 && screenWidth < 1920) {
      // Ultra-Wide Desktop: 3-column screen partition
      columnsCount = 3;
      // Extract the first panel into its own column, keep rest in column 3
      const firstPanel = routePanels[0] ? [routePanels[0]] : [];
      const remainingPanels = routePanels.slice(1);
      
      sections = [
        { id: 'original', type: 'original', width: '1fr' },
        { id: 'column-first', type: 'panel', width: '310px', panels: firstPanel },
        { id: 'column-rest', type: 'panel', width: '310px', panels: remainingPanels },
      ];
    } else {
      // Double Ultra-Wide: 4-column display setup
      columnsCount = Math.min(4, routePanels.length + 1);
      sections = [{ id: 'original', type: 'original', width: '1fr' }];
      
      // Auto-partition each panel to its own dedicated column
      routePanels.slice(0, 3).forEach((panel, index) => {
        sections.push({
          id: `column-dedicated-${index}`,
          type: 'panel',
          width: '300px',
          panels: [panel]
        });
      });
    }

    // Apply any active overrides
    const finalConfig = {
      columnsCount: userOverride?.columnsCount ?? columnsCount,
      sections: userOverride?.sections ?? sections,
    };

    return finalConfig;
    }, [overrides, screenWidth, analyzeAndPartitionRoute]);

  const contextValue = useMemo<SectionContextType>(() => ({
    getLayoutForRoute,
    updateRouteOverride,
    resetOverrides,
    screenWidth,
    activeDetail,
    setActiveDetail: handleSetActiveDetail,
    pageState,
    updatePageState,
    persistScrollPosition,
    getScrollPosition
  }), [screenWidth, activeDetail, handleSetActiveDetail, pageState, updatePageState, persistScrollPosition, getScrollPosition, getLayoutForRoute, updateRouteOverride, resetOverrides]);

  return (
    <SectionContext.Provider value={contextValue}>
      {children}
    </SectionContext.Provider>
  );
}

export function useSection() {
  const context = useContext(SectionContext);
  if (!context) {
    throw new Error('useSection must be used within a SectionProvider');
  }
  return context;
}

// ---------------------------------------------------------
// REUSABLE CONTAINERS FOR ROUTE-LEVEL INTEGRATION
// ---------------------------------------------------------

/**
 * NoteDetailContainer
 * Surgical replication of NoteEditorPage for unified responsive detail rendering.
 */
export function NoteDetailContainer({ noteId, onBack }: { noteId: string; onBack: () => void }) {
  const [note, setNote] = useState<Notes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showSuccess, showError } = useToast();
  const { fetchOptimized, setCachedData, invalidate, getCachedData } = useDataNexus();

  const CACHE_KEY = useMemo(() => noteId ? `note_${noteId}` : null, [noteId]);

  useEffect(() => {
    let mounted = true;
    if (!noteId || !CACHE_KEY) {
      setIsLoading(false);
      return;
    }
    const cached = getCachedData<Notes>(CACHE_KEY);
    if (cached) {
      setNote(cached);
      setIsLoading(false);
    }
    (async () => {
      if (!cached) setIsLoading(true);
      try {
        const fetched = await fetchOptimized(CACHE_KEY, () => getNote(noteId));
        if (mounted) setNote(fetched);
      } catch (error: any) {
        showError('Failed to load note', 'Please try again later.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [noteId, CACHE_KEY, fetchOptimized, getCachedData, showError]);

  const handleUpdate = (updated: Notes) => {
    setNote(updated);
    if (CACHE_KEY) setCachedData(CACHE_KEY, updated);
  };

  const handleDelete = async (noteId: string) => {
    try {
      await deleteNote(noteId);
      if (CACHE_KEY) invalidate(CACHE_KEY);
      showSuccess('Deleted', 'Note removed');
      onBack();
    } catch (error: any) {
      showError('Delete failed', 'Could not delete the note.');
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8, height: '100%' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!note) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8, height: '100%' }}>
        <Typography color="text.secondary">Note not found.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', p: 3 }}>
      <NoteDetailSidebar
        note={note}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onBack={onBack}
        showExpandButton={false}
        showHeaderDeleteButton={false}
      />
      <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ p: 2, bgcolor: alpha('#161412', 0.02), borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <NoteReactions targetId={noteId} />
        </Box>
        <Box sx={{ p: 2, bgcolor: alpha('#161412', 0.02), borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <CommentsSection noteId={noteId} />
        </Box>
      </Box>
    </Box>
  );
}

/**
 * ChatDetailContainer
 * Unified loader for Chats / Huddle chats thread routing inside E2E and public flows.
 */
export function ChatDetailContainer({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isHuddleChat, setIsHuddleChat] = useState(false);
  const [huddleTitle, setHuddleTitle] = useState('');

  useEffect(() => {
    if (!conversationId) return;
    const checkChatType = async () => {
      try {
        const note = await getChatNote(conversationId) as any;
        if (note && (note.isChat || note.isThread || note.isGhost)) {
          setIsHuddleChat(true);
          setHuddleTitle(note.title || 'Huddle Chat');
        }
      } catch (e) {
        setIsHuddleChat(false);
      } finally {
        setLoading(false);
      }
    };
    checkChatType();
  }, [conversationId]);

  if (loading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', height: '100%', py: 8 }}>
        <CircularProgress sx={{ color: '#F59E0B' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ pointerEvents: 'auto', height: '100%' }}>
      {isHuddleChat ? (
        <HuddleChatWindow 
          chatNoteId={conversationId} 
          user={user} 
          title={huddleTitle} 
          onBack={onBack}
        />
      ) : (
        <ChatWindow conversationId={conversationId} onBack={onBack} />
      )}
    </Box>
  );
}

/**
 * DetailSectionWrapper
 * Maps dynamic detail types to unified responsive components.
 */
export function DetailSectionWrapper({ detail, onClose }: { detail: ActiveDetail; onClose: () => void }) {
  switch (detail.type) {
    case 'moment':
      return <PostViewClient id={detail.id} onBack={onClose} />;
    case 'note':
      return <NoteDetailContainer noteId={detail.id} onBack={onClose} />;
    case 'goal':
      return <TaskDetails taskId={detail.id} onBack={onClose} />;
    case 'event':
      return <EventDetails eventId={detail.id} initialData={detail.data} onBack={onClose} />;
    case 'form':
      return <FormDetailsPage formId={detail.id} onBack={onClose} />;
    case 'secret':
      return <CredentialDetail credential={detail.data} onClose={onClose} isMobile={false} inline={true} />;
    case 'tag':
      return (
        <TagNotesListSidebar
          tag={detail.data}
          onBack={onClose}
          onNoteUpdate={() => {}}
          onNoteDelete={() => {}}
        />
      );
    case 'call':
      return <PublicCall id={detail.id} />;
    case 'chat':
      return <ChatDetailContainer conversationId={detail.id} onBack={onClose} />;
    case 'github':
      return <GithubIntegrationDrawer isOpen={true} onClose={onClose} {...detail.data} isFlapover={true} />;
    default:
      return null;
  }
}

/**
 * GlobalDetailDrawer
 * 100dvh full-screen drawer overlay representing target screens.
 * Overlays EVERYTHING including Topbar.
 */
export function GlobalDetailDrawer({ activeDetail, onClose }: { activeDetail: ActiveDetail | null; onClose: () => void }) {
  const isOpen = activeDetail !== null;

  return (
    <Drawer
      anchor="bottom"
      open={isOpen}
      onClose={onClose}
      variant="temporary"
      ModalProps={{
        keepMounted: false,
        disablePortal: true,
      }}
      PaperProps={{
        sx: {
          height: '100dvh',
          width: '100%',
          bgcolor: '#000000',
          backgroundImage: 'none',
          boxShadow: 'none',
          boxSizing: 'border-box',
          overflowY: 'auto',
          zIndex: 9999, // Overlay Topbar
        }
      }}
    >
      {activeDetail && (
        <Box sx={{ height: '100%', position: 'relative', bgcolor: '#000000' }}>
          <DetailSectionWrapper detail={activeDetail} onClose={onClose} />
        </Box>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------
// MAIN CONTAINER COMPONENT
// ---------------------------------------------------------

interface MultiSectionContainerProps {
  children: React.ReactNode;
  panels?: PanelType[];
  contextId?: string;
}

export function MultiSectionContainer({ children, panels, contextId }: MultiSectionContainerProps) {
  const pathname = usePathname();
  const { getLayoutForRoute, activeDetail, setActiveDetail } = useSection();

  const layout = useMemo(() => {
    const calculated = getLayoutForRoute(pathname);
    // If explicit panels prop is passed, override computed panels in columns
    if (panels && calculated.columnsCount > 1) {
      if (calculated.columnsCount === 2) {
        calculated.sections[1].panels = panels;
      } else if (calculated.columnsCount === 3) {
        calculated.sections[1].panels = [panels[0]];
        calculated.sections[2].panels = panels.slice(1);
      } else if (calculated.columnsCount === 4) {
        calculated.sections[1].panels = [panels[0]];
        calculated.sections[2].panels = [panels[1]];
        if (calculated.sections[3]) {
          calculated.sections[3].panels = [panels[2]];
        }
      }
    }
    return calculated;
  }, [pathname, getLayoutForRoute, panels]);

  // Certain types should ALWAYS be full screen (overlaying everything)
  const isFullScreenDetail = useMemo(() => {
    return activeDetail?.type === 'secret';
  }, [activeDetail?.type]);

  // Compute CSS Grid columns style
  const gridTemplateColumns = useMemo(() => {
    return layout.sections.map(s => s.width).join(' ');
  }, [layout]);

  if (layout.columnsCount === 1) {
    return (
      <Box sx={{ width: '100%', px: { xs: 1, lg: 2, xl: 3 }, boxSizing: 'border-box' }}>
        {children}
        <GlobalDetailDrawer activeDetail={activeDetail} onClose={() => setActiveDetail(null)} />
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: '100%' }}>
      <Box 
        sx={{ 
          display: 'grid', 
          gridTemplateColumns, 
          gap: 4, 
          alignItems: 'flex-start',
          width: '100%',
          maxWidth: '100%',
          margin: '0 auto',
          // Premium margin padding positioning sides of the screen
          px: { xs: 1, lg: 2, xl: 3 },
          boxSizing: 'border-box'
        }}
      >
        {layout.sections.map((section) => {
          if (section.type === 'original') {
            return (
              <Box key={section.id} sx={{ minWidth: 0, width: '100%' }}>
                {children}
              </Box>
            );
          }

          if (!section.panels || section.panels.length === 0) return null;

          const isRightmostPanel = section.id === layout.sections[layout.sections.length - 1].id;

          return (
            <Box 
              key={section.id} 
              sx={{ 
                display: { xs: 'none', md: 'block' },
                position: 'sticky',
                top: '108px',
                height: 'auto',
                maxHeight: 'calc(100vh - 120px)',
                overflowY: 'hidden',
                width: section.width,
                minWidth: section.width,
                boxSizing: 'border-box'
              }}
            >
              {isRightmostPanel && activeDetail && !isFullScreenDetail ? (
                <Box sx={{ 
                  height: '100%', 
                  bgcolor: '#161412', 
                  border: '1px solid rgba(255,255,255,0.08)', 
                  borderRadius: '26px',
                  overflow: 'hidden'
                }}>
                  <DetailSectionWrapper detail={activeDetail} onClose={() => setActiveDetail(null)} />
                </Box>
              ) : (
                <DesktopRightSection panels={section.panels} contextId={contextId} />
              )}
            </Box>
          );
        })}
      </Box>

      {/* Full-screen detail overlay (z-index 9999) */}
      {isFullScreenDetail && (
        <GlobalDetailDrawer activeDetail={activeDetail} onClose={() => setActiveDetail(null)} />
      )}
    </Box>
  );
}
