'use client';

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Box, Divider, useTheme, useMediaQuery, CircularProgress, Typography, Drawer, alpha } from '@mui/material';
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

// Helper imports for note detail fetching
import { Notes } from '@/types/appwrite';
import { getNote } from '@/lib/appwrite';
import { updateNote, deleteNote } from '@/lib/actions/client-ops';
import { useDataNexus } from '@/context/DataNexusContext';
import { useToast } from '@/components/ui/Toast';
import CommentsSection from '@/app/(app)/note/(app)/notes/Comments';
import NoteReactions from '@/app/(app)/note/(app)/notes/NoteReactions';
import { useAuth } from '@/context/auth/AuthContext';
import { getNote as getChatNote } from '@/lib/appwrite/note';

export interface ActiveDetail {
  type: 'note' | 'moment' | 'goal' | 'form' | 'event' | 'tag' | 'secret' | 'chat' | 'call';
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

interface SectionContextType {
  getLayoutForRoute: (route: string) => SectionConfig;
  updateRouteOverride: (route: string, override: Partial<SectionConfig>) => void;
  resetOverrides: () => void;
  screenWidth: number;
  activeDetail: ActiveDetail | null;
  setActiveDetail: (detail: ActiveDetail | null) => void;
}

const SectionContext = createContext<SectionContextType | undefined>(undefined);

// Core default layouts for flagged routes in Kylrix
const DEFAULT_LAYOUTS: Record<string, PanelType[]> = {
  '/note/tags': ['note', 'huddles', 'projects'],
  '/note/shared': ['tags', 'huddles', 'projects'],
  '/flow/goals': ['forms', 'huddles', 'projects'],
  '/flow/forms': ['projects', 'huddles', 'goals'],
  '/flow/events': ['note', 'huddles', 'goals'],
  '/vault/dashboard': ['note', 'totp', 'projects'],
  '/vault/totp': ['secrets', 'secret_chat'],
  '/vault/sharing': ['secrets', 'totp', 'secret_chat'],
  '/connect/chats': ['note', 'huddles', 'projects'],
  '/connect/calls': ['projects', 'threads'],
};

export function SectionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [activeDetail, setActiveDetail] = useState<ActiveDetail | null>(null);
  
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
  useEffect(() => {
    setActiveDetail(null);
  }, [pathname]);

  // Persist overrides locally and conditionally dispatch 1% anonymous telemetry
  const updateRouteOverride = (route: string, override: Partial<SectionConfig>) => {
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
  };

  const resetOverrides = () => {
    setOverrides({});
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kylrix:sections:overrides');
    }
  };

  // Intelligent fallback: auto-partitions data/sections for non-configured routes
  const analyzeAndPartitionRoute = (route: string): PanelType[] => {
    const cleanRoute = route.split('?')[0];

    // /send page fallback: split composition, Sparks history, security Context
    if (cleanRoute.startsWith('/send')) {
      return ['note', 'secrets', 'huddles'];
    }

    // Default dynamic fallback
    if (cleanRoute.includes('settings')) {
      return ['totp'];
    }

    return ['note', 'projects'];
  };

  // Computes the dynamic layout depending on screen width and route preferences
  const getLayoutForRoute = (route: string): SectionConfig => {
    const cleanRoute = route.split('?')[0];
    const userOverride = overrides[cleanRoute];

    // Find predefined panels or fetch dynamic partition fallback
    const routePanels = DEFAULT_LAYOUTS[cleanRoute] || analyzeAndPartitionRoute(cleanRoute);

    // Dynamic Section breakdown according to screen real estate
    let columnsCount = 2;
    let sections: SectionConfig['sections'] = [];

    if (screenWidth < 1200) {
      // Mobile & Tablet: Standard single-column flow
      columnsCount = 1;
      sections = [{ id: 'original', type: 'original', width: '1fr' }];
    } else if (screenWidth >= 1200 && screenWidth < 1600) {
      // Laptop: Standard 2-column sidebar layout
      columnsCount = 2;
      sections = [
        { id: 'original', type: 'original', width: '1fr' },
        { id: 'sidebar-1', type: 'panel', width: '400px', panels: routePanels },
      ];
    } else if (screenWidth >= 1600 && screenWidth < 2000) {
      // Ultra-Wide Desktop: 3-column screen partition
      columnsCount = 3;
      // Extract the first panel into its own column, keep rest in column 3
      const firstPanel = routePanels[0] ? [routePanels[0]] : [];
      const remainingPanels = routePanels.slice(1);
      
      sections = [
        { id: 'original', type: 'original', width: '1fr' },
        { id: 'column-first', type: 'panel', width: '380px', panels: firstPanel },
        { id: 'column-rest', type: 'panel', width: '380px', panels: remainingPanels },
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
          width: '360px',
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
  };

  const contextValue = useMemo<SectionContextType>(() => ({
    getLayoutForRoute,
    updateRouteOverride,
    resetOverrides,
    screenWidth,
    activeDetail,
    setActiveDetail,
  }), [screenWidth, overrides, activeDetail, getLayoutForRoute, updateRouteOverride, resetOverrides]);

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

  const handleUpdate = async (updated: Notes) => {
    try {
      const saved = await updateNote(updated.$id || noteId || '', updated);
      setNote(saved);
      if (CACHE_KEY) setCachedData(CACHE_KEY, saved);
      showSuccess('Saved', 'Note updated successfully');
    } catch (error: any) {
      showError('Update failed', 'Could not save your changes.');
    }
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
    default:
      return null;
  }
}

/**
 * MobileDetailDrawer
 * 100dvh full-screen bottom drawer overlay representing target screens on mobile devices.
 */
export function MobileDetailDrawer({ activeDetail, onClose }: { activeDetail: ActiveDetail | null; onClose: () => void }) {
  const isOpen = activeDetail !== null;

  return (
    <Drawer
      anchor="bottom"
      open={isOpen}
      onClose={onClose}
      variant="temporary"
      ModalProps={{
        keepMounted: false,
        disablePortal: true, // Physical unmount physical containment as per policy
      }}
      PaperProps={{
        sx: {
          height: '100dvh', // The ONLY exception to the traditional 60% drawer rule
          width: '100%',
          bgcolor: '#000000',
          backgroundImage: 'none',
          boxShadow: 'none',
          boxSizing: 'border-box',
          overflowY: 'auto',
          zIndex: 9999,
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

  // Compute CSS Grid columns style
  const gridTemplateColumns = useMemo(() => {
    return layout.sections.map(s => s.width).join(' ');
  }, [layout]);

  if (layout.columnsCount === 1) {
    return (
      <Box sx={{ width: '100%' }}>
        {children}
        <MobileDetailDrawer activeDetail={activeDetail} onClose={() => setActiveDetail(null)} />
      </Box>
    );
  }

  return (
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
        px: { xs: 2, lg: 4, xl: 6 },
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
              display: { xs: 'none', lg: 'block' },
              position: 'sticky',
              top: '108px',
              height: 'calc(100vh - 120px)',
              overflowY: 'hidden',
              width: section.width,
              minWidth: section.width,
              boxSizing: 'border-box'
            }}
          >
            {isRightmostPanel && activeDetail ? (
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
  );
}
