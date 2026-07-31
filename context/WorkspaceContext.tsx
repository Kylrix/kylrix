'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { ProjectsService } from '@/lib/appwrite/projects';
import { attachObjectToProject } from '@/lib/projects/object-attachment';
import { getSessionProjectsList } from '@/lib/projects/projects-cache';
import { normalizeProjectsList, warmProjectsList } from '@/lib/projects/warm-projects-list';

export interface WorkspaceItem {
  id: string;
  title: string;
  ownerId: string;
  isPersonal: boolean;
}

interface WorkspaceContextType {
  activeWorkspace: WorkspaceItem;
  workspaces: WorkspaceItem[];
  loadingWorkspaces: boolean;
  setActiveWorkspaceId: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (title: string, summary?: string) => Promise<WorkspaceItem | null>;
  attachEntityToActiveWorkspace: (entityKind: string, entityId: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { getCachedDataAsync, fetchOptimized } = useDataNexus();
  const userId = user?.$id || 'guest';
  const userName = user?.name || user?.email?.split('@')[0] || 'My';

  const personalWorkspace = useMemo<WorkspaceItem>(
    () => ({
      id: userId,
      title: `${userName}'s Workspace`,
      ownerId: userId,
      isPersonal: true,
    }),
    [userId, userName]
  );

  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string>(userId);

  const mapProjectRows = useCallback(
    (rows: unknown): WorkspaceItem[] =>
      normalizeProjectsList(rows)
        .map((p: any) => ({
          id: String(p.$id || p.id || '').trim(),
          title: p.title || p.name || 'Untitled Workspace',
          ownerId: p.ownerId || p.userId || userId,
          isPersonal: false as const,
        }))
        .filter((w) => w.id && w.id !== personalWorkspace.id),
    [personalWorkspace.id, userId],
  );

  const initialItems = useMemo<WorkspaceItem[]>(() => {
    return [personalWorkspace, ...mapProjectRows(getSessionProjectsList() || [])];
  }, [personalWorkspace, mapProjectRows]);

  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>(initialItems);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);

  useEffect(() => {
    setActiveWorkspaceIdState((prev) => (prev === 'guest' && userId !== 'guest' ? userId : prev));
  }, [userId]);

  const refreshWorkspaces = useCallback(async () => {
    setLoadingWorkspaces(true);
    try {
      const rows = await warmProjectsList({
        userId: userId || 'guest',
        getCachedDataAsync,
        fetchOptimized});

      setWorkspaces([personalWorkspace, ...mapProjectRows(rows)]);
    } catch (err) {
      console.warn('[WorkspaceContext] Failed to load workspaces:', err);
    } finally {
      setLoadingWorkspaces(false);
    }
  }, [personalWorkspace, getCachedDataAsync, fetchOptimized, mapProjectRows, userId]);

  useEffect(() => {
    void (async () => {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const mapped = mapProjectRows(await LocalEngine.cacheGet('f_projects_list'));
        if (!mapped.length) return;
        setWorkspaces((prev) => {
          const byId = new Map(prev.map((w) => [w.id, w]));
          byId.set(personalWorkspace.id, personalWorkspace);
          for (const w of mapped) byId.set(w.id, w);
          return [personalWorkspace, ...Array.from(byId.values()).filter((w) => w.id !== personalWorkspace.id)];
        });
      } catch {
        /* optional */
      }
    })();
  }, [personalWorkspace, mapProjectRows]);

  useEffect(() => {
    void refreshWorkspaces();
  }, [refreshWorkspaces]);

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveWorkspaceIdState(id);
  }, []);

  const activeWorkspace = useMemo<WorkspaceItem>(() => {
    const found = workspaces.find((w) => w.id === activeWorkspaceId);
    return found || personalWorkspace;
  }, [workspaces, activeWorkspaceId, personalWorkspace]);

  const createWorkspace = useCallback(
    async (title: string, summary?: string): Promise<WorkspaceItem | null> => {
      try {
        const created = await ProjectsService.createProject({
          title,
          summary: summary || '',
          ownerId: userId});
        const newItem: WorkspaceItem = {
          id: created.$id,
          title: created.title || title,
          ownerId: userId,
          isPersonal: false,
        };
        setWorkspaces((prev) => [
          personalWorkspace,
          newItem,
          ...prev.filter((w) => w.id !== personalWorkspace.id && w.id !== newItem.id),
        ]);
        setActiveWorkspaceIdState(created.$id);
        void refreshWorkspaces();
        return newItem;
      } catch (err) {
        console.error('[WorkspaceContext] Create workspace failed:', err);
        return null;
      }
    },
    [userId, refreshWorkspaces, personalWorkspace]
  );

  const attachEntityToActiveWorkspace = useCallback(
    async (entityKind: string, entityId: string) => {
      if (activeWorkspace.isPersonal || activeWorkspace.id === userId) {
        return; // Personal items stay in personal workspace naturally
      }
      try {
        await attachObjectToProject({
          projectId: activeWorkspace.id,
          entityKind,
          entityId});
        // Mark row as workspace-scoped so default (no-workspace) views can hide it
        try {
          const { databases } = await import('@/lib/appwrite/client');
          const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
          const tableByKind: Record<string, string> = {
            note: APPWRITE_CONFIG.TABLES.NOTES,
            idea: APPWRITE_CONFIG.TABLES.NOTES,
            goal: APPWRITE_CONFIG.TABLES.TASKS,
            task: APPWRITE_CONFIG.TABLES.TASKS,
            form: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
            event: APPWRITE_CONFIG.TABLES.EVENTS,
            credential: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS,
            totp: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS,
          };
          const tableId = tableByKind[entityKind];
          if (tableId) {
            await databases.updateRow(
              APPWRITE_CONFIG.DATABASE_ID,
              tableId,
              entityId,
              { isWorkspace: true },
            );
          }
        } catch (flagErr) {
          console.warn('[WorkspaceContext] isWorkspace flag update failed:', flagErr);
        }
      } catch (err) {
        console.warn(`[WorkspaceContext] Auto-attach entity ${entityKind} ${entityId} failed:`, err);
      }
    },
    [activeWorkspace, userId]
  );

  const value = useMemo(
    () => ({
      activeWorkspace,
      workspaces,
      loadingWorkspaces,
      setActiveWorkspaceId,
      refreshWorkspaces,
      createWorkspace,
      attachEntityToActiveWorkspace}),
    [
      activeWorkspace,
      workspaces,
      loadingWorkspaces,
      setActiveWorkspaceId,
      refreshWorkspaces,
      createWorkspace,
      attachEntityToActiveWorkspace,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

const fallbackPersonalWorkspace: WorkspaceItem = {
  id: 'guest',
  title: 'My Workspace',
  ownerId: 'guest',
  isPersonal: true,
};

const fallbackWorkspaceContext: WorkspaceContextType = {
  activeWorkspace: fallbackPersonalWorkspace,
  workspaces: [fallbackPersonalWorkspace],
  loadingWorkspaces: false,
  setActiveWorkspaceId: () => {},
  refreshWorkspaces: async () => {},
  createWorkspace: async () => null,
  attachEntityToActiveWorkspace: async () => {},
};

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  return context || fallbackWorkspaceContext;
}
