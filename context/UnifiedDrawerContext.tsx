'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { writeSurfaceActive } from '@/lib/ui/surface-memory';

type DrawerContent = 'navbar' | 'login' | 'agentic' | 'note' | 'wallet' | 'masterpass' | 'share-note' | 'share-context' | 'delete-note' | 'assign-goal' | 'task-add-to-project' | 'add-to-project' | 'new-chat' | 'new-channel' | 'new-tag' | 'tag-selector' | 'new-project' | 'agent-create' | 'secure-chat-setup' | 'passkey-setup' | 'delete-confirm' | 'security-confirm' | 'pro-upgrade' | 'pricing' | 'tags' | 'trash' | 'project-invite' | 'form' | 'form-response-detail' | 'sanitize' | 'agentic-preview' | 'project-settings' | 'project-visibility' | 'project-auto-sweep' | 'project-join-request-confirm' | 'moment-composer' | 'access-control' | 'milestone-details' | 'ecosystem-send' | 'hangouts' | 'moments' | 'flows' | 'profile-preview' | 'zap' | 'reaction-detail';

export type { DrawerContent };

interface UnifiedDrawerContextType {
  activeContent: DrawerContent;
  drawerData: any;
  open: (content: DrawerContent, data?: any) => void;
  close: () => void;
}

const UnifiedDrawerContext = createContext<UnifiedDrawerContextType | undefined>(undefined);

/** Tiny fingerprint for restore — never store full blobs. */
function drawerMemoryId(content: DrawerContent, data: any): string | null {
  if (!data || typeof data !== 'object') return null;
  const keys = ['parentMomentId', 'momentId', 'noteId', 'goalId', 'id', 'chatId', 'projectId', 'resourceId'];
  for (const k of keys) {
    const v = data[k];
    if (v != null && String(v).trim()) return `${k}:${String(v).trim().slice(0, 80)}`;
  }
  if (data.mode) return `mode:${String(data.mode)}`;
  return null;
}

export function UnifiedDrawerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeContent, setActiveContent] = useState<DrawerContent>('navbar');
  const [drawerData, setDrawerData] = useState<any>(null);

  const open = useCallback(
    (content: DrawerContent, data?: any) => {
      setDrawerData(data || null);
      setActiveContent(content);
      if (user?.$id && content !== 'navbar') {
        void writeSurfaceActive(user.$id, 'unified-drawer', {
          id: drawerMemoryId(content, data) || content,
          meta: {
            content,
            mode: data?.mode != null ? String(data.mode) : null,
          },
        });
      }
    },
    [user?.$id],
  );

  const close = useCallback(() => {
    setActiveContent('navbar');
    setDrawerData(null);
    if (user?.$id) {
      void writeSurfaceActive(user.$id, 'unified-drawer', { open: false });
    }
  }, [user?.$id]);

  // Remember last non-navbar drawer kind for cross-session continuity (payload restored by callers via drafts)
  useEffect(() => {
    if (!user?.$id || activeContent === 'navbar') return;
    void writeSurfaceActive(user.$id, 'unified-drawer', {
      id: drawerMemoryId(activeContent, drawerData) || activeContent,
      meta: { content: activeContent },
    });
  }, [user?.$id, activeContent, drawerData]);

  return (
    <UnifiedDrawerContext.Provider value={{ activeContent, drawerData, open, close }}>
      {children}
    </UnifiedDrawerContext.Provider>
  );
}

export function useUnifiedDrawer() {
  const context = useContext(UnifiedDrawerContext);
  if (!context) throw new Error('useUnifiedDrawer must be used within UnifiedDrawerProvider');
  return context;
}
