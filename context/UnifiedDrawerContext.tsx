'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { writeSurfaceForeground } from '@/lib/ui/surface-memory';

type DrawerContent = 'navbar' | 'login' | 'agentic' | 'note' | 'wallet' | 'masterpass' | 'share-note' | 'share-context' | 'delete-note' | 'assign-goal' | 'task-add-to-project' | 'add-to-project' | 'new-chat' | 'new-channel' | 'new-tag' | 'tag-selector' | 'new-project' | 'agent-create' | 'secure-chat-setup' | 'passkey-setup' | 'delete-confirm' | 'security-confirm' | 'pro-upgrade' | 'pricing' | 'tags' | 'trash' | 'project-invite' | 'form' | 'form-response-detail' | 'sanitize' | 'agentic-preview' | 'project-settings' | 'project-visibility' | 'project-auto-sweep' | 'project-join-request-confirm' | 'moment-composer' | 'access-control' | 'milestone-details' | 'ecosystem-send' | 'hangouts' | 'moments' | 'flows' | 'profile-preview' | 'follow-list' | 'zap' | 'reaction-detail';

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

/** Surfaces that count as exclusive route foreground (not ephemeral confirm sheets). */
function isForegroundDrawer(content: DrawerContent): boolean {
  return (
    content === 'moments' ||
    content === 'moment-composer' ||
    content === 'hangouts' ||
    content === 'flows' ||
    content === 'note' ||
    content === 'agentic' ||
    content === 'wallet' ||
    content === 'tags' ||
    content === 'trash' ||
    content === 'form'
  );
}

export function UnifiedDrawerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeContent, setActiveContent] = useState<DrawerContent>('navbar');
  const [drawerData, setDrawerData] = useState<any>(null);

  const open = useCallback(
    (content: DrawerContent, data?: any) => {
      setDrawerData(data || null);
      setActiveContent(content);
      // Exclusive last-wins foreground — opening moments replaces note/etc. for this route.
      if (user?.$id && isForegroundDrawer(content)) {
        void writeSurfaceForeground(user.$id, {
          kind: `unified:${content}`,
          id: drawerMemoryId(content, data) || content,
          meta: {
            content,
            mode: data?.mode != null ? String(data.mode) : null,
          },
        });
      }
    },
    [user],
  );

  const close = useCallback(() => {
    const wasForeground = isForegroundDrawer(activeContent);
    setActiveContent('navbar');
    setDrawerData(null);
    // Clear exclusive slot only if we were the foreground — don't wipe prefs.
    if (user?.$id && wasForeground) {
      void writeSurfaceForeground(user.$id, null);
    }
  }, [user, activeContent]);

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
